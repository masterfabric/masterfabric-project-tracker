import AppKit
import MFTrackerKit
import SwiftUI
import WidgetKit

@main
struct MFProjectTrackerApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var session: SessionStore
    @StateObject private var dataStore: TrackerDataStore
    @StateObject private var timerStore = FocusTimerStore()
    @StateObject private var accentStore = AccentPreferenceStore()

    init() {
        // Suite/cfprefsd must not run during App.init — deadlocks before the run loop.
        AppGroupStore.suspendSuiteAccessForAppColdLaunch()

        let session = SessionStore()
        let dataStore = TrackerDataStore(session: session)
        let timerStore = FocusTimerStore()
        let accentStore = AccentPreferenceStore()
        _session = StateObject(wrappedValue: session)
        _dataStore = StateObject(wrappedValue: dataStore)
        _timerStore = StateObject(wrappedValue: timerStore)
        _accentStore = StateObject(wrappedValue: accentStore)

        AppBootstrap.session = session
        AppBootstrap.dataStore = dataStore
        AppBootstrap.timerStore = timerStore
        AppBootstrap.accentStore = accentStore

        // Info.plist only until didFinishLaunching enables the App Group suite.
        session.client.endpoint = AppGroupStore.graphqlURL

        WidgetReloader.reloadHandler = {
            Self.reloadAllWidgetTimelines()
        }
        // Desktop chronod often keeps a signed-out snapshot until a second reload lands
        // after cfprefsd has flushed the App Group suite from login / persistSnapshot.
        WidgetReloader.deferredReloadHandler = {
            // Desktop chronod often ignores the first reloadAllTimelines after App Group login.
            for delay in [0.4, 1.0, 2.5, 5.0] as [TimeInterval] {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    Self.reloadAllWidgetTimelines()
                }
            }
        }
        // Do not GraphQL-refresh here — suite is still suspended and missing X-API-Key
        // makes refreshTokens return TOKEN_INVALID ("Session expired"). AppDelegate seeds
        // then bootstraps after enableSuiteAccess().
    }

    /// Every widget kind + global reload — Desktop tiles ignore a bare reloadAllTimelines alone.
    private static let widgetKinds = [
        "TrackerDashboardWidget",
        "TasksDueWidget",
        "ChatNotificationsWidget",
        "ProjectPulseWidget",
        "FocusTimerWidget",
        "QuickAddWidget",
    ]

    static func reloadAllWidgetTimelines() {
        AppGroupStore.flushSuiteToDisk()
        for kind in widgetKinds {
            WidgetCenter.shared.reloadTimelines(ofKind: kind)
        }
        WidgetCenter.shared.reloadAllTimelines()
    }

    var body: some Scene {
        // Menu-bar-first: do not declare a SwiftUI Window scene. Launch Services /
        // widgetURL activation was ordering that Window front and dismissing the
        // transient menu-bar popover (Sign In / Tasks deep links looked broken).
        // Desktop Dashboard still opens on demand via AppKit in MenuBarStatusItemController.
        // Settings stay inside the popover — this Settings scene is an empty host for onOpenURL.
        Settings {
            EmptyView()
                .onOpenURL { url in
                    AppDelegate.shared?.handleDeepLinkURL(url)
                }
        }
    }
}

enum DesktopDashboardWindowStyler {
    static func apply(to window: NSWindow?) {
        guard let window else { return }
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.styleMask.insert(.fullSizeContentView)
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = false
        window.isMovableByWindowBackground = true
        window.level = .floating
        window.collectionBehavior.insert([.canJoinAllSpaces, .fullScreenAuxiliary])
        window.standardWindowButton(.closeButton)?.isHidden = true
        window.standardWindowButton(.miniaturizeButton)?.isHidden = true
        window.standardWindowButton(.zoomButton)?.isHidden = true
        if let content = window.contentView {
            content.wantsLayer = true
            content.layer?.backgroundColor = NSColor.clear.cgColor
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    static weak var shared: AppDelegate?

    private var statusItemController: MenuBarStatusItemController?
    private var pendingURLs: [URL] = []
    /// Accessory apps often skip becomeActive when a widget intent fires — poll App Group.
    private var pendingPoll: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        AppDelegate.shared = self
        NSApp.setActivationPolicy(.accessory)

        // LSUIElement + no always-on Window: register GetURL so widgetURL / open
        // still reaches us even when SwiftUI Settings has not materialized onOpenURL.
        NSAppleEventManager.shared().setEventHandler(
            self,
            andSelector: #selector(handleGetURLEvent(_:withReplyEvent:)),
            forEventClass: AEEventClass(kInternetEventClass),
            andEventID: AEEventID(kAEGetURL)
        )

        guard
            let session = AppBootstrap.session,
            let dataStore = AppBootstrap.dataStore,
            let timerStore = AppBootstrap.timerStore,
            let accentStore = AppBootstrap.accentStore
        else { return }
        AppGroupStore.enableSuiteAccess()
        AppGroupStore.seedFromBundleIfNeeded()
        session.client.endpoint = AppGroupStore.graphqlURL
        // Drop a stuck widget login intent left by a previous race (Desktop openURL).
        if session.isAuthenticated, AppGroupStore.pendingOpenDestination == "login" {
            AppGroupStore.clearPendingLoginIntents()
        }
        // Suite was suspended during App.init — force auth bits onto disk for WidgetKit.
        session.syncAuthToAppGroup()
        AppGroupStore.healAuthStateFromKeychainIfNeeded()
        // Presence only — never print the API key.
        let presence = AppGroupStore.clientConfigPresence
        NSLog(
            "[MFProjectTracker] client config graphqlURL=%@ bundleID=%@ apiKey=%@ particular=%@ auth=%@",
            presence.graphqlURL ? "set" : "missing",
            presence.bundleID ? "set" : "missing",
            presence.apiKey ? "set" : "missing",
            presence.particular ? "set" : "missing",
            session.isAuthenticated ? "1" : "0"
        )
        statusItemController = MenuBarStatusItemController(
            session: session,
            dataStore: dataStore,
            timerStore: timerStore,
            accentStore: accentStore
        )
        if session.isAuthenticated {
            dataStore.persistSnapshot()
            MFProjectTrackerApp.reloadAllWidgetTimelines()
            session.bootstrap()
            Task { @MainActor in
                await dataStore.refreshAll()
                session.syncAuthToAppGroup()
                MFProjectTrackerApp.reloadAllWidgetTimelines()
            }
        } else {
            dataStore.clearLocalStateForSignOut()
            MFProjectTrackerApp.reloadAllWidgetTimelines()
        }
        let buffered = pendingURLs
        pendingURLs.removeAll()
        for url in buffered {
            statusItemController?.handleDeepLinkURL(url)
        }
        // Recover App Group pending only after the status item exists.
        if let pending = AppGroupStore.consumePendingOpenDestination() {
            statusItemController?.handleOpenDestination(pending)
        }
        startPendingDestinationPoll()
    }

    func applicationWillTerminate(_ notification: Notification) {
        pendingPoll?.invalidate()
        pendingPoll = nil
        NSAppleEventManager.shared().removeEventHandler(
            forEventClass: AEEventClass(kInternetEventClass),
            andEventID: AEEventID(kAEGetURL)
        )
        statusItemController?.tearDown()
        statusItemController = nil
        AppDelegate.shared = nil
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls {
            handleDeepLinkURL(url)
        }
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        consumePendingWidgetDestination()
    }

    private func startPendingDestinationPoll() {
        pendingPoll?.invalidate()
        let timer = Timer(timeInterval: 0.6, repeats: true) { [weak self] _ in
            self?.consumePendingWidgetDestination()
        }
        timer.tolerance = 0.2
        RunLoop.main.add(timer, forMode: .common)
        pendingPoll = timer
    }

    private func consumePendingWidgetDestination() {
        DispatchQueue.main.async { [weak self] in
            guard let self, let controller = self.statusItemController else { return }
            guard let pending = AppGroupStore.pendingOpenDestination else { return }
            AppGroupStore.pendingOpenDestination = nil
            controller.handleOpenDestination(pending)
        }
    }

    @objc private func handleGetURLEvent(
        _ event: NSAppleEventDescriptor,
        withReplyEvent replyEvent: NSAppleEventDescriptor
    ) {
        guard
            let raw = event.paramDescriptor(forKeyword: keyDirectObject)?.stringValue,
            let url = URL(string: raw)
        else { return }
        handleDeepLinkURL(url)
    }

    func handleDeepLinkURL(_ url: URL) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard let statusItemController = self.statusItemController else {
                // Buffer only when the status item is not ready — writing pending AND
                // later handling the same URL raced and left pendingOpenDestination=login stuck.
                if let destination = TrackerDeepLink.parse(url) {
                    AppGroupStore.pendingOpenDestination = destination.rawValue
                    AppGroupStore.pendingPresentLogin = (destination == .login)
                }
                self.pendingURLs.append(url)
                return
            }
            // Clear stale pending so the 0.6s poll cannot re-fire login after we handle it.
            AppGroupStore.pendingOpenDestination = nil
            statusItemController.handleDeepLinkURL(url)
        }
    }
}
