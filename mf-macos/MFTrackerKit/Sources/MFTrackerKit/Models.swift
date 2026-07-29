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
    public var projectPulse: ProjectPulse?
    public var updatedAt: Date

    public init(todos: [UserTodo] = [], projectPulse: ProjectPulse? = nil, updatedAt: Date = Date()) {
        self.todos = todos
        self.projectPulse = projectPulse
        self.updatedAt = updatedAt
    }

    public var openTodos: [UserTodo] {
        todos
            .filter { !$0.completed }
            .sorted { lhs, rhs in
                switch (lhs.dueAt, rhs.dueAt) {
                case let (l?, r?): return l < r
                case (_?, nil): return true
                case (nil, _?): return false
                case (nil, nil): return (lhs.title < rhs.title)
                }
            }
    }
}

public struct FocusTimerState: Codable, Equatable, Sendable {
    public var durationSeconds: Int
    public var remainingSeconds: Int
    public var isRunning: Bool
    public var endsAt: Date?

    public init(
        durationSeconds: Int = 25 * 60,
        remainingSeconds: Int = 25 * 60,
        isRunning: Bool = false,
        endsAt: Date? = nil
    ) {
        self.durationSeconds = durationSeconds
        self.remainingSeconds = remainingSeconds
        self.isRunning = isRunning
        self.endsAt = endsAt
    }

    public static let presets: [Int] = [25 * 60, 15 * 60, 5 * 60]

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
