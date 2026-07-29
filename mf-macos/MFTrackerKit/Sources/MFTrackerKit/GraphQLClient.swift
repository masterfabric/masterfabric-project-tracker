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
}

public final class GraphQLClient: @unchecked Sendable {
    public var endpoint: URL
    public var accessToken: String?

    public init(endpoint: URL = AppGroupStore.graphqlURL, accessToken: String? = nil) {
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
        request.setValue(AppGroupStore.clientBundleID, forHTTPHeaderField: "X-Bundle-ID")
        if let apiKey = AppGroupStore.apiKey, !apiKey.isEmpty {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        var body: [String: Any] = ["query": query]
        if let variables {
            body["variables"] = variables
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            let text = String(data: data, encoding: .utf8) ?? ""
            if http.statusCode == 401 {
                throw GraphQLClientError.unauthorized
            }
            throw GraphQLClientError.httpStatus(http.statusCode, text)
        }

        let envelope = try JSONDecoder.iso8601.decode(GraphQLEnvelope<T>.self, from: data)
        if let errors = envelope.errors, !errors.isEmpty {
            let messages = errors.map(\.message)
            if messages.contains(where: { $0.lowercased().contains("unauthorized") || $0.lowercased().contains("unauthenticated") }) {
                throw GraphQLClientError.unauthorized
            }
            throw GraphQLClientError.graphQL(messages)
        }
        guard let payload = envelope.data else {
            throw GraphQLClientError.graphQL(["Empty GraphQL data"])
        }
        return payload
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
        id userID title completed organizationID assignedToUserID createdAt updatedAt
      }
    }
    """

    public static let createTodoMutation = """
    mutation CreateTodo($input: CreateTodoInput!) {
      createTodo(input: $input) {
        id userID title completed organizationID assignedToUserID createdAt updatedAt
      }
    }
    """

    public static let updateTodoMutation = """
    mutation UpdateTodo($input: UpdateTodoInput!) {
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
    query OrganizationProjects($organizationId: UUID!) {
      organizationProjects(organizationId: $organizationId) {
        id organizationId name description
      }
    }
    """

    public static let organizationProjectTodosQuery = """
    query OrganizationProjectTodos($projectId: UUID!) {
      organizationProjectTodos(projectId: $projectId) {
        id projectId title status
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
        let data: MyTodosData = try await execute(query: MFAPI.myTodosQuery)
        return data.myTodos
    }

    func createTodo(title: String) async throws -> UserTodo {
        let data: CreateTodoData = try await execute(
            query: MFAPI.createTodoMutation,
            variables: ["input": ["title": title, "completed": false]]
        )
        return data.createTodo
    }

    func updateTodo(id: String, completed: Bool? = nil, title: String? = nil) async throws -> UserTodo {
        var input: [String: Any] = ["id": id]
        if let completed { input["completed"] = completed }
        if let title { input["title"] = title }
        let data: UpdateTodoData = try await execute(
            query: MFAPI.updateTodoMutation,
            variables: ["input": input]
        )
        return data.updateTodo
    }

    func myOrganizations() async throws -> [Organization] {
        let data: MyOrganizationsData = try await execute(query: MFAPI.myOrganizationsQuery)
        return data.myOrganizations
    }

    func organizationProjects(organizationId: String) async throws -> [OrganizationProject] {
        let data: OrganizationProjectsData = try await execute(
            query: MFAPI.organizationProjectsQuery,
            variables: ["organizationId": organizationId]
        )
        return data.organizationProjects
    }

    func organizationProjectTodos(projectId: String) async throws -> [OrganizationProjectTodo] {
        let data: OrganizationProjectTodosData = try await execute(
            query: MFAPI.organizationProjectTodosQuery,
            variables: ["projectId": projectId]
        )
        return data.organizationProjectTodos
    }
}
