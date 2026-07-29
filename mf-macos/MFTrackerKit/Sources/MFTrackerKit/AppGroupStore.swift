import Foundation

/// Shared persistence for the menu bar app and WidgetKit extension.
/// Uses Application Support (works without App Group signing). When the App Group
/// suite is available (signed builds), values are mirrored there as well.
public enum AppGroupStore {
    public static let snapshotKey = "widgetSnapshot"
    public static let timerKey = "focusTimer"
    public static let selectedOrgKey = "selectedOrganizationId"
    public static let selectedProjectKey = "selectedProjectId"
    public static let graphqlURLKey = "graphqlURL"
    public static let apiKeyKey = "mfApiKey"
    public static let bundleIDKey = "mfBundleID"

    public static var defaults: UserDefaults {
        UserDefaults(suiteName: MFTrackerConstants.appGroupID) ?? .standard
    }

    private static var supportDirectory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let dir = base.appendingPathComponent("com.masterfabric.projectTracker", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private static func fileURL(for key: String) -> URL {
        supportDirectory.appendingPathComponent("\(key).json")
    }

    private static func writeData(_ data: Data, key: String) {
        try? data.write(to: fileURL(for: key), options: .atomic)
        defaults.set(data, forKey: key)
    }

    private static func readData(key: String) -> Data? {
        if let fileData = try? Data(contentsOf: fileURL(for: key)) {
            return fileData
        }
        return defaults.data(forKey: key)
    }

    public static func saveSnapshot(_ snapshot: WidgetSnapshot) {
        guard let data = try? JSONEncoder.iso8601.encode(snapshot) else { return }
        writeData(data, key: snapshotKey)
    }

    public static func loadSnapshot() -> WidgetSnapshot {
        guard let data = readData(key: snapshotKey),
              let snapshot = try? JSONDecoder.iso8601.decode(WidgetSnapshot.self, from: data)
        else {
            return WidgetSnapshot()
        }
        return snapshot
    }

    public static func saveTimer(_ state: FocusTimerState) {
        guard let data = try? JSONEncoder.iso8601.encode(state) else { return }
        writeData(data, key: timerKey)
    }

    public static func loadTimer() -> FocusTimerState {
        guard let data = readData(key: timerKey),
              let state = try? JSONDecoder.iso8601.decode(FocusTimerState.self, from: data)
        else {
            return FocusTimerState()
        }
        return state
    }

    public static var selectedOrganizationId: String? {
        get {
            defaults.string(forKey: selectedOrgKey)
                ?? (try? String(contentsOf: fileURL(for: selectedOrgKey), encoding: .utf8))
        }
        set {
            defaults.set(newValue, forKey: selectedOrgKey)
            if let newValue {
                try? newValue.write(to: fileURL(for: selectedOrgKey), atomically: true, encoding: .utf8)
            } else {
                try? FileManager.default.removeItem(at: fileURL(for: selectedOrgKey))
            }
        }
    }

    public static var selectedProjectId: String? {
        get {
            defaults.string(forKey: selectedProjectKey)
                ?? (try? String(contentsOf: fileURL(for: selectedProjectKey), encoding: .utf8))
        }
        set {
            defaults.set(newValue, forKey: selectedProjectKey)
            if let newValue {
                try? newValue.write(to: fileURL(for: selectedProjectKey), atomically: true, encoding: .utf8)
            } else {
                try? FileManager.default.removeItem(at: fileURL(for: selectedProjectKey))
            }
        }
    }

    public static var graphqlURL: URL {
        get {
            if let raw = defaults.string(forKey: graphqlURLKey), let url = URL(string: raw) {
                return url
            }
            if let raw = try? String(contentsOf: fileURL(for: graphqlURLKey), encoding: .utf8),
               let url = URL(string: raw)
            {
                return url
            }
            if let plist = Bundle.main.object(forInfoDictionaryKey: "GRAPHQL_URL") as? String,
               let url = URL(string: plist), !plist.isEmpty
            {
                return url
            }
            return MFTrackerConstants.defaultGraphQLURL
        }
        set {
            defaults.set(newValue.absoluteString, forKey: graphqlURLKey)
            try? newValue.absoluteString.write(to: fileURL(for: graphqlURLKey), atomically: true, encoding: .utf8)
        }
    }

    public static var clientBundleID: String {
        get {
            if let raw = defaults.string(forKey: bundleIDKey), !raw.isEmpty { return raw }
            if let raw = try? String(contentsOf: fileURL(for: bundleIDKey), encoding: .utf8), !raw.isEmpty {
                return raw
            }
            if let plist = Bundle.main.object(forInfoDictionaryKey: "MF_CLIENT_BUNDLE_ID") as? String, !plist.isEmpty {
                return plist
            }
            return MFTrackerConstants.clientBundleID
        }
        set {
            defaults.set(newValue, forKey: bundleIDKey)
            try? newValue.write(to: fileURL(for: bundleIDKey), atomically: true, encoding: .utf8)
        }
    }

    public static var apiKey: String? {
        get {
            if let raw = defaults.string(forKey: apiKeyKey), !raw.isEmpty { return raw }
            if let raw = try? String(contentsOf: fileURL(for: apiKeyKey), encoding: .utf8), !raw.isEmpty {
                return raw
            }
            if let plist = Bundle.main.object(forInfoDictionaryKey: "MF_APP_API_KEY") as? String, !plist.isEmpty {
                return plist
            }
            return nil
        }
        set {
            if let newValue, !newValue.isEmpty {
                defaults.set(newValue, forKey: apiKeyKey)
                try? newValue.write(to: fileURL(for: apiKeyKey), atomically: true, encoding: .utf8)
            } else {
                defaults.removeObject(forKey: apiKeyKey)
                try? FileManager.default.removeItem(at: fileURL(for: apiKeyKey))
            }
        }
    }
}
