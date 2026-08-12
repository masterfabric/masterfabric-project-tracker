import Foundation

public struct AuthUser: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let email: String
    public let displayName: String
    public let avatarURL: String
    public let role: String

    public init(id: String, email: String, displayName: String, avatarURL: String, role: String) {
        self.id = id
        self.email = email
        self.displayName = displayName
        self.avatarURL = avatarURL
        self.role = role
    }

    /// Compact label for menubar / chrome — nickname, email local-part, or "Signed in".
    public var shortDisplayLabel: String {
        let nick = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !nick.isEmpty, nick.caseInsensitiveCompare(email) != .orderedSame {
            return Self.truncate(nick, max: 22)
        }
        if let at = email.firstIndex(of: "@") {
            let local = String(email[..<at]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !local.isEmpty {
                return Self.truncate(local, max: 22)
            }
        }
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            return Self.truncate(trimmed, max: 22)
        }
        return "Signed in"
    }

    private static func truncate(_ value: String, max: Int) -> String {
        guard value.count > max else { return value }
        return String(value.prefix(max - 1)) + "…"
    }
}

public struct AuthSession: Codable, Equatable, Sendable {
    public var accessToken: String
    public var refreshToken: String
    public var expiresIn: Int
    public var user: AuthUser

    public init(accessToken: String, refreshToken: String, expiresIn: Int, user: AuthUser) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresIn = expiresIn
        self.user = user
    }
}

public struct UserTodo: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let userID: String
    public let title: String
    public var completed: Bool
    public let organizationID: String?
    public let assignedToUserID: String?
    public let dueAt: Date?
    public let createdAt: Date?
    public let updatedAt: Date?

    public init(
        id: String,
        userID: String,
        title: String,
        completed: Bool,
        organizationID: String? = nil,
        assignedToUserID: String? = nil,
        dueAt: Date? = nil,
        createdAt: Date? = nil,
        updatedAt: Date? = nil
    ) {
        self.id = id
        self.userID = userID
        self.title = title
        self.completed = completed
        self.organizationID = organizationID
        self.assignedToUserID = assignedToUserID
        self.dueAt = dueAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct Organization: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let description: String

    public init(id: String, name: String, description: String = "") {
        self.id = id
        self.name = name
        self.description = description
    }
}

public struct OrganizationProject: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let organizationId: String
    public let name: String
    public let description: String

    public init(id: String, organizationId: String, name: String, description: String) {
        self.id = id
        self.organizationId = organizationId
        self.name = name
        self.description = description
    }
}

public struct OrganizationProjectTodo: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let projectId: String
    public let title: String
    public let status: String
    public let dueAt: Date?

    public init(id: String, projectId: String, title: String, status: String, dueAt: Date? = nil) {
        self.id = id
        self.projectId = projectId
        self.title = title
        self.status = status
        self.dueAt = dueAt
    }

    public var isOpen: Bool { status.uppercased() == "OPEN" }
}

/// Unified row for menu bar + widgets (personal `myTodos` + Particular project todos).
public enum TrackerTaskScope: String, Codable, Sendable, CaseIterable, Identifiable {
    case personal
    case project

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .personal: return "Personal"
        case .project: return "Project"
        }
    }
}

public struct TrackerTaskItem: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let title: String
    public let isOpen: Bool
    public let dueAt: Date?
    public let scope: TrackerTaskScope
    public let projectName: String?
    public let organizationName: String?

    public init(
        id: String,
        title: String,
        isOpen: Bool,
        dueAt: Date? = nil,
        scope: TrackerTaskScope,
        projectName: String? = nil,
        organizationName: String? = nil
    ) {
        self.id = id
        self.title = title
        self.isOpen = isOpen
        self.dueAt = dueAt
        self.scope = scope
        self.projectName = projectName
        self.organizationName = organizationName
    }

    public var scopeBadge: String {
        switch scope {
        case .personal: return "Personal"
        case .project: return projectName ?? "Project"
        }
    }
}

public struct OrganizationMessage: Codable, Equatable, Sendable, Identifiable {
    public let id: String
    public let organizationID: String
    public let authorUserID: String
    public let authorNickname: String
    public let body: String
    public let createdAt: Date?

    public init(
        id: String,
        organizationID: String,
        authorUserID: String,
        authorNickname: String,
        body: String,
        createdAt: Date? = nil
    ) {
        self.id = id
        self.organizationID = organizationID
        self.authorUserID = authorUserID
        self.authorNickname = authorNickname
        self.body = body
        self.createdAt = createdAt
    }
}

public struct ProjectPulse: Codable, Equatable, Sendable {
    public var projectId: String
    public var projectName: String
    public var organizationName: String
    public var openCount: Int
    public var doneCount: Int

    public init(
        projectId: String,
        projectName: String,
        organizationName: String,
        openCount: Int,
        doneCount: Int
    ) {
        self.projectId = projectId
        self.projectName = projectName
        self.organizationName = organizationName
        self.openCount = openCount
        self.doneCount = doneCount
    }
}

public struct WidgetSnapshot: Codable, Equatable, Sendable {
    public var todos: [UserTodo]
    public var projectTodos: [OrganizationProjectTodo]
    public var projectPulse: ProjectPulse?
    public var recentMessages: [OrganizationMessage]
    public var chatOrganizationName: String?
    public var lastReadMessageId: String?
    /// Persisted unread count from the menu bar (full message list), not recomputed from
    /// the truncated `recentMessages` prefix — keeps WidgetKit aligned with MenuBarExtra.
    public var unreadMessageCount: Int
    public var taskScope: TrackerTaskScope
    public var updatedAt: Date
    /// Written by the menu bar with every snapshot so WidgetKit can show Sign In vs metrics.
    public var isAuthenticated: Bool
    /// Short nickname / email local-part for signed-in chrome (optional).
    public var userLabel: String?

    public init(
        todos: [UserTodo] = [],
        projectTodos: [OrganizationProjectTodo] = [],
        projectPulse: ProjectPulse? = nil,
        recentMessages: [OrganizationMessage] = [],
        chatOrganizationName: String? = nil,
        lastReadMessageId: String? = nil,
        unreadMessageCount: Int? = nil,
        taskScope: TrackerTaskScope = .personal,
        updatedAt: Date = Date(),
        isAuthenticated: Bool = false,
        userLabel: String? = nil
    ) {
        self.todos = todos
        self.projectTodos = projectTodos
        self.projectPulse = projectPulse
        self.recentMessages = recentMessages
        self.chatOrganizationName = chatOrganizationName
        self.lastReadMessageId = lastReadMessageId
        self.unreadMessageCount = unreadMessageCount
            ?? Self.computeUnread(messages: recentMessages, lastReadMessageId: lastReadMessageId)
        self.taskScope = taskScope
        self.updatedAt = updatedAt
        self.isAuthenticated = isAuthenticated
        self.userLabel = userLabel
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        todos = try c.decodeIfPresent([UserTodo].self, forKey: .todos) ?? []
        projectTodos = try c.decodeIfPresent([OrganizationProjectTodo].self, forKey: .projectTodos) ?? []
        projectPulse = try c.decodeIfPresent(ProjectPulse.self, forKey: .projectPulse)
        recentMessages = try c.decodeIfPresent([OrganizationMessage].self, forKey: .recentMessages) ?? []
        chatOrganizationName = try c.decodeIfPresent(String.self, forKey: .chatOrganizationName)
        lastReadMessageId = try c.decodeIfPresent(String.self, forKey: .lastReadMessageId)
        taskScope = try c.decodeIfPresent(TrackerTaskScope.self, forKey: .taskScope) ?? .personal
        updatedAt = try c.decodeIfPresent(Date.self, forKey: .updatedAt) ?? Date()
        isAuthenticated = try c.decodeIfPresent(Bool.self, forKey: .isAuthenticated) ?? false
        userLabel = try c.decodeIfPresent(String.self, forKey: .userLabel)
        if let stored = try c.decodeIfPresent(Int.self, forKey: .unreadMessageCount) {
            unreadMessageCount = stored
        } else {
            unreadMessageCount = Self.computeUnread(
                messages: recentMessages,
                lastReadMessageId: lastReadMessageId
            )
        }
    }

    private static func computeUnread(
        messages: [OrganizationMessage],
        lastReadMessageId: String?
    ) -> Int {
        guard !messages.isEmpty else { return 0 }
        guard let lastReadMessageId else { return messages.count }
        if let idx = messages.firstIndex(where: { $0.id == lastReadMessageId }) {
            return idx
        }
        return messages.count
    }

    public var openTodos: [UserTodo] {
        todos
            .filter { !$0.completed }
            .sorted(by: Self.dueSort)
    }

    public var openProjectTodos: [OrganizationProjectTodo] {
        projectTodos
            .filter(\.isOpen)
            .sorted(by: Self.projectDueSort)
    }

    public var openTrackerTasks: [TrackerTaskItem] {
        // Prefix scopes so personal + project never collide; drop duplicate ids
        // within each side (defensive — API / snapshot should already be unique).
        // Same title with different ids is real data and must remain visible.
        var seen = Set<String>()
        let personal = openTodos.compactMap { todo -> TrackerTaskItem? in
            let id = "personal:\(todo.id)"
            guard seen.insert(id).inserted else { return nil }
            return TrackerTaskItem(
                id: id,
                title: todo.title,
                isOpen: !todo.completed,
                dueAt: todo.dueAt,
                scope: .personal
            )
        }
        let project = openProjectTodos.compactMap { todo -> TrackerTaskItem? in
            let id = "project:\(todo.id)"
            guard seen.insert(id).inserted else { return nil }
            return TrackerTaskItem(
                id: id,
                title: todo.title,
                isOpen: todo.isOpen,
                dueAt: todo.dueAt,
                scope: .project,
                projectName: projectPulse?.projectName,
                organizationName: projectPulse?.organizationName ?? chatOrganizationName
            )
        }
        return (personal + project).sorted { lhs, rhs in
            switch (lhs.dueAt, rhs.dueAt) {
            case let (l?, r?): return l < r
            case (_?, nil): return true
            case (nil, _?): return false
            case (nil, nil): return lhs.title < rhs.title
            }
        }
    }

    public var openTaskCount: Int { openTrackerTasks.count }

    private static func dueSort(_ lhs: UserTodo, _ rhs: UserTodo) -> Bool {
        switch (lhs.dueAt, rhs.dueAt) {
        case let (l?, r?): return l < r
        case (_?, nil): return true
        case (nil, _?): return false
        case (nil, nil): return lhs.title < rhs.title
        }
    }

    private static func projectDueSort(_ lhs: OrganizationProjectTodo, _ rhs: OrganizationProjectTodo) -> Bool {
        switch (lhs.dueAt, rhs.dueAt) {
        case let (l?, r?): return l < r
        case (_?, nil): return true
        case (nil, _?): return false
        case (nil, nil): return lhs.title < rhs.title
        }
    }
}

public struct FocusTimerState: Codable, Equatable, Sendable {
    public var durationSeconds: Int
    public var remainingSeconds: Int
    public var isRunning: Bool
    public var endsAt: Date?
    /// Local UX only — which open task this focus session is linked to (not backend time tracking).
    public var selectedFocusTaskId: String?
    public var selectedFocusTaskTitle: String?
    public var selectedFocusTaskScope: TrackerTaskScope?

    public init(
        durationSeconds: Int = 25 * 60,
        remainingSeconds: Int = 25 * 60,
        isRunning: Bool = false,
        endsAt: Date? = nil,
        selectedFocusTaskId: String? = nil,
        selectedFocusTaskTitle: String? = nil,
        selectedFocusTaskScope: TrackerTaskScope? = nil
    ) {
        self.durationSeconds = durationSeconds
        self.remainingSeconds = remainingSeconds
        self.isRunning = isRunning
        self.endsAt = endsAt
        self.selectedFocusTaskId = selectedFocusTaskId
        self.selectedFocusTaskTitle = selectedFocusTaskTitle
        self.selectedFocusTaskScope = selectedFocusTaskScope
    }

    public static let presets: [Int] = [25 * 60, 15 * 60, 5 * 60]
    public static let defaultPresetSeconds = 25 * 60

    public var hasFocusTask: Bool {
        guard let id = selectedFocusTaskId, !id.isEmpty else { return false }
        return true
    }

    public var focusTaskDisplayTitle: String? {
        guard let title = selectedFocusTaskTitle?.trimmingCharacters(in: .whitespacesAndNewlines),
              !title.isEmpty
        else { return nil }
        return title
    }

    public func liveRemaining(at date: Date = Date()) -> Int {
        if isRunning, let endsAt {
            return max(0, Int(endsAt.timeIntervalSince(date)))
        }
        return max(0, remainingSeconds)
    }

    public var displayString: String {
        let remaining = liveRemaining()
        let minutes = remaining / 60
        let seconds = remaining % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
