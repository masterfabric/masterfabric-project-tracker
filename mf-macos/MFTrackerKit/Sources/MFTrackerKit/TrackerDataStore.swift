import Combine
import Foundation

@MainActor
public final class TrackerDataStore: ObservableObject {
    @Published public var todos: [UserTodo] = []
    @Published public var projectTodos: [OrganizationProjectTodo] = []
    @Published public var organizations: [Organization] = []
    @Published public var projects: [OrganizationProject] = []
    @Published public var projectPulse: ProjectPulse?
    @Published public var selectedOrganizationId: String? = AppGroupStore.selectedOrganizationId
    @Published public var selectedProjectId: String? = AppGroupStore.selectedProjectId
    @Published public var taskScope: TrackerTaskScope = AppGroupStore.taskScope
    @Published public var isLoading = false
    @Published public var statusMessage: String?
    @Published public var draftTodoTitle = ""
    @Published public var messages: [OrganizationMessage] = []
    @Published public var draftChatBody = ""
    @Published public var lastReadMessageId: String? = AppGroupStore.loadSnapshot().lastReadMessageId

    private let session: SessionStore

    public init(session: SessionStore) {
        self.session = session
        // Menubar chips + widgets need data before the popover opens — hydrate from App Group.
        hydrateFromSnapshot(AppGroupStore.loadSnapshot())
    }

    /// Apply a persisted snapshot so closed menubar / cold start match the last refresh.
    public func hydrateFromSnapshot(_ snapshot: WidgetSnapshot) {
        todos = Self.uniqueById(snapshot.todos)
        projectTodos = Self.uniqueById(snapshot.projectTodos)
        projectPulse = snapshot.projectPulse
        messages = Self.uniqueById(snapshot.recentMessages)
        lastReadMessageId = snapshot.lastReadMessageId
        taskScope = snapshot.taskScope
    }

    public var openPersonalTodos: [UserTodo] {
        todos
            .filter { !$0.completed }
            .sorted { lhs, rhs in
                switch (lhs.dueAt, rhs.dueAt) {
                case let (l?, r?): return l < r
                case (_?, nil): return true
                case (nil, _?): return false
                case (nil, nil): return lhs.title < rhs.title
                }
            }
    }

    public var openProjectTodos: [OrganizationProjectTodo] {
        projectTodos
            .filter(\.isOpen)
            .sorted { lhs, rhs in
                switch (lhs.dueAt, rhs.dueAt) {
                case let (l?, r?): return l < r
                case (_?, nil): return true
                case (nil, _?): return false
                case (nil, nil): return lhs.title < rhs.title
                }
            }
    }

    /// Back-compat alias used by older UI call sites.
    public var openTodos: [UserTodo] { openPersonalTodos }

    public var openTrackerTasks: [TrackerTaskItem] {
        snapshotPreview().openTrackerTasks
    }

    public var openCount: Int {
        openPersonalTodos.count + openProjectTodos.count
    }

    public var selectedProjectName: String? {
        projects.first(where: { $0.id == selectedProjectId })?.name
    }

    public var selectedOrganizationName: String? {
        organizations.first(where: { $0.id == selectedOrganizationId })?.name
    }

    public var draftPlaceholder: String {
        switch taskScope {
        case .personal:
            return "New personal todo"
        case .project:
            if let name = selectedProjectName {
                return "New issue in \(name)"
            }
            return "New project issue"
        }
    }

    /// Chronological for chat UI (API returns newest-first).
    public var chatMessagesOldestFirst: [OrganizationMessage] {
        messages.sorted { lhs, rhs in
            switch (lhs.createdAt, rhs.createdAt) {
            case let (l?, r?): return l < r
            case (_?, nil): return true
            case (nil, _?): return false
            case (nil, nil): return lhs.id < rhs.id
            }
        }
    }

    public func setTaskScope(_ scope: TrackerTaskScope) {
        taskScope = scope
        AppGroupStore.taskScope = scope
        persistSnapshot()
    }

    public func refreshAll() async {
        guard session.isAuthenticated else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            try await session.withAuthRetry {
                async let fetchedTodos = session.client.myTodos()
                async let fetchedOrgs = session.client.myOrganizations()
                todos = Self.uniqueById(try await fetchedTodos)
                organizations = try await fetchedOrgs
            }
            if selectedOrganizationId == nil {
                selectedOrganizationId = organizations.first?.id
            }
            await refreshProjects()
            await refreshMessages()
            let live = snapshotPreview()
            // Demo stays only while explicitly flagged and live API is still empty.
            // Never auto-apply demo in DEBUG — that overwrote empty live counts and
            // made menu/widgets disagree with the operator's real inbox.
            if AppGroupStore.demoSeedActive, WidgetDemoSeed.isVisuallyEmpty(live) {
                applyDemoSeed()
                statusMessage = "Updated (demo data — live API empty)"
            } else {
                if AppGroupStore.demoSeedActive, !WidgetDemoSeed.isVisuallyEmpty(live) {
                    AppGroupStore.saveTimer(FocusTimerState())
                }
                AppGroupStore.demoSeedActive = false
                persistSnapshot()
                statusMessage = "Updated \(Self.timeFormatter.string(from: Date()))"
            }
        } catch {
            statusMessage = Self.friendlyError(error)
        }
    }

    public func refreshProjects() async {
        guard let orgId = selectedOrganizationId else {
            projects = []
            projectTodos = []
            projectPulse = nil
            return
        }
        do {
            let list = try await session.withAuthRetry {
                try await session.client.organizationProjects(organizationId: orgId)
            }
            projects = list
            if selectedProjectId == nil || !list.contains(where: { $0.id == selectedProjectId }) {
                selectedProjectId = list.first?.id
            }
            AppGroupStore.selectedOrganizationId = orgId
            AppGroupStore.selectedProjectId = selectedProjectId
            await refreshProjectTodos()
        } catch {
            projects = []
            projectTodos = []
            projectPulse = nil
            statusMessage = Self.friendlyError(error)
        }
    }

    public func refreshMessages() async {
        guard let orgId = selectedOrganizationId else {
            messages = []
            return
        }
        do {
            let list = try await session.withAuthRetry {
                try await session.client.organizationMessages(organizationId: orgId, limit: 40)
            }
            messages = list
        } catch {
            messages = []
            statusMessage = Self.friendlyError(error)
        }
    }

    public func refreshProjectTodos() async {
        guard let projectId = selectedProjectId,
              let project = projects.first(where: { $0.id == projectId })
        else {
            projectTodos = []
            projectPulse = nil
            return
        }
        do {
            let items = try await session.withAuthRetry {
                try await session.client.organizationProjectTodos(
                    organizationId: project.organizationId,
                    projectId: projectId
                )
            }
            projectTodos = Self.uniqueById(items)
            let orgName = organizations.first(where: { $0.id == project.organizationId })?.name ?? ""
            projectPulse = ProjectPulse(
                projectId: project.id,
                projectName: project.name,
                organizationName: orgName,
                openCount: items.filter(\.isOpen).count,
                doneCount: items.filter { !$0.isOpen }.count
            )
            AppGroupStore.selectedProjectId = projectId
            persistSnapshot()
        } catch {
            projectTodos = []
            projectPulse = nil
            statusMessage = Self.friendlyError(error)
        }
    }

    /// Kept for older call sites that only needed pulse counts.
    public func refreshProjectPulse() async {
        await refreshProjectTodos()
    }

    public func selectOrganization(_ id: String) async {
        selectedOrganizationId = id
        selectedProjectId = nil
        await refreshProjects()
        await refreshMessages()
        persistSnapshot()
    }

    public func selectProject(_ id: String) async {
        selectedProjectId = id
        await refreshProjectTodos()
    }

    public func toggleTodo(_ todo: UserTodo) async {
        do {
            let updated = try await session.withAuthRetry {
                try await session.client.updateTodo(id: todo.id, completed: !todo.completed)
            }
            if let idx = todos.firstIndex(where: { $0.id == todo.id }) {
                todos[idx] = updated
            }
            persistSnapshot()
        } catch {
            statusMessage = Self.friendlyError(error)
        }
    }

    public func toggleProjectTodo(_ todo: OrganizationProjectTodo) async {
        guard let orgId = selectedOrganizationId else { return }
        let nextStatus = todo.isOpen ? "DONE" : "OPEN"
        do {
            let updated = try await session.withAuthRetry {
                try await session.client.updateOrganizationProjectTodo(
                    organizationId: orgId,
                    todoId: todo.id,
                    status: nextStatus
                )
            }
            if let idx = projectTodos.firstIndex(where: { $0.id == todo.id }) {
                projectTodos[idx] = updated
            }
            if let pulse = projectPulse {
                projectPulse = ProjectPulse(
                    projectId: pulse.projectId,
                    projectName: pulse.projectName,
                    organizationName: pulse.organizationName,
                    openCount: projectTodos.filter(\.isOpen).count,
                    doneCount: projectTodos.filter { !$0.isOpen }.count
                )
            }
            persistSnapshot()
        } catch {
            statusMessage = Self.friendlyError(error)
        }
    }

    public func createDraftTodo() async -> Bool {
        let title = draftTodoTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return false }
        switch taskScope {
        case .personal:
            do {
                let created = try await session.withAuthRetry {
                    try await session.client.createTodo(title: title)
                }
                todos.insert(created, at: 0)
                draftTodoTitle = ""
                persistSnapshot()
                statusMessage = "Personal task added"
                return true
            } catch {
                statusMessage = Self.friendlyError(error)
                return false
            }
        case .project:
            guard let orgId = selectedOrganizationId, let projectId = selectedProjectId else {
                statusMessage = "Pick an organization project first"
                return false
            }
            do {
                let created = try await session.withAuthRetry {
                    try await session.client.createOrganizationProjectTodo(
                        organizationId: orgId,
                        projectId: projectId,
                        title: title
                    )
                }
                projectTodos.insert(created, at: 0)
                draftTodoTitle = ""
                if let pulse = projectPulse {
                    projectPulse = ProjectPulse(
                        projectId: pulse.projectId,
                        projectName: pulse.projectName,
                        organizationName: pulse.organizationName,
                        openCount: projectTodos.filter(\.isOpen).count,
                        doneCount: projectTodos.filter { !$0.isOpen }.count
                    )
                }
                persistSnapshot()
                statusMessage = "Project issue added"
                return true
            } catch {
                statusMessage = Self.friendlyError(error)
                return false
            }
        }
    }

    public func sendDraftChat() async {
        let body = draftChatBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty, let orgId = selectedOrganizationId else { return }
        do {
            let posted = try await session.withAuthRetry {
                try await session.client.postOrganizationMessage(organizationId: orgId, body: body)
            }
            messages.insert(posted, at: 0)
            draftChatBody = ""
            persistSnapshot()
            statusMessage = "Message sent"
        } catch {
            statusMessage = Self.friendlyError(error)
        }
    }

    public func markChatRead() {
        let newestId = messages.first?.id
        lastReadMessageId = newestId
        persistSnapshot()
    }

    public var unreadChatCount: Int {
        guard !messages.isEmpty else { return 0 }
        guard let lastReadMessageId else { return messages.count }
        if let idx = messages.firstIndex(where: { $0.id == lastReadMessageId }) {
            return idx
        }
        return messages.count
    }

    public func persistSnapshot() {
        AppGroupStore.taskScope = taskScope
        let snapshot = snapshotPreview()
        AppGroupStore.saveSnapshot(snapshot)
        WidgetReloader.reload()
    }

    /// Clears in-memory lists after logout so the popover never flashes stale metrics.
    public func clearLocalStateForSignOut() {
        todos = []
        projectTodos = []
        projectPulse = nil
        messages = []
        organizations = []
        projects = []
        lastReadMessageId = nil
        statusMessage = nil
        draftTodoTitle = ""
        draftChatBody = ""
        AppGroupStore.saveSignedOutSnapshot()
        WidgetReloader.reload()
    }

    /// Writes rich fake tasks / pulse / chat into the App Group so widgets render structure.
    /// Requires a signed-in session — never invents auth for signed-out widgets.
    public func applyDemoSeed() {
        guard session.isAuthenticated else {
            statusMessage = "Sign in before loading demo data"
            return
        }
        var snapshot = WidgetDemoSeed.makeSnapshot()
        snapshot.isAuthenticated = true
        snapshot.userLabel = session.session?.user.shortDisplayLabel
        let timer = WidgetDemoSeed.makeFocusTimer()
        AppGroupStore.demoSeedActive = true
        AppGroupStore.selectedOrganizationId = WidgetDemoSeed.organizationId
        AppGroupStore.selectedProjectId = WidgetDemoSeed.projectId
        AppGroupStore.taskScope = .personal
        AppGroupStore.saveSnapshot(snapshot)
        AppGroupStore.saveTimer(timer)
        selectedOrganizationId = WidgetDemoSeed.organizationId
        selectedProjectId = WidgetDemoSeed.projectId
        organizations = [
            Organization(
                id: WidgetDemoSeed.organizationId,
                name: "MasterFabric Demo",
                description: "Local widget QA org"
            ),
        ]
        projects = [
            OrganizationProject(
                id: WidgetDemoSeed.projectId,
                organizationId: WidgetDemoSeed.organizationId,
                name: "Core",
                description: "Demo project for pulse + issues"
            ),
        ]
        hydrateFromSnapshot(snapshot)
        statusMessage = "Demo widget data loaded"
        WidgetReloader.reload()
    }

    /// Clears the demo flag and reloads from the live API when signed in.
    public func clearDemoSeed() async {
        AppGroupStore.demoSeedActive = false
        AppGroupStore.saveTimer(FocusTimerState())
        if session.isAuthenticated {
            await refreshAll()
        } else {
            clearLocalStateForSignOut()
            statusMessage = "Demo data cleared"
        }
        WidgetReloader.reload()
    }

    private func snapshotPreview() -> WidgetSnapshot {
        WidgetSnapshot(
            todos: Self.uniqueById(todos),
            projectTodos: Self.uniqueById(projectTodos),
            projectPulse: projectPulse,
            // Keep the same window the menu bar fetches (organizationMessages limit: 40).
            recentMessages: Array(Self.uniqueById(messages).prefix(40)),
            chatOrganizationName: selectedOrganizationName,
            lastReadMessageId: lastReadMessageId,
            unreadMessageCount: unreadChatCount,
            taskScope: taskScope,
            updatedAt: Date(),
            isAuthenticated: session.isAuthenticated,
            userLabel: session.session?.user.shortDisplayLabel
        )
    }

    /// First occurrence wins — guards against duplicate ids from API or snapshot merge bugs.
    private static func uniqueById<T: Identifiable>(_ items: [T]) -> [T] where T.ID == String {
        var seen = Set<String>()
        return items.filter { seen.insert($0.id).inserted }
    }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter
    }()

    /// Turns opaque URLSession / system errors into one-line actionable messages (no config dumps).
    static func friendlyError(_ error: Error) -> String {
        if let gqlError = error as? GraphQLClientError {
            switch gqlError {
            case let .httpStatus(code, _) where code == 0 || (500...599).contains(code):
                return "mf-go is unreachable or unhealthy — try again shortly."
            case let .graphQL(messages):
                let joined = messages.joined(separator: " ").lowercased()
                if joined.contains("invalid") && (joined.contains("credential") || joined.contains("password") || joined.contains("email")) {
                    return "Invalid email or password."
                }
                if joined.contains("api key") || joined.contains("x-api-key") || joined.contains("client not registered") {
                    return "API key or Bundle ID rejected — check Settings → Server."
                }
                if let first = messages.first?.trimmingCharacters(in: .whitespacesAndNewlines), !first.isEmpty {
                    return String(first.prefix(120))
                }
                return gqlError.errorDescription ?? "Sign-in failed."
            default:
                return gqlError.errorDescription ?? error.localizedDescription
            }
        }
        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain {
            switch nsError.code {
            case NSURLErrorCancelled:
                return "Sign-in was interrupted — tap Sign In again."
            case NSURLErrorCannotConnectToHost, NSURLErrorCannotFindHost, NSURLErrorNetworkConnectionLost, NSURLErrorNotConnectedToInternet:
                return "Cannot reach mf-go — is the server running?"
            case NSURLErrorTimedOut:
                return "Request timed out — is mf-go running?"
            case NSURLErrorSecureConnectionFailed, NSURLErrorAppTransportSecurityRequiresSecureConnection:
                return "Secure connection blocked for local HTTP."
            default:
                return "Network error — try Sign In again."
            }
        }
        return error.localizedDescription
    }
}

/// Thin hook so the app target can call WidgetCenter without importing WidgetKit into the kit.
public enum WidgetReloader {
    public static var reloadHandler: (() -> Void)?
    /// Optional delayed second pass — Desktop chronod often ignores a single reloadAllTimelines.
    public static var deferredReloadHandler: (() -> Void)?

    public static func reload(aggressive: Bool = false) {
        AppGroupStore.flushSuiteToDisk()
        reloadHandler?()
        if aggressive {
            deferredReloadHandler?()
        }
    }
}
