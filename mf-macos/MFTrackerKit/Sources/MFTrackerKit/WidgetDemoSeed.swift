import Foundation

/// Rich fake snapshot so Desktop / NC widgets and the menu bar show real structure
/// when the live API is empty or unreachable (local QA / gallery checks).
public enum WidgetDemoSeed {
    public static let organizationId = "demo-org"
    public static let projectId = "demo-project"
    public static let userId = "demo-user"

    /// True when the snapshot would render as empty zeros / "No project" / no chat cards.
    public static func isVisuallyEmpty(_ snapshot: WidgetSnapshot) -> Bool {
        snapshot.openTrackerTasks.isEmpty
            && snapshot.projectPulse == nil
            && snapshot.recentMessages.isEmpty
    }

    public static func makeSnapshot(now: Date = Date()) -> WidgetSnapshot {
        let cal = Calendar.current
        let start = cal.startOfDay(for: now)
        let yesterday = cal.date(byAdding: .day, value: -1, to: start) ?? now.addingTimeInterval(-86_400)
        let todayAfternoon = cal.date(bySettingHour: 17, minute: 0, second: 0, of: now) ?? now
        let tomorrow = cal.date(byAdding: .day, value: 1, to: start) ?? now.addingTimeInterval(86_400)
        let nextWeek = cal.date(byAdding: .day, value: 5, to: start) ?? now.addingTimeInterval(5 * 86_400)

        let todos: [UserTodo] = [
            UserTodo(
                id: "demo-todo-1",
                userID: userId,
                title: "Ship widget checklist polish",
                completed: false,
                dueAt: yesterday,
                createdAt: now.addingTimeInterval(-3 * 86_400)
            ),
            UserTodo(
                id: "demo-todo-2",
                userID: userId,
                title: "Review due-distribution bars",
                completed: false,
                dueAt: todayAfternoon,
                createdAt: now.addingTimeInterval(-2 * 86_400)
            ),
            UserTodo(
                id: "demo-todo-3",
                userID: userId,
                title: "Draft focus-timer notes",
                completed: false,
                dueAt: nextWeek,
                createdAt: now.addingTimeInterval(-86_400)
            ),
            UserTodo(
                id: "demo-todo-4",
                userID: userId,
                title: "Archive old personal list",
                completed: true,
                dueAt: yesterday,
                createdAt: now.addingTimeInterval(-7 * 86_400)
            ),
        ]

        let projectTodos: [OrganizationProjectTodo] = [
            OrganizationProjectTodo(
                id: "demo-issue-1",
                projectId: projectId,
                title: "Pulse ring % label",
                status: "OPEN",
                dueAt: todayAfternoon
            ),
            OrganizationProjectTodo(
                id: "demo-issue-2",
                projectId: projectId,
                title: "Chat notification cards",
                status: "OPEN",
                dueAt: tomorrow
            ),
            OrganizationProjectTodo(
                id: "demo-issue-3",
                projectId: projectId,
                title: "Quick Add intent dialog",
                status: "OPEN",
                dueAt: nil
            ),
            OrganizationProjectTodo(
                id: "demo-issue-4",
                projectId: projectId,
                title: "App Group snapshot race",
                status: "DONE",
                dueAt: yesterday
            ),
            OrganizationProjectTodo(
                id: "demo-issue-5",
                projectId: projectId,
                title: "Widget gallery install script",
                status: "DONE",
                dueAt: yesterday
            ),
        ]

        let messages: [OrganizationMessage] = [
            OrganizationMessage(
                id: "demo-msg-3",
                organizationID: organizationId,
                authorUserID: "demo-alex",
                authorNickname: "Alex",
                body: "Dashboard charts look good on Desktop Large.",
                createdAt: now.addingTimeInterval(-120)
            ),
            OrganizationMessage(
                id: "demo-msg-2",
                organizationID: organizationId,
                authorUserID: "demo-sam",
                authorNickname: "Sam",
                body: "Pulse ring hit 71% — shipping notes ready.",
                createdAt: now.addingTimeInterval(-900)
            ),
            OrganizationMessage(
                id: "demo-msg-1",
                organizationID: organizationId,
                authorUserID: "demo-jordan",
                authorNickname: "Jordan",
                body: "Reminder: pin Project Tracker Dashboard after install-debug.",
                createdAt: now.addingTimeInterval(-3_600)
            ),
        ]

        return WidgetSnapshot(
            todos: todos,
            projectTodos: projectTodos,
            projectPulse: ProjectPulse(
                projectId: projectId,
                projectName: "Core",
                organizationName: "MasterFabric Demo",
                openCount: projectTodos.filter(\.isOpen).count,
                doneCount: projectTodos.filter { !$0.isOpen }.count
            ),
            recentMessages: messages,
            chatOrganizationName: "MasterFabric Demo",
            lastReadMessageId: "demo-msg-1",
            unreadMessageCount: 2,
            taskScope: .personal,
            updatedAt: now,
            isAuthenticated: true,
            userLabel: "Demo"
        )
    }

    public static func makeFocusTimer(now: Date = Date()) -> FocusTimerState {
        FocusTimerState(
            durationSeconds: 25 * 60,
            remainingSeconds: 18 * 60,
            isRunning: true,
            endsAt: now.addingTimeInterval(18 * 60),
            selectedFocusTaskId: "personal:demo-todo-2",
            selectedFocusTaskTitle: "Review due-distribution bars",
            selectedFocusTaskScope: .personal
        )
    }
}
