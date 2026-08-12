import Foundation

/// Shared persistence for the menu bar app and WidgetKit extension.
/// App Group **UserDefaults suite only** (no App Group files — those deadlock under sandbox).
/// The menu-bar app must `suspendSuiteAccessForAppColdLaunch()` at the top of `App.init`
/// and `enableSuiteAccess()` in `applicationDidFinishLaunching` — suite/cfprefsd I/O
/// during cold `App.init` hangs forever waiting on the preferences daemon.
public enum AppGroupStore {
    public static let snapshotKey = "widgetSnapshot"
    public static let timerKey = "focusTimer"
    public static let selectedOrgKey = "selectedOrganizationId"
    public static let selectedProjectKey = "selectedProjectId"
    public static let taskScopeKey = "taskScope"
    public static let graphqlURLKey = "graphqlURL"
    public static let apiKeyKey = "mfApiKey"
    public static let bundleIDKey = "mfBundleID"
    public static let particularKeyKey = "mfProjectTrackerParticular"
    public static let accentPresetKey = "accentPreset"
    public static let demoSeedActiveKey = "demoSeedActive"
    public static let pendingOpenDestinationKey = "pendingOpenDestination"
    public static let pendingPresentLoginKey = "pendingPresentLogin"
    public static let authFlagKey = "widgetAuthAuthenticated"
    public static let authUserLabelKey = "widgetAuthUserLabel"

    /// Default on for WidgetKit; menu-bar app suspends during `App.init`.
    private static var suiteAccessEnabled = true

    public static func suspendSuiteAccessForAppColdLaunch() {
        suiteAccessEnabled = false
    }

    public static func enableSuiteAccess() {
        suiteAccessEnabled = true
    }

    public static var defaults: UserDefaults {
        UserDefaults(suiteName: MFTrackerConstants.appGroupID) ?? .standard
    }

    /// When true, widgets + menu bar keep demo snapshot until cleared or a non-empty live refresh wins.
    public static var demoSeedActive: Bool {
        get {
            if let raw = readString(key: demoSeedActiveKey) {
                return raw == "1" || raw.lowercased() == "true"
            }
            return false
        }
        set { writeString(newValue ? "1" : nil, key: demoSeedActiveKey) }
    }

    private static func writeData(_ data: Data, key: String) {
        guard suiteAccessEnabled else { return }
        defaults.set(data, forKey: key)
        CFPreferencesSetAppValue(key as CFString, data as CFData, MFTrackerConstants.appGroupID as CFString)
        flushSuiteToDisk()
    }

    private static func readData(key: String) -> Data? {
        guard suiteAccessEnabled else { return nil }
        // Prefer CFPreferences — warm WidgetKit UserDefaults caches miss host login writes.
        flushSuiteToDisk()
        if let cf = CFPreferencesCopyValue(
            key as CFString,
            MFTrackerConstants.appGroupID as CFString,
            kCFPreferencesCurrentUser,
            kCFPreferencesAnyHost
        ) as? Data, !cf.isEmpty {
            return cf
        }
        if let cf = CFPreferencesCopyAppValue(key as CFString, MFTrackerConstants.appGroupID as CFString) as? Data,
           !cf.isEmpty
        {
            return cf
        }
        if let suiteData = defaults.data(forKey: key), !suiteData.isEmpty {
            return suiteData
        }
        return nil
    }

    /// WidgetKit entry point — same bytes as the menu bar (`loadSnapshot`).
    /// Heals stale snapshots that predate `isAuthenticated` / missing auth flag so Desktop
    /// tiles do not stay on Sign in while Keychain still has a session.
    public static func loadSnapshotForWidgets() -> WidgetSnapshot {
        healAuthStateFromKeychainIfNeeded()
        return loadSnapshot()
    }

    /// WidgetKit timer entry point — same bytes as the menu bar (`loadTimer`).
    public static func loadTimerForWidgets() -> FocusTimerState {
        loadTimer()
    }

    private static func readString(key: String) -> String? {
        guard suiteAccessEnabled else { return nil }
        flushSuiteToDisk()
        if let cf = CFPreferencesCopyValue(
            key as CFString,
            MFTrackerConstants.appGroupID as CFString,
            kCFPreferencesCurrentUser,
            kCFPreferencesAnyHost
        ) as? String, !cf.isEmpty {
            return cf
        }
        if let cf = CFPreferencesCopyAppValue(key as CFString, MFTrackerConstants.appGroupID as CFString) as? String,
           !cf.isEmpty
        {
            return cf
        }
        if let suite = defaults.string(forKey: key), !suite.isEmpty {
            return suite
        }
        return nil
    }

    private static func writeString(_ value: String?, key: String) {
        guard suiteAccessEnabled else { return }
        if let value {
            defaults.set(value, forKey: key)
            CFPreferencesSetAppValue(key as CFString, value as CFString, MFTrackerConstants.appGroupID as CFString)
        } else {
            defaults.removeObject(forKey: key)
            CFPreferencesSetAppValue(key as CFString, nil, MFTrackerConstants.appGroupID as CFString)
        }
        flushSuiteToDisk()
    }

    /// Push suite writes to disk and invalidate in-process caches used by a warm appex.
    public static func flushSuiteToDisk() {
        guard suiteAccessEnabled else { return }
        defaults.synchronize()
        CFPreferencesAppSynchronize(MFTrackerConstants.appGroupID as CFString)
    }

    public static func saveSnapshot(_ snapshot: WidgetSnapshot) {
        guard let data = try? JSONEncoder.iso8601.encode(snapshot) else { return }
        writeData(data, key: snapshotKey)
        // Mirror auth bits as plain strings so WidgetKit can read them even if JSON decode lags.
        let flag = snapshot.isAuthenticated ? "1" : "0"
        if suiteAccessEnabled {
            defaults.set(flag, forKey: authFlagKey)
            CFPreferencesSetAppValue(authFlagKey as CFString, flag as CFString, MFTrackerConstants.appGroupID as CFString)
            if let label = snapshot.userLabel, !label.isEmpty {
                defaults.set(label, forKey: authUserLabelKey)
                CFPreferencesSetAppValue(
                    authUserLabelKey as CFString,
                    label as CFString,
                    MFTrackerConstants.appGroupID as CFString
                )
            } else {
                defaults.removeObject(forKey: authUserLabelKey)
                CFPreferencesSetAppValue(authUserLabelKey as CFString, nil, MFTrackerConstants.appGroupID as CFString)
            }
            flushSuiteToDisk()
        }
    }

    /// Signed-out empty snapshot — no zeros that look like a clear inbox, no leftover demo.
    public static func saveSignedOutSnapshot() {
        demoSeedActive = false
        saveSnapshot(WidgetSnapshot(updatedAt: Date(), isAuthenticated: false))
        saveTimer(FocusTimerState())
    }

    /// Prefer snapshot JSON; fall back to mirrored auth flag, then shared Keychain.
    /// Desktop chronod often keeps a July-era snapshot that never had `isAuthenticated`.
    public static var widgetIsAuthenticated: Bool {
        healAuthStateFromKeychainIfNeeded()
        let snapshot = loadSnapshot()
        if snapshot.isAuthenticated { return true }
        if let raw = readString(key: authFlagKey) {
            return raw == "1" || raw.lowercased() == "true"
        }
        return KeychainStore.loadSession() != nil
    }

    /// After suite access is enabled (post-`App.init`), or from WidgetKit timeline / intents:
    /// align App Group auth bits with the shared Keychain session.
    @discardableResult
    public static func healAuthStateFromKeychainIfNeeded() -> Bool {
        guard suiteAccessEnabled else { return false }
        flushSuiteToDisk()
        let hasSession = KeychainStore.loadSession() != nil
        var snapshot = loadSnapshot()
        let flagRaw = readString(key: authFlagKey)
        let flagAuthed = flagRaw == "1" || (flagRaw?.lowercased() == "true")
        let needsHeal = hasSession
            ? (!snapshot.isAuthenticated || !flagAuthed || snapshot.userLabel == nil)
            : (snapshot.isAuthenticated || flagAuthed)

        guard needsHeal else { return false }

        if hasSession {
            let session = KeychainStore.loadSession()
            snapshot.isAuthenticated = true
            if snapshot.userLabel == nil || snapshot.userLabel?.isEmpty == true {
                snapshot.userLabel = session?.user.shortDisplayLabel
            }
            snapshot.updatedAt = Date()
            saveSnapshot(snapshot)
        } else if snapshot.isAuthenticated || flagAuthed {
            // Signed-out: flip auth bits without wiping task lists here (menu bar owns wipe).
            snapshot.isAuthenticated = false
            snapshot.userLabel = nil
            snapshot.updatedAt = Date()
            saveSnapshot(snapshot)
        }
        flushSuiteToDisk()
        return true
    }

    /// Menu-bar bootstrap after `enableSuiteAccess()` — always rewrite auth flag.
    public static func syncAuthFlag(isAuthenticated: Bool, userLabel: String?) {
        guard suiteAccessEnabled else { return }
        var snapshot = loadSnapshot()
        snapshot.isAuthenticated = isAuthenticated
        snapshot.userLabel = isAuthenticated ? userLabel : nil
        snapshot.updatedAt = Date()
        saveSnapshot(snapshot)
        flushSuiteToDisk()
    }

    public static var widgetUserLabel: String? {
        let snapshot = loadSnapshot()
        if let label = snapshot.userLabel, !label.isEmpty { return label }
        return readString(key: authUserLabelKey)
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
        get { readString(key: selectedOrgKey) }
        set { writeString(newValue, key: selectedOrgKey) }
    }

    public static var selectedProjectId: String? {
        get { readString(key: selectedProjectKey) }
        set { writeString(newValue, key: selectedProjectKey) }
    }

    public static var taskScope: TrackerTaskScope {
        get {
            if let raw = readString(key: taskScopeKey),
               let scope = TrackerTaskScope(rawValue: raw)
            {
                return scope
            }
            return .personal
        }
        set {
            writeString(newValue.rawValue, key: taskScopeKey)
        }
    }

    /// Copy Info.plist + sync-env support files into the App Group suite when missing,
    /// so WidgetKit intents and the menu bar share GraphQL URL, API key, bundle id, and
    /// Particular key without a manual Settings visit.
    public static func seedFromBundleIfNeeded() {
        guard suiteAccessEnabled else { return }
        importSupportFilesIntoSuiteIfNeeded()
        if readString(key: graphqlURLKey) == nil,
           let plist = Bundle.main.object(forInfoDictionaryKey: "GRAPHQL_URL") as? String,
           let url = URL(string: plist), !plist.isEmpty
        {
            writeString(normalizedGraphQLURL(url).absoluteString, key: graphqlURLKey)
        }
        if readString(key: bundleIDKey) == nil,
           let plist = Bundle.main.object(forInfoDictionaryKey: "MF_CLIENT_BUNDLE_ID") as? String,
           !plist.isEmpty
        {
            writeString(plist, key: bundleIDKey)
        }
        if readString(key: apiKeyKey) == nil,
           let plist = Bundle.main.object(forInfoDictionaryKey: "MF_APP_API_KEY") as? String,
           !plist.isEmpty
        {
            writeString(plist, key: apiKeyKey)
        }
        if readString(key: particularKeyKey) == nil,
           let plist = Bundle.main.object(forInfoDictionaryKey: "MF_PROJECT_TRACKER_PARTICULAR") as? String,
           !plist.isEmpty
        {
            writeString(plist, key: particularKeyKey)
        }
    }

    /// Non-secret diagnostics for verify scripts — never log the key itself.
    public static var clientConfigPresence: (graphqlURL: Bool, bundleID: Bool, apiKey: Bool, particular: Bool) {
        (
            true,
            !clientBundleID.isEmpty,
            !(apiKey ?? "").isEmpty,
            !projectTrackerParticularKey.isEmpty
        )
    }

    public static var graphqlURL: URL {
        get {
            if let raw = resolveConfigString(suiteKey: graphqlURLKey, plistKey: "GRAPHQL_URL", supportFile: "graphqlURL"),
               let url = URL(string: raw)
            {
                return Self.normalizedGraphQLURL(url)
            }
            return MFTrackerConstants.defaultGraphQLURL
        }
        set {
            let normalized = Self.normalizedGraphQLURL(newValue).absoluteString
            writeString(normalized, key: graphqlURLKey)
            writeSupportFile(normalized, name: "graphqlURL")
        }
    }

    /// Match Expo local.env (`127.0.0.1`) — `localhost` often resolves differently on macOS.
    private static func normalizedGraphQLURL(_ url: URL) -> URL {
        guard var comps = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
        if comps.host == "localhost" {
            comps.host = "127.0.0.1"
            return comps.url ?? url
        }
        return url
    }

    public static var clientBundleID: String {
        get {
            if let raw = resolveConfigString(suiteKey: bundleIDKey, plistKey: "MF_CLIENT_BUNDLE_ID", supportFile: "mfBundleID") {
                return raw
            }
            return MFTrackerConstants.clientBundleID
        }
        set {
            writeString(newValue, key: bundleIDKey)
            writeSupportFile(newValue, name: "mfBundleID")
        }
    }

    public static var apiKey: String? {
        get {
            resolveConfigString(suiteKey: apiKeyKey, plistKey: "MF_APP_API_KEY", supportFile: "mfApiKey")
        }
        set {
            let trimmed = (newValue?.isEmpty == false) ? newValue : nil
            writeString(trimmed, key: apiKeyKey)
            writeSupportFile(trimmed, name: "mfApiKey")
        }
    }

    public static var projectTrackerParticularKey: String {
        get {
            if let raw = resolveConfigString(
                suiteKey: particularKeyKey,
                plistKey: "MF_PROJECT_TRACKER_PARTICULAR",
                supportFile: "mfProjectTrackerParticular"
            ) {
                return raw
            }
            return MFTrackerConstants.projectTrackerParticularKey
        }
        set {
            writeString(newValue, key: particularKeyKey)
            writeSupportFile(newValue, name: "mfProjectTrackerParticular")
        }
    }

    /// Suite → support JSON (sync-env, menu-bar only) → Info.plist. Support files are skipped
    /// while suite access is suspended (App.init) and inside WidgetKit (.appex) — macOS
    /// denies appex file reads under Group Containers Application Support.
    private static func resolveConfigString(suiteKey: String, plistKey: String, supportFile: String) -> String? {
        if let raw = readString(key: suiteKey), !raw.isEmpty {
            return raw
        }
        if suiteAccessEnabled, !isWidgetExtension, let file = readSupportFile(name: supportFile), !file.isEmpty {
            // Promote into suite so subsequent reads (including widgets) stay on UserDefaults.
            writeString(file, key: suiteKey)
            return file
        }
        if let plist = Bundle.main.object(forInfoDictionaryKey: plistKey) as? String, !plist.isEmpty {
            return plist
        }
        return nil
    }

    private static var isWidgetExtension: Bool {
        Bundle.main.bundleURL.pathExtension == "appex"
    }

    private static var supportDirectoryURL: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: MFTrackerConstants.appGroupID)?
            .appendingPathComponent("Library/Application Support/com.masterfabric.projectTracker", isDirectory: true)
    }

    private static func readSupportFile(name: String) -> String? {
        guard !isWidgetExtension, let dir = supportDirectoryURL else { return nil }
        let url = dir.appendingPathComponent("\(name).json")
        guard let data = try? Data(contentsOf: url),
              let raw = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty
        else { return nil }
        return raw
    }

    private static func writeSupportFile(_ value: String?, name: String) {
        guard suiteAccessEnabled, !isWidgetExtension, let dir = supportDirectoryURL else { return }
        let url = dir.appendingPathComponent("\(name).json")
        if let value, !value.isEmpty {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try? value.data(using: .utf8)?.write(to: url, options: .atomic)
        } else {
            try? FileManager.default.removeItem(at: url)
        }
    }

    private static func importSupportFilesIntoSuiteIfNeeded() {
        guard !isWidgetExtension else { return }
        let pairs: [(String, String)] = [
            (graphqlURLKey, "graphqlURL"),
            (bundleIDKey, "mfBundleID"),
            (apiKeyKey, "mfApiKey"),
            (particularKeyKey, "mfProjectTrackerParticular"),
        ]
        for (key, file) in pairs where readString(key: key) == nil {
            if let raw = readSupportFile(name: file) {
                writeString(raw, key: key)
            }
        }
    }

    /// Global accent / widget tint shared by Desktop Dashboard + WidgetKit.
    public static var accentPreset: TrackerAccentPreset {
        get {
            if let raw = readString(key: accentPresetKey),
               let preset = TrackerAccentPreset(rawValue: raw)
            {
                return preset
            }
            return .sky
        }
        set {
            writeString(newValue.rawValue, key: accentPresetKey)
        }
    }

    /// Widget intent / `widgetURL` destination consumed once when the menu bar app activates.
    public static var pendingOpenDestination: String? {
        get { readString(key: pendingOpenDestinationKey) }
        set { writeString(newValue, key: pendingOpenDestinationKey) }
    }

    @discardableResult
    public static func consumePendingOpenDestination() -> String? {
        let value = pendingOpenDestination
        pendingOpenDestination = nil
        return value
    }

    /// Set when a deep link / widget asks for the Sign In sheet before the popover hosts `MenuBarRootView`.
    public static var pendingPresentLogin: Bool {
        get {
            if let raw = readString(key: pendingPresentLoginKey) {
                return raw == "1" || raw.lowercased() == "true"
            }
            return false
        }
        set { writeString(newValue ? "1" : nil, key: pendingPresentLoginKey) }
    }

    @discardableResult
    public static func consumePendingPresentLogin() -> Bool {
        let value = pendingPresentLogin
        pendingPresentLogin = false
        return value
    }

    /// Drop deferred Sign In deep links / widget intents so Cancel is not undone on next popover open.
    public static func clearPendingLoginIntents() {
        pendingPresentLogin = false
        if pendingOpenDestination?.lowercased() == TrackerDeepLink.Destination.login.rawValue {
            pendingOpenDestination = nil
        }
    }
}
