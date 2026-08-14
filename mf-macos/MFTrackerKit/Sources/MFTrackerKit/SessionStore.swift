import Combine
import Foundation

@MainActor
public final class SessionStore: ObservableObject {
    @Published public private(set) var session: AuthSession?
    @Published public private(set) var isLoggingIn = false
    @Published public var lastError: String?
    /// Survives NSPopover remount — accidental close must not wipe mid-entry / mid-login.
    @Published public var loginDraftEmail: String = ""
    @Published public var loginDraftPassword: String = ""
    /// Menu-bar popover is showing the Sign In form (not guest teaser).
    @Published public private(set) var isPresentingLoginUI = false

    public let client: GraphQLClient
    private var refreshTask: Task<Void, Never>?
    private var loginTask: Task<Void, Never>?

    public init(client: GraphQLClient = GraphQLClient()) {
        self.client = client
        client.endpoint = AppGroupStore.graphqlURL
        // App Group suite is suspended during App.init — only hydrate memory from Keychain.
        // Auth flags are written in `syncAuthToAppGroup()` after `enableSuiteAccess()`.
        if let stored = KeychainStore.loadSession() {
            self.session = stored
            client.accessToken = stored.accessToken
        }
    }

    /// Call once after App Group suite access is enabled (and after login/logout).
    public func syncAuthToAppGroup() {
        if let session {
            AppGroupStore.syncAuthFlag(
                isAuthenticated: true,
                userLabel: session.user.shortDisplayLabel
            )
        } else {
            AppGroupStore.syncAuthFlag(isAuthenticated: false, userLabel: nil)
        }
    }

    public var isAuthenticated: Bool { session != nil }

    /// Retain popover only while login HTTP is in flight — Sign In form itself must stay dismissible.
    public var shouldRetainPopover: Bool {
        isLoggingIn
    }

    public func setPresentingLoginUI(_ presenting: Bool) {
        guard isPresentingLoginUI != presenting else { return }
        isPresentingLoginUI = presenting
    }

    /// Cancel Sign In form — clear password + pending login intents; keep email as convenience.
    public func cancelLoginDraft() {
        loginDraftPassword = ""
        lastError = nil
        setPresentingLoginUI(false)
        AppGroupStore.clearPendingLoginIntents()
    }

    /// After successful auth — clear password; keep email.
    public func clearLoginPasswordDraft() {
        loginDraftPassword = ""
    }

    /// Starts login owned by the store (survives LoginView remount / button disable).
    public func beginLogin(email: String, password: String) {
        guard !isLoggingIn else { return }
        loginDraftEmail = email
        loginDraftPassword = password
        lastError = nil
        isLoggingIn = true
        loginTask = Task { [weak self] in
            await self?.login(email: email, password: password)
        }
    }

    public func login(email: String, password: String) async {
        lastError = nil
        isLoggingIn = true
        defer { isLoggingIn = false }
        do {
            AppGroupStore.seedFromBundleIfNeeded()
            client.endpoint = AppGroupStore.graphqlURL
            // Drop stale Keychain tokens without flipping `session` to nil mid-login —
            // that fired onChange(isAuthenticated:false) → clearLocalStateForSignOut and
            // raced with the successful login snapshot write.
            refreshTask?.cancel()
            refreshTask = nil
            KeychainStore.clearSession()
            client.accessToken = nil
            if (AppGroupStore.apiKey ?? "").isEmpty {
                lastError = "API key missing — set it in Settings or run npm run mf-macos:env."
                return
            }
            let next = try await client.login(
                email: email.trimmingCharacters(in: .whitespacesAndNewlines),
                password: password
            )
            do {
                try KeychainStore.saveSession(next)
            } catch {
                lastError = "Could not save session to Keychain — check App Group entitlements."
                return
            }
            session = next
            client.accessToken = next.accessToken
            clearLoginPasswordDraft()
            setPresentingLoginUI(false)
            startRefreshLoop()
            // Auth flag lands in App Group before refresh finishes so widgets leave Sign In state.
            // Flush suite to disk so a warm WidgetKit process does not keep a signed-out cache.
            var snapshot = AppGroupStore.loadSnapshot()
            snapshot.isAuthenticated = true
            snapshot.userLabel = next.user.shortDisplayLabel
            snapshot.updatedAt = Date()
            AppGroupStore.saveSnapshot(snapshot)
            AppGroupStore.flushSuiteToDisk()
            AppGroupStore.clearPendingLoginIntents()
            WidgetReloader.reload(aggressive: true)
            TrackerDeepLink.postSnapshotDidChange()
            NSLog(
                "[MFProjectTracker] login ok user=%@ authFlag=1 apiKey=%@ endpoint=%@",
                next.user.email,
                (AppGroupStore.apiKey ?? "").isEmpty ? "missing" : "set",
                AppGroupStore.graphqlURL.absoluteString
            )
        } catch {
            // Ignore pure CancellationError — network -999 is mapped in friendlyError.
            if error is CancellationError { return }
            lastError = TrackerDataStore.friendlyError(error)
            NSLog("[MFProjectTracker] login failed: %@", lastError ?? "")
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
        clearLoginPasswordDraft()
        setPresentingLoginUI(false)
        clearLocalSession(reloadWidgets: true)
    }

    /// Drop Keychain / in-memory session without a network logout (stale refresh / missing API key).
    public func clearLocalSession(reloadWidgets: Bool = true) {
        // Never wipe during an in-flight login — callers clear Keychain explicitly instead.
        if isLoggingIn { return }
        refreshTask?.cancel()
        refreshTask = nil
        KeychainStore.clearSession()
        session = nil
        client.accessToken = nil
        AppGroupStore.saveSignedOutSnapshot()
        if reloadWidgets {
            WidgetReloader.reload(aggressive: true)
        }
    }

    public func bootstrap() {
        // Ensure App Group / Info.plist client headers are available before any refresh.
        AppGroupStore.seedFromBundleIfNeeded()
        client.endpoint = AppGroupStore.graphqlURL
        guard session != nil else { return }
        NSLog("[MFProjectTracker][DIAG] bootstrap() called")
        startRefreshLoop()
        Task { await refreshIfNeeded() }
    }

    public func refreshIfNeeded() async {
        guard let current = session else { return }
        NSLog("[MFProjectTracker][DIAG] refreshIfNeeded ENTER refreshToken=%@", String(current.refreshToken.suffix(8)))
        AppGroupStore.seedFromBundleIfNeeded()
        client.endpoint = AppGroupStore.graphqlURL
        if (AppGroupStore.apiKey ?? "").isEmpty {
            // Refresh without X-API-Key always fails as TOKEN_INVALID — clear and ask to sign in.
            NSLog("[MFProjectTracker][DIAG] refreshIfNeeded ABORT empty apiKey")
            clearLocalSession()
            lastError = "Session expired. Please sign in again."
            NotificationCenter.default.post(name: MFTrackerConstants.sessionExpiredNotification, object: nil)
            return
        }
        do {
            let next = try await client.refreshTokens(userID: current.user.id, refreshToken: current.refreshToken)
            NSLog("[MFProjectTracker][DIAG] refreshIfNeeded SUCCESS newRefreshToken=%@", String(next.refreshToken.suffix(8)))
            try KeychainStore.saveSession(next)
            session = next
            client.accessToken = next.accessToken
        } catch GraphQLClientError.unauthorized {
            NSLog("[MFProjectTracker][DIAG] refreshIfNeeded FAIL unauthorized refreshToken=%@", String(current.refreshToken.suffix(8)))
            clearLocalSession()
            lastError = "Session expired. Please sign in again."
            NotificationCenter.default.post(name: MFTrackerConstants.sessionExpiredNotification, object: nil)
        } catch {
            // Stale Keychain refresh after Redis restart also surfaces as graphQL("token is invalid").
            let msg = TrackerDataStore.friendlyError(error).lowercased()
            NSLog("[MFProjectTracker][DIAG] refreshIfNeeded FAIL error=%@ refreshToken=%@", msg, String(current.refreshToken.suffix(8)))
            if msg.contains("token is invalid") || msg.contains("token is expired") || msg.contains("unauthorized") {
                clearLocalSession()
                lastError = "Session expired. Please sign in again."
                NotificationCenter.default.post(name: MFTrackerConstants.sessionExpiredNotification, object: nil)
            } else {
                lastError = TrackerDataStore.friendlyError(error)
            }
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
