import Combine
import Foundation

@MainActor
public final class TrackerDataStore: ObservableObject {
    @Published public var todos: [UserTodo] = []
    @Published public var organizations: [Organization] = []
    @Published public var projects: [OrganizationProject] = []
    @Published public var projectPulse: ProjectPulse?
    @Published public var selectedOrganizationId: String? = AppGroupStore.selectedOrganizationId
    @Published public var selectedProjectId: String? = AppGroupStore.selectedProjectId
    @Published public var isLoading = false
    @Published public var statusMessage: String?
    @Published public var draftTodoTitle = ""

    private let session: SessionStore

    public init(session: SessionStore) {
        self.session = session
    }

    public var openTodos: [UserTodo] {
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

    public var openCount: Int { openTodos.count }

    public func refreshAll() async {
        guard session.isAuthenticated else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            try await session.withAuthRetry {
                todos = try await session.client.myTodos()
            }
            do {
                try await session.withAuthRetry {
                    organizations = try await session.client.myOrganizations()
                }
            } catch {
                organizations = []
                statusMessage = "Organizations unavailable: \(error.localizedDescription)"
            }
            if selectedOrganizationId == nil {
                selectedOrganizationId = organizations.first?.id
            }
            await refreshProjects()
            persistSnapshot()
            statusMessage = "Updated \(Self.timeFormatter.string(from: Date()))"
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func refreshProjects() async {
        guard let orgId = selectedOrganizationId else {
            projects = []
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
            await refreshProjectPulse()
        } catch {
            projects = []
            projectPulse = nil
            // Older mf-go builds may not expose organizationProjects — keep menu usable.
            if statusMessage == nil || statusMessage?.hasPrefix("Updated") == true {
                statusMessage = "Projects unavailable on this server"
            }
        }
    }

    public func refreshProjectPulse() async {
        guard let projectId = selectedProjectId,
              let project = projects.first(where: { $0.id == projectId })
        else {
            projectPulse = nil
            return
        }
        do {
            let items = try await session.withAuthRetry {
                try await session.client.organizationProjectTodos(projectId: projectId)
            }
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
            statusMessage = error.localizedDescription
        }
    }

    public func selectOrganization(_ id: String) async {
        selectedOrganizationId = id
        selectedProjectId = nil
        await refreshProjects()
    }

    public func selectProject(_ id: String) async {
        selectedProjectId = id
        await refreshProjectPulse()
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
            statusMessage = error.localizedDescription
        }
    }

    public func createDraftTodo() async {
        let title = draftTodoTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        do {
            let created = try await session.withAuthRetry {
                try await session.client.createTodo(title: title)
            }
            todos.insert(created, at: 0)
            draftTodoTitle = ""
            persistSnapshot()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    public func persistSnapshot() {
        let snapshot = WidgetSnapshot(
            todos: todos,
            projectPulse: projectPulse,
            updatedAt: Date()
        )
        AppGroupStore.saveSnapshot(snapshot)
        WidgetReloader.reload()
    }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter
    }()
}

/// Thin hook so the app target can call WidgetCenter without importing WidgetKit into the kit.
public enum WidgetReloader {
    public static var reloadHandler: (() -> Void)?
    public static func reload() { reloadHandler?() }
}
