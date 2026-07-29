import Combine
import Foundation

@MainActor
public final class SessionStore: ObservableObject {
    @Published public private(set) var session: AuthSession?
    @Published public var lastError: String?

    public let client: GraphQLClient
    private var refreshTask: Task<Void, Never>?

    public init(client: GraphQLClient = GraphQLClient()) {
        self.client = client
        if let stored = KeychainStore.loadSession() {
            self.session = stored
            client.accessToken = stored.accessToken
        }
    }

    public var isAuthenticated: Bool { session != nil }

    public func login(email: String, password: String) async {
        lastError = nil
        do {
            client.endpoint = AppGroupStore.graphqlURL
            let next = try await client.login(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            try KeychainStore.saveSession(next)
            session = next
            client.accessToken = next.accessToken
            startRefreshLoop()
        } catch {
            lastError = error.localizedDescription
        }
    }

    public func logout() async {
        if let session {
            try? await client.logout(
                userID: session.user.id,
                accessToken: session.accessToken,
                refreshToken: session.refreshToken
            )
        }
        refreshTask?.cancel()
        refreshTask = nil
        KeychainStore.clearSession()
        session = nil
        client.accessToken = nil
    }

    public func bootstrap() {
        guard session != nil else { return }
        startRefreshLoop()
        Task { await refreshIfNeeded() }
    }

    public func refreshIfNeeded() async {
        guard let current = session else { return }
        do {
            client.endpoint = AppGroupStore.graphqlURL
            let next = try await client.refreshTokens(userID: current.user.id, refreshToken: current.refreshToken)
            try KeychainStore.saveSession(next)
            session = next
            client.accessToken = next.accessToken
        } catch GraphQLClientError.unauthorized {
            await logout()
            lastError = "Session expired. Please sign in again."
        } catch {
            lastError = error.localizedDescription
        }
    }

    public func withAuthRetry<T>(_ work: () async throws -> T) async throws -> T {
        do {
            return try await work()
        } catch GraphQLClientError.unauthorized {
            await refreshIfNeeded()
            guard session != nil else { throw GraphQLClientError.unauthorized }
            return try await work()
        }
    }

    private func startRefreshLoop() {
        refreshTask?.cancel()
        refreshTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 3 * 60 * 1_000_000_000)
                await self?.refreshIfNeeded()
            }
        }
    }
}
