import Foundation

public enum MFTrackerConstants {
    public static let appGroupID = "group.com.masterfabric.projectTracker"
    public static let expoDeepLink = URL(string: "masterfabricexpo://")!
    public static let defaultGraphQLURL = URL(string: "http://localhost:8080/graphql")!
    public static let platform = "macos"
    /// Client app identity for mf-go (must match a registered Project Tracker client app).
    public static let clientBundleID = "com.masterfabric.monoExpo"
}
