import AppIntents
import AppKit
import MFTrackerKit
import os.log
import WidgetKit

private let widgetIntentLog = Logger(subsystem: "com.masterfabric.projectTracker.macos.widgets", category: "intent")

// MARK: - Auth gate

enum WidgetIntentAuth {
    /// Returns a session when signed in; otherwise opens login and returns nil.
    @MainActor
    static func requireSessionOrOpenLogin() -> AuthSession? {
        AppGroupStore.seedFromBundleIfNeeded()
        if let session = KeychainStore.loadSession() {
            return session
        }
        openLogin()
        return nil
    }

    @MainActor
    static func openLogin() {
        TrackerDeepLink.postOpenDestination(.login)
        activateHostApp(opening: TrackerDeepLink.url(.login))
    }

    /// Triple path: App Group pending (app polls) + distributed notification + open URL / app.
    @MainActor
    static func activateHostApp(opening url: URL) {
        AppGroupStore.seedFromBundleIfNeeded()
        let bundleId = "com.masterfabric.projectTracker.macos"
        widgetIntentLog.notice("activateHostApp \(url.absoluteString, privacy: .public)")
        NSLog("[MFTrackerWidgets] activateHostApp %@", url.absoluteString)

        if let running = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first {
            running.activate(options: [.activateIgnoringOtherApps])
        }

        if let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleId) {
            let config = NSWorkspace.OpenConfiguration()
            config.activates = true
            NSWorkspace.shared.open([url], withApplicationAt: appURL, configuration: config) { _, error in
                if let error {
                    NSLog("[MFTrackerWidgets] open withApplicationAt failed: %@", error.localizedDescription)
                    NSWorkspace.shared.open(url)
                }
            }
        } else {
            NSWorkspace.shared.open(url)
        }
    }
}

// MARK: - Open / deep-link intents (Desktop + Notification Center)

enum TrackerOpenDestination: String, AppEnum {
    case home
    case tasks
    case chat
    case projects
    case timer
    case focus
    case dashboard
    case compose
    case login

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Tracker Destination")
    static var caseDisplayRepresentations: [TrackerOpenDestination: DisplayRepresentation] = [
        .home: "Home",
        .tasks: "Tasks",
        .chat: "Chat",
        .projects: "Projects",
        .timer: "Timer",
        .focus: "Focus",
        .dashboard: "Desktop Dashboard",
        .compose: "Compose",
        .login: "Sign In",
    ]

    var deepLink: TrackerDeepLink.Destination {
        TrackerDeepLink.Destination(rawValue: rawValue) ?? .home
    }
}

/// Dedicated Sign In intent — Desktop widgets often need `Button(intent:)` (widgetURL alone is ignored).
struct OpenLoginIntent: AppIntent {
    static var title: LocalizedStringResource = "Sign In to Project Tracker"
    static var description = IntentDescription("Opens the menu bar Sign In form.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        NSLog("[MFTrackerWidgets] OpenLoginIntent.perform")
        widgetIntentLog.notice("OpenLoginIntent.perform")
        AppGroupStore.flushSuiteToDisk()
        _ = AppGroupStore.healAuthStateFromKeychainIfNeeded()
        // Stale Desktop tiles can still show Sign in after menu-bar login — if Keychain
        // already has a session, open Tasks and force timelines to re-read App Group.
        if KeychainStore.loadSession() != nil || AppGroupStore.widgetIsAuthenticated {
            WidgetCenter.shared.reloadAllTimelines()
            for kind in [
                "TrackerDashboardWidget", "TasksDueWidget", "ChatNotificationsWidget",
                "ProjectPulseWidget", "FocusTimerWidget", "QuickAddWidget",
            ] {
                WidgetCenter.shared.reloadTimelines(ofKind: kind)
            }
            // Never leave pending=login when already signed in (Desktop openURL race).
            AppGroupStore.clearPendingLoginIntents()
            TrackerDeepLink.postOpenDestination(.tasks)
            WidgetIntentAuth.activateHostApp(opening: TrackerDeepLink.url(.tasks))
            return .result()
        }
        TrackerDeepLink.postOpenDestination(.login)
        WidgetIntentAuth.activateHostApp(opening: TrackerDeepLink.url(.login))
        return .result()
    }
}

/// Opens the menu bar popover (or Desktop Dashboard) for a destination.
/// Used by `widgetURL`, `Button(intent:)`, and Shortcuts.
struct OpenTrackerDestinationIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Project Tracker"
    static var description = IntentDescription("Opens the Project Tracker menu bar or Desktop Dashboard.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Destination", default: .home)
    var destination: TrackerOpenDestination

    init() {
        self.destination = .home
    }

    init(destination: TrackerOpenDestination) {
        self.destination = destination
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        let deep = destination.deepLink
        NSLog("[MFTrackerWidgets] OpenTrackerDestinationIntent.perform %@", deep.rawValue)
        widgetIntentLog.notice("OpenTrackerDestinationIntent \(deep.rawValue, privacy: .public)")
        TrackerDeepLink.postOpenDestination(deep)
        WidgetIntentAuth.activateHostApp(opening: TrackerDeepLink.url(deep))
        return .result()
    }
}

// MARK: - Focus

struct ToggleFocusTimerIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Focus Timer"
    static var description = IntentDescription("Start or pause the local focus timer.")
    static var openAppWhenRun: Bool = false

    @MainActor
    func perform() async throws -> some IntentResult {
        guard WidgetIntentAuth.requireSessionOrOpenLogin() != nil else {
            return .result()
        }
        var state = AppGroupStore.loadTimer()
        if state.isRunning {
            state.remainingSeconds = state.liveRemaining()
            state.isRunning = false
            state.endsAt = nil
        } else {
            var remaining = state.remainingSeconds
            if remaining <= 0 {
                remaining = state.durationSeconds > 0 ? state.durationSeconds : FocusTimerState.defaultPresetSeconds
                state.durationSeconds = remaining
                state.remainingSeconds = remaining
            }
            state.isRunning = true
            state.endsAt = Date().addingTimeInterval(TimeInterval(remaining))
        }
        AppGroupStore.saveTimer(state)
        WidgetCenter.shared.reloadAllTimelines()
        TrackerDeepLink.postFocusTimerDidChange()
        return .result()
    }
}

// MARK: - Quick Add

/// Widget tap path — no title dialog (Desktop widgets cannot reliably prompt).
/// Opens the Tasks tab compose field in the menu bar popover.
struct QuickAddOpenComposeIntent: AppIntent {
    static var title: LocalizedStringResource = "Quick Add Task"
    static var description = IntentDescription("Opens Project Tracker to add a personal todo or project issue.")
    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        guard WidgetIntentAuth.requireSessionOrOpenLogin() != nil else {
            return .result()
        }
        TrackerDeepLink.postOpenDestination(.compose)
        WidgetIntentAuth.activateHostApp(opening: TrackerDeepLink.url(.compose))
        return .result()
    }
}

/// Shortcuts / Siri path with an explicit title. Empty title falls back to compose.
struct CreateTrackerTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Create Tracker Task"
    static var description = IntentDescription("Creates a personal todo or org project issue.")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Title", default: "")
    var title: String

    static var parameterSummary: some ParameterSummary {
        Summary("Create task \(\.$title)")
    }

    init() {
        self.title = ""
    }

    init(title: String) {
        self.title = title
    }

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        guard let session = WidgetIntentAuth.requireSessionOrOpenLogin() else {
            return .result(value: "")
        }
        var resolved = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if resolved.isEmpty {
            TrackerDeepLink.postOpenDestination(.compose)
            WidgetIntentAuth.activateHostApp(opening: TrackerDeepLink.url(.compose))
            return .result(value: "")
        }

        let client = GraphQLClient(endpoint: AppGroupStore.graphqlURL, accessToken: session.accessToken)
        AppGroupStore.seedFromBundleIfNeeded()
        try await Self.withAuth(client: client, session: session) {
            switch AppGroupStore.taskScope {
            case .personal:
                _ = try await client.createTodo(title: resolved)
            case .project:
                guard let orgId = AppGroupStore.selectedOrganizationId,
                      let projectId = AppGroupStore.selectedProjectId
                else { throw GraphQLClientError.graphQL(["Pick an organization project in the menu bar first."]) }
                _ = try await client.createOrganizationProjectTodo(
                    organizationId: orgId, projectId: projectId, title: resolved
                )
            }
        }
        await Self.refreshSnapshot(client: client, session: session)
        WidgetCenter.shared.reloadAllTimelines()
        TrackerDeepLink.postSnapshotDidChange()
        return .result(value: resolved)
    }

    private static func withAuth(client: GraphQLClient, session: AuthSession, _ body: () async throws -> Void) async throws {
        AppGroupStore.seedFromBundleIfNeeded()
        do { try await body() }
        catch GraphQLClientError.unauthorized {
            AppGroupStore.seedFromBundleIfNeeded()
            let refreshed = try await client.refreshTokens(userID: session.user.id, refreshToken: session.refreshToken)
            try KeychainStore.saveSession(refreshed)
            client.accessToken = refreshed.accessToken
            try await body()
        }
    }

    private static func refreshSnapshot(client: GraphQLClient, session: AuthSession) async {
        var snapshot = AppGroupStore.loadSnapshot()
        if let todos = try? await client.myTodos() { snapshot.todos = todos }
        if let orgId = AppGroupStore.selectedOrganizationId,
           let projectId = AppGroupStore.selectedProjectId,
           let items = try? await client.organizationProjectTodos(organizationId: orgId, projectId: projectId)
        {
            snapshot.projectTodos = items
            if var pulse = snapshot.projectPulse {
                pulse.openCount = items.filter(\.isOpen).count
                pulse.doneCount = items.filter { !$0.isOpen }.count
                snapshot.projectPulse = pulse
            }
        }
        snapshot.taskScope = AppGroupStore.taskScope
        snapshot.isAuthenticated = true
        snapshot.userLabel = session.user.shortDisplayLabel
        snapshot.updatedAt = Date()
        AppGroupStore.saveSnapshot(snapshot)
    }
}

typealias CreateTodoIntent = CreateTrackerTaskIntent

// MARK: - Complete task

struct CompleteTodoIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete Todo"
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Todo ID")
    var todoId: String

    init() {
        self.todoId = ""
    }

    init(todoId: String) {
        self.todoId = todoId
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        guard let session = WidgetIntentAuth.requireSessionOrOpenLogin() else {
            return .result()
        }
        let raw = todoId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else {
            TrackerDeepLink.postOpenDestination(.tasks)
            WidgetIntentAuth.activateHostApp(opening: TrackerDeepLink.url(.tasks))
            return .result()
        }
        let client = GraphQLClient(endpoint: AppGroupStore.graphqlURL, accessToken: session.accessToken)
        AppGroupStore.seedFromBundleIfNeeded()
        let isProject = raw.hasPrefix("project:")
        let id = raw.replacingOccurrences(of: "personal:", with: "").replacingOccurrences(of: "project:", with: "")

        func apply() async throws {
            if isProject {
                guard let orgId = AppGroupStore.selectedOrganizationId else {
                    throw GraphQLClientError.graphQL(["No organization selected."])
                }
                _ = try await client.updateOrganizationProjectTodo(organizationId: orgId, todoId: id, status: "DONE")
            } else {
                _ = try await client.updateTodo(id: id, completed: true)
            }
        }
        do {
            try await apply()
        } catch GraphQLClientError.unauthorized {
            AppGroupStore.seedFromBundleIfNeeded()
            let refreshed = try await client.refreshTokens(userID: session.user.id, refreshToken: session.refreshToken)
            try KeychainStore.saveSession(refreshed)
            client.accessToken = refreshed.accessToken
            try await apply()
        } catch {
            TrackerDeepLink.postOpenDestination(.tasks)
            WidgetIntentAuth.activateHostApp(opening: TrackerDeepLink.url(.tasks))
            throw error
        }

        var snapshot = AppGroupStore.loadSnapshot()
        if let todos = try? await client.myTodos() { snapshot.todos = todos }
        if let orgId = AppGroupStore.selectedOrganizationId,
           let projectId = AppGroupStore.selectedProjectId,
           let items = try? await client.organizationProjectTodos(organizationId: orgId, projectId: projectId)
        {
            snapshot.projectTodos = items
            if var pulse = snapshot.projectPulse {
                pulse.openCount = items.filter(\.isOpen).count
                pulse.doneCount = items.filter { !$0.isOpen }.count
                snapshot.projectPulse = pulse
            }
        }
        snapshot.isAuthenticated = true
        snapshot.userLabel = session.user.shortDisplayLabel
        snapshot.updatedAt = Date()
        AppGroupStore.saveSnapshot(snapshot)
        WidgetCenter.shared.reloadAllTimelines()
        TrackerDeepLink.postSnapshotDidChange()
        return .result()
    }
}

// MARK: - Shortcuts discovery (helps chronod register interactive intents)

struct MFTrackerAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenLoginIntent(),
            phrases: [
                "Sign in to \(.applicationName)",
            ],
            shortTitle: "Sign In",
            systemImageName: "person.crop.circle"
        )
        AppShortcut(
            intent: OpenTrackerDestinationIntent(),
            phrases: [
                "Open \(.applicationName)",
                "Open \(.applicationName) tasks",
            ],
            shortTitle: "Open Tracker",
            systemImageName: "checklist"
        )
        AppShortcut(
            intent: ToggleFocusTimerIntent(),
            phrases: [
                "Toggle focus timer in \(.applicationName)",
            ],
            shortTitle: "Toggle Focus",
            systemImageName: "timer"
        )
        AppShortcut(
            intent: QuickAddOpenComposeIntent(),
            phrases: [
                "Quick add in \(.applicationName)",
            ],
            shortTitle: "Quick Add",
            systemImageName: "plus.circle"
        )
    }
}
