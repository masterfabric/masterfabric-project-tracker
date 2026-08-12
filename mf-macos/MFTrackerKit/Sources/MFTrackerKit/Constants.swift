import Foundation

public enum MFTrackerConstants {
    public static let appGroupID = "group.com.masterfabric.projectTracker"
    public static let expoDeepLink = URL(string: "masterfabricexpo://")!
    /// Same default as mf-expo / local.env (`EXPO_PUBLIC_GRAPHQL_URL`).
    public static let defaultGraphQLURL = URL(string: "http://127.0.0.1:8080/graphql")!
    public static let platform = "macos"
    /// Client app identity for mf-go (same registered client as Expo).
    public static let clientBundleID = "com.masterfabric.monoExpo"
    /// Particular key for org projects (same as `EXPO_PUBLIC_MF_PROJECT_TRACKER_PARTICULAR`).
    public static let projectTrackerParticularKey = "project_tracker"
    public static let projectTrackerCapability = "project.tracker.graphql"
    /// Shared Keychain access group (TeamID + App Group) so WidgetKit intents can read the session.
    /// Must match `keychain-access-groups` in App + Widgets entitlements (`4GW994398K` = DEVELOPMENT_TEAM).
    public static let keychainAccessGroup = "4GW994398K.group.com.masterfabric.projectTracker"

    /// Posted on the main `NotificationCenter` when a Keychain refresh fails and the session is cleared.
    public static let sessionExpiredNotification = Notification.Name(
        "com.masterfabric.projectTracker.macos.sessionExpired"
    )

    /// Desktop widgets often miss `reloadAllTimelines` after menu-bar login — signed-out
    /// timelines should re-query App Group within this window.
    public static let signedOutWidgetRecheckSeconds: TimeInterval = 20
}
