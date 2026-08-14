import Foundation

/// Deep links + distributed notifications shared by WidgetKit intents and the menu bar app.
public enum TrackerDeepLink {
    public static let scheme = "mfprojecttracker"

    public enum Destination: String, CaseIterable, Sendable {
        case home
        case tasks
        case chat
        case projects
        case timer
        case focus
        case dashboard
        case compose
        case login

        public var popoverTabRawValue: String? {
            switch self {
            case .tasks, .compose, .home: return "tasks"
            case .chat: return "chat"
            case .projects: return "projects"
            case .timer, .focus: return "timer"
            case .dashboard, .login: return nil
            }
        }
    }

    public static func url(_ destination: Destination) -> URL {
        URL(string: "\(scheme)://\(destination.rawValue)")!
    }

    public static func parse(_ url: URL) -> Destination? {
        guard url.scheme?.lowercased() == scheme else { return nil }
        let host = (url.host ?? "").lowercased()
        if let fromHost = Destination(rawValue: host) { return fromHost }
        let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")).lowercased()
        if let fromPath = Destination(rawValue: path) { return fromPath }
        return .home
    }

    /// Widget / intent → app: open popover or dashboard for a destination.
    public static let openDestinationName = Notification.Name(
        "com.masterfabric.projectTracker.macos.openDestination"
    )
    /// Widget focus toggle → app: reload `FocusTimerStore` from App Group.
    public static let focusTimerDidChangeName = Notification.Name(
        "com.masterfabric.projectTracker.macos.focusTimerDidChange"
    )
    /// Widget mutating intents → app: refresh GraphQL snapshot.
    public static let snapshotDidChangeName = Notification.Name(
        "com.masterfabric.projectTracker.macos.snapshotDidChange"
    )

    public static func postOpenDestination(_ destination: Destination) {
        AppGroupStore.pendingOpenDestination = destination.rawValue
        if destination == .login {
            AppGroupStore.pendingPresentLogin = true
        }
        DistributedNotificationCenter.default().postNotificationName(
            openDestinationName,
            object: destination.rawValue,
            userInfo: nil,
            deliverImmediately: true
        )
    }

    public static func postFocusTimerDidChange() {
        DistributedNotificationCenter.default().postNotificationName(
            focusTimerDidChangeName,
            object: nil,
            userInfo: nil,
            deliverImmediately: true
        )
    }

    public static func postSnapshotDidChange() {
        DistributedNotificationCenter.default().postNotificationName(
            snapshotDidChangeName,
            object: nil,
            userInfo: nil,
            deliverImmediately: true
        )
    }
}
