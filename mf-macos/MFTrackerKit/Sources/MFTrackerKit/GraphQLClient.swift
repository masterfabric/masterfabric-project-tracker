import Foundation

public enum GraphQLClientError: LocalizedError {
    case httpStatus(Int, String)
    case graphQL([String])
    case decoding(Error)
    case otpRequired
    case missingToken
    case unauthorized

    public var errorDescription: String? {
        switch self {
        case let .httpStatus(code, body):
            return "HTTP \(code): \(body)"
        case let .graphQL(messages):
            return messages.joined(separator: "\n")
        case let .decoding(error):
            return "Decoding failed: \(error.localizedDescription)"
        case .otpRequired:
            return "OTP verification is required. Complete login in the mobile app first, or disable OTP for this account."
        case .missingToken:
            return "Not signed in."
        case .unauthorized:
            return "Session expired. Please sign in again."
        }
    }

    /// Expo-equivalent of `isDueAtSchemaMismatchError` — older mf-go without `dueAt` on todos.
    public var isDueAtSchemaMismatch: Bool {
        let blob: String
        switch self {
        case let .graphQL(messages):
            blob = messages.joined(separator: "\n").lowercased()
        case let .httpStatus(_, body):
            blob = body.lowercased()
        default:
            return false
        }
        let mentionsDue = blob.contains("dueat") || blob.contains("due_at")
        let validation =
            blob.contains("graphql_validation_failed")
            || blob.contains("cannot query field")
            || blob.contains("unknown field")
            || blob.contains("unknown argument")
        return mentionsDue && validation
    }
}

public final class GraphQLClient: @unchecked Sendable {
    public var endpoint: URL
    public var accessToken: String?

    public init(endpoint: URL = MFTrackerConstants.defaultGraphQLURL, accessToken: String? = nil) {
        self.endpoint = endpoint
        self.accessToken = accessToken
    }

    public func execute<T: Decodable>(
        query: String,
        variables: [String: Any]? = nil,
        as type: T.Type = T.self
    ) async throws -> T {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("MFProjectTracker-macOS", forHTTPHeaderField: "User-Agent")
        // Every GraphQL call (login, refreshTokens, data) must carry the registered client
        // headers. mf-go refresh without X-API-Key returns TOKEN_INVALID → "Session expired".
        Self.applyClientHeaders(to: &request)
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        var body: [String: Any] = ["query": query]
        if let variables {
            body["variables"] = variables
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.timeoutInterval = 30

        // Intentionally not using `URLSession.data(for:)` — that API cancels the
        // HTTP task when the *calling* Swift Task is cancelled. Menu-bar popover
        // remounts / Sign In button disable mid-flight were surfacing as
        // `NSURLErrorCancelled (-999)`. Keep the round-trip alive via dataTask.
        let (data, response) = try await Self.dataIgnoringCallerCancellation(for: request)
        let text = String(data: data, encoding: .utf8) ?? ""
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if http.statusCode == 401 {
                throw GraphQLClientError.unauthorized
            }
            // mf-go often returns GraphQL validation failures as HTTP 422 with an errors[] body.
            if let envelope = try? JSONDecoder.iso8601.decode(GraphQLEnvelope<T>.self, from: data),
               let errors = envelope.errors, !errors.isEmpty
            {
                let messages = errors.map(\.message)
                if messages.contains(where: { Self.isAuthFailureMessage($0) }) {
                    throw GraphQLClientError.unauthorized
                }
                throw GraphQLClientError.graphQL(messages)
            }
            throw GraphQLClientError.httpStatus(http.statusCode, text)
        }

        let envelope = try JSONDecoder.iso8601.decode(GraphQLEnvelope<T>.self, from: data)
        if let errors = envelope.errors, !errors.isEmpty {
            let messages = errors.map(\.message)
            if messages.contains(where: { Self.isAuthFailureMessage($0) }) {
                throw GraphQLClientError.unauthorized
            }
            throw GraphQLClientError.graphQL(messages)
        }
        guard let payload = envelope.data else {
            throw GraphQLClientError.graphQL(["Empty GraphQL data"])
        }
        return payload
    }

    /// mf-go returns TOKEN_INVALID ("token is invalid") on stale refresh; treat like unauthorized.
    /// Keep this narrow — particular / org errors that merely say "unauthorized" must not
    /// wipe a fresh Keychain session via withAuthRetry → refreshIfNeeded.
    private static func isAuthFailureMessage(_ message: String) -> Bool {
        let m = message.lowercased()
        if m.contains("token is invalid") || m.contains("token is expired") {
            return true
        }
        if m.contains("authentication required") || m.contains("unauthenticated") {
            return true
        }
        // Bare "unauthorized" only when it looks like a bearer/session problem.
        if m.contains("unauthorized") {
            return m.contains("token") || m.contains("bearer") || m.contains("jwt")
                || m.contains("session") || m.contains("access")
        }
        return false
    }

    /// X-Bundle-ID + X-API-Key from App Group / support files / Info.plist.
    public static func applyClientHeaders(to request: inout URLRequest) {
        let bundleID = AppGroupStore.clientBundleID
        request.setValue(bundleID, forHTTPHeaderField: "X-Bundle-ID")
        if let apiKey = AppGroupStore.apiKey, !apiKey.isEmpty {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }
    }

    /// Completes even if the awaiting Swift Task is cancelled (popover remount / button disable).
    private static func dataIgnoringCallerCancellation(for request: URLRequest) async throws -> (Data, URLResponse) {
        try await withCheckedThrowingContinuation { continuation in
            let task = URLSession.shared.dataTask(with: request) { data, response, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let data, let response else {
                    continuation.resume(throwing: URLError(.badServerResponse))
                    return
                }
                continuation.resume(returning: (data, response))
            }
            task.resume()
        }
    }
}

private struct GraphQLEnvelope<T: Decodable>: Decodable {
    let data: T?
    let errors: [GraphQLErrorItem]?
}

private struct GraphQLErrorItem: Decodable {
    let message: String
}

// MARK: - Operations

public enum MFAPI {
    public static let loginMutation = """
    mutation Login($input: LoginInput!) {
      login(input: $input) {
        otpRequired
        loginToken
        accessToken
        refreshToken
        expiresIn
        user { id email displayName avatarURL role }
      }
    }
    """

    public static let refreshMutation = """
    mutation RefreshTokens($input: RefreshInput!) {
      refreshTokens(input: $input) {
        accessToken
        refreshToken
        expiresIn
        user { id email displayName avatarURL role }
      }
    }
    """

    public static let logoutMutation = """
    mutation Logout($input: LogoutInput!) {
      logout(input: $input)
    }
    """

    public static let myTodosQuery = """
    query MyTodos {
      myTodos {
        id userID title completed organizationID assignedToUserID dueAt createdAt updatedAt
      }
    }
    """

    /// Fallback when live mf-go schema has no UserTodo.dueAt (same pattern as Expo CREATE/UPDATE_TODO_NO_DUE).
    public static let myTodosQueryNoDue = """
    query MyTodosNoDue {
      myTodos {
        id userID title completed organizationID assignedToUserID createdAt updatedAt
      }
    }
    """

    public static let createTodoMutation = """
    mutation CreateTodo($input: CreateTodoInput!) {
      createTodo(input: $input) {
        id userID title completed organizationID assignedToUserID dueAt createdAt updatedAt
      }
    }
    """

    public static let createTodoMutationNoDue = """
    mutation CreateTodoNoDue($input: CreateTodoInput!) {
      createTodo(input: $input) {
        id userID title completed organizationID assignedToUserID createdAt updatedAt
      }
    }
    """

    public static let updateTodoMutation = """
    mutation UpdateTodo($input: UpdateTodoInput!) {
      updateTodo(input: $input) {
        id userID title completed organizationID assignedToUserID dueAt createdAt updatedAt
      }
    }
    """

    public static let updateTodoMutationNoDue = """
    mutation UpdateTodoNoDue($input: UpdateTodoInput!) {
      updateTodo(input: $input) {
        id userID title completed organizationID assignedToUserID createdAt updatedAt
      }
    }
    """

    public static let myOrganizationsQuery = """
    query MyOrganizations {
      myOrganizations { id name description }
    }
    """

    public static let organizationProjectsQuery = """
    query OrganizationProjects($organizationId: String!) {
      organizationProjects(organizationId: $organizationId) {
        id organizationId name description
      }
    }
    """

    public static let organizationProjectTodosQuery = """
    query OrganizationProjectTodos($projectId: String!) {
      organizationProjectTodos(projectId: $projectId) {
        id projectId title status dueAt
      }
    }
    """

    public static let organizationProjectTodosQueryNoDue = """
    query OrganizationProjectTodosNoDue($projectId: String!) {
      organizationProjectTodos(projectId: $projectId) {
        id projectId title status
      }
    }
    """

    public static let createOrganizationProjectTodoMutation = """
    mutation CreateOrganizationProjectTodo($input: CreateOrganizationProjectTodoInput!) {
      createOrganizationProjectTodo(input: $input) {
        id projectId title status dueAt
      }
    }
    """

    public static let createOrganizationProjectTodoMutationNoDue = """
    mutation CreateOrganizationProjectTodoNoDue($input: CreateOrganizationProjectTodoInput!) {
      createOrganizationProjectTodo(input: $input) {
        id projectId title status
      }
    }
    """

    public static let updateOrganizationProjectTodoMutation = """
    mutation UpdateOrganizationProjectTodo($input: UpdateOrganizationProjectTodoInput!) {
      updateOrganizationProjectTodo(input: $input) {
        id projectId title status dueAt
      }
    }
    """

    public static let updateOrganizationProjectTodoMutationNoDue = """
    mutation UpdateOrganizationProjectTodoNoDue($input: UpdateOrganizationProjectTodoInput!) {
      updateOrganizationProjectTodo(input: $input) {
        id projectId title status
      }
    }
    """

    public static let particularEnvelopeQuery = """
    query ParticularGraphqlEnvelope($input: ParticularGraphqlInput!) {
      particularGraphqlEnvelope(input: $input) {
        dataJson
        errorsJson
      }
    }
    """

    public static let organizationMessagesQuery = """
    query OrganizationMessages($organizationId: UUID!, $limit: Int) {
      organizationMessages(organizationId: $organizationId, limit: $limit) {
        id organizationID authorUserID authorNickname body createdAt
      }
    }
    """

    public static let postOrganizationMessageMutation = """
    mutation PostOrganizationMessage($organizationId: UUID!, $body: String!) {
      postOrganizationMessage(organizationId: $organizationId, body: $body) {
        id organizationID authorUserID authorNickname body createdAt
      }
    }
    """
}

private struct LoginData: Decodable {
    let login: LoginPayloadDTO
}

private struct LoginPayloadDTO: Decodable {
    let otpRequired: Bool
    let loginToken: String?
    let accessToken: String?
    let refreshToken: String?
    let expiresIn: Int?
    let user: AuthUser
}

private struct RefreshData: Decodable {
    let refreshTokens: AuthPayloadDTO
}

private struct AuthPayloadDTO: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let user: AuthUser
}

private struct LogoutData: Decodable {
    let logout: Bool
}

private struct MyTodosData: Decodable {
    let myTodos: [UserTodo]
}

private struct CreateTodoData: Decodable {
    let createTodo: UserTodo
}

private struct UpdateTodoData: Decodable {
    let updateTodo: UserTodo
}

private struct MyOrganizationsData: Decodable {
    let myOrganizations: [Organization]
}

private struct OrganizationProjectsData: Decodable {
    let organizationProjects: [OrganizationProject]
}

private struct OrganizationProjectTodosData: Decodable {
    let organizationProjectTodos: [OrganizationProjectTodo]
}

private struct CreateOrganizationProjectTodoData: Decodable {
    let createOrganizationProjectTodo: OrganizationProjectTodo
}

private struct UpdateOrganizationProjectTodoData: Decodable {
    let updateOrganizationProjectTodo: OrganizationProjectTodo
}

private struct OrganizationMessagesData: Decodable {
    let organizationMessages: [OrganizationMessage]
}

private struct PostOrganizationMessageData: Decodable {
    let postOrganizationMessage: OrganizationMessage
}

private struct ParticularEnvelopeData: Decodable {
    let particularGraphqlEnvelope: ParticularEnvelopeDTO
}

private struct ParticularEnvelopeDTO: Decodable {
    let dataJson: String?
    let errorsJson: String?
}

private struct ParticularDataWrap<T: Decodable>: Decodable {
    let data: T
}

public extension GraphQLClient {
    func login(email: String, password: String) async throws -> AuthSession {
        let data: LoginData = try await execute(
            query: MFAPI.loginMutation,
            variables: ["input": ["email": email, "password": password]]
        )
        if data.login.otpRequired {
            throw GraphQLClientError.otpRequired
        }
        guard let access = data.login.accessToken,
              let refresh = data.login.refreshToken,
              let expires = data.login.expiresIn
        else {
            throw GraphQLClientError.missingToken
        }
        return AuthSession(
            accessToken: access,
            refreshToken: refresh,
            expiresIn: expires,
            user: data.login.user
        )
    }

    func refreshTokens(userID: String, refreshToken: String) async throws -> AuthSession {
        let data: RefreshData = try await execute(
            query: MFAPI.refreshMutation,
            variables: [
                "input": [
                    "userID": userID,
                    "refreshToken": refreshToken,
                    "platform": MFTrackerConstants.platform,
                    "deviceName": "MF Project Tracker macOS",
                ] as [String: Any],
            ]
        )
        return AuthSession(
            accessToken: data.refreshTokens.accessToken,
            refreshToken: data.refreshTokens.refreshToken,
            expiresIn: data.refreshTokens.expiresIn,
            user: data.refreshTokens.user
        )
    }

    func logout(userID: String, accessToken: String, refreshToken: String) async throws {
        let _: LogoutData = try await execute(
            query: MFAPI.logoutMutation,
            variables: [
                "input": [
                    "userID": userID,
                    "accessToken": accessToken,
                    "refreshToken": refreshToken,
                ],
            ]
        )
    }

    func myTodos() async throws -> [UserTodo] {
        do {
            let data: MyTodosData = try await execute(query: MFAPI.myTodosQuery)
            return data.myTodos
        } catch let error as GraphQLClientError where error.isDueAtSchemaMismatch {
            let data: MyTodosData = try await execute(query: MFAPI.myTodosQueryNoDue)
            return data.myTodos
        }
    }

    func createTodo(title: String) async throws -> UserTodo {
        let variables: [String: Any] = ["input": ["title": title, "completed": false]]
        do {
            let data: CreateTodoData = try await execute(
                query: MFAPI.createTodoMutation,
                variables: variables
            )
            return data.createTodo
        } catch let error as GraphQLClientError where error.isDueAtSchemaMismatch {
            let data: CreateTodoData = try await execute(
                query: MFAPI.createTodoMutationNoDue,
                variables: variables
            )
            return data.createTodo
        }
    }

    func updateTodo(id: String, completed: Bool? = nil, title: String? = nil) async throws -> UserTodo {
        var input: [String: Any] = ["id": id]
        if let completed { input["completed"] = completed }
        if let title { input["title"] = title }
        let variables: [String: Any] = ["input": input]
        do {
            let data: UpdateTodoData = try await execute(
                query: MFAPI.updateTodoMutation,
                variables: variables
            )
            return data.updateTodo
        } catch let error as GraphQLClientError where error.isDueAtSchemaMismatch {
            let data: UpdateTodoData = try await execute(
                query: MFAPI.updateTodoMutationNoDue,
                variables: variables
            )
            return data.updateTodo
        }
    }

    func myOrganizations() async throws -> [Organization] {
        let data: MyOrganizationsData = try await execute(query: MFAPI.myOrganizationsQuery)
        return data.myOrganizations
    }

    func organizationMessages(organizationId: String, limit: Int = 30) async throws -> [OrganizationMessage] {
        let data: OrganizationMessagesData = try await execute(
            query: MFAPI.organizationMessagesQuery,
            variables: ["organizationId": organizationId, "limit": limit]
        )
        return data.organizationMessages
    }

    func postOrganizationMessage(organizationId: String, body: String) async throws -> OrganizationMessage {
        let data: PostOrganizationMessageData = try await execute(
            query: MFAPI.postOrganizationMessageMutation,
            variables: ["organizationId": organizationId, "body": body]
        )
        return data.postOrganizationMessage
    }

    /// Org projects hop through mf-go `particularGraphqlEnvelope` → particular-project-tracker (same as mf-expo).
    func organizationProjects(organizationId: String) async throws -> [OrganizationProject] {
        let data: OrganizationProjectsData = try await projectTrackerEnvelope(
            organizationId: organizationId,
            query: MFAPI.organizationProjectsQuery,
            variables: ["organizationId": organizationId]
        )
        return data.organizationProjects
    }

    func organizationProjectTodos(organizationId: String, projectId: String) async throws -> [OrganizationProjectTodo] {
        do {
            let data: OrganizationProjectTodosData = try await projectTrackerEnvelope(
                organizationId: organizationId,
                query: MFAPI.organizationProjectTodosQuery,
                variables: ["projectId": projectId]
            )
            return data.organizationProjectTodos
        } catch let error as GraphQLClientError where error.isDueAtSchemaMismatch {
            let data: OrganizationProjectTodosData = try await projectTrackerEnvelope(
                organizationId: organizationId,
                query: MFAPI.organizationProjectTodosQueryNoDue,
                variables: ["projectId": projectId]
            )
            return data.organizationProjectTodos
        }
    }

    func createOrganizationProjectTodo(
        organizationId: String,
        projectId: String,
        title: String
    ) async throws -> OrganizationProjectTodo {
        let variables: [String: Any] = [
            "input": [
                "projectId": projectId,
                "title": title,
            ] as [String: Any],
        ]
        do {
            let data: CreateOrganizationProjectTodoData = try await projectTrackerEnvelope(
                organizationId: organizationId,
                query: MFAPI.createOrganizationProjectTodoMutation,
                variables: variables
            )
            return data.createOrganizationProjectTodo
        } catch let error as GraphQLClientError where error.isDueAtSchemaMismatch {
            let data: CreateOrganizationProjectTodoData = try await projectTrackerEnvelope(
                organizationId: organizationId,
                query: MFAPI.createOrganizationProjectTodoMutationNoDue,
                variables: variables
            )
            return data.createOrganizationProjectTodo
        }
    }

    func updateOrganizationProjectTodo(
        organizationId: String,
        todoId: String,
        status: String? = nil,
        title: String? = nil
    ) async throws -> OrganizationProjectTodo {
        var input: [String: Any] = ["todoId": todoId]
        if let status { input["status"] = status }
        if let title { input["title"] = title }
        let variables: [String: Any] = ["input": input]
        do {
            let data: UpdateOrganizationProjectTodoData = try await projectTrackerEnvelope(
                organizationId: organizationId,
                query: MFAPI.updateOrganizationProjectTodoMutation,
                variables: variables
            )
            return data.updateOrganizationProjectTodo
        } catch let error as GraphQLClientError where error.isDueAtSchemaMismatch {
            let data: UpdateOrganizationProjectTodoData = try await projectTrackerEnvelope(
                organizationId: organizationId,
                query: MFAPI.updateOrganizationProjectTodoMutationNoDue,
                variables: variables
            )
            return data.updateOrganizationProjectTodo
        }
    }

    private func projectTrackerEnvelope<T: Decodable>(
        organizationId: String,
        query: String,
        variables: [String: Any]
    ) async throws -> T {
        let orgId = organizationId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !orgId.isEmpty else {
            throw GraphQLClientError.graphQL(["organizationId is required for project tracker Particular calls"])
        }
        let variablesJSON = try JSONSerialization.data(withJSONObject: variables)
        let variablesString = String(data: variablesJSON, encoding: .utf8) ?? "{}"
        let envelope: ParticularEnvelopeData = try await execute(
            query: MFAPI.particularEnvelopeQuery,
            variables: [
                "input": [
                    "particularKey": AppGroupStore.projectTrackerParticularKey,
                    "organizationId": orgId,
                    "requiredCapability": MFTrackerConstants.projectTrackerCapability,
                    "query": query,
                    "variablesJson": variablesString,
                ] as [String: Any],
            ]
        )
        let env = envelope.particularGraphqlEnvelope
        if let errorsJSON = env.errorsJson,
           errorsJSON != "null",
           errorsJSON != "[]",
           !errorsJSON.isEmpty
        {
            let err = GraphQLClientError.graphQL(["project_tracker errors: \(errorsJSON)"])
            if err.isDueAtSchemaMismatch {
                throw err
            }
            // Also detect dueAt inside nested Particular errorsJson text.
            let lower = errorsJSON.lowercased()
            if (lower.contains("dueat") || lower.contains("due_at"))
                && (lower.contains("cannot query field") || lower.contains("unknown field") || lower.contains("validation"))
            {
                throw GraphQLClientError.graphQL(["Cannot query field \"dueAt\": \(errorsJSON)"])
            }
            throw err
        }
        guard let dataJSON = env.dataJson, let data = dataJSON.data(using: .utf8) else {
            throw GraphQLClientError.graphQL(["project_tracker returned empty dataJson"])
        }
        if let direct = try? JSONDecoder.iso8601.decode(T.self, from: data) {
            return direct
        }
        do {
            return try JSONDecoder.iso8601.decode(ParticularDataWrap<T>.self, from: data).data
        } catch {
            throw GraphQLClientError.decoding(error)
        }
    }
}
