import AppKit
import Combine
import MFTrackerKit
import SwiftUI

/// Shared stores created in `MFProjectTrackerApp.init` and consumed by `AppDelegate`.
enum AppBootstrap {
    static var session: SessionStore!
    static var dataStore: TrackerDataStore!
    static var timerStore: FocusTimerStore!
    static var accentStore: AccentPreferenceStore!
}

/// AppKit status item — SwiftUI `MenuBarExtra` labels clip multi-chip HStacks to the first icon.
@MainActor
final class MenuBarStatusItemController: NSObject {
    private let session: SessionStore
    private let dataStore: TrackerDataStore
    private let timerStore: FocusTimerStore
    private let accentStore: AccentPreferenceStore

    private var statusItem: NSStatusItem?
    private var popover: NSPopover?
    private var cancellables = Set<AnyCancellable>()
    private var focusTick: AnyCancellable?
    private var eventMonitor: Any?
    private var dashboardWindow: NSWindow?
    private var popoverToggleObserver: NSObjectProtocol?
    private var openDestinationObserver: NSObjectProtocol?
    private var focusSyncObserver: NSObjectProtocol?
    private var snapshotSyncObserver: NSObjectProtocol?
    private var loginInFlightObserver: NSObjectProtocol?
    private var loginInFlight = false

    init(
        session: SessionStore,
        dataStore: TrackerDataStore,
        timerStore: FocusTimerStore,
        accentStore: AccentPreferenceStore
    ) {
        self.session = session
        self.dataStore = dataStore
        self.timerStore = timerStore
        self.accentStore = accentStore
        super.init()
        installStatusItem()
        observe()
        refreshButton()
    }

    func tearDown() {
        focusTick?.cancel()
        cancellables.removeAll()
        if let popoverToggleObserver {
            DistributedNotificationCenter.default.removeObserver(popoverToggleObserver)
            self.popoverToggleObserver = nil
        }
        if let openDestinationObserver {
            DistributedNotificationCenter.default.removeObserver(openDestinationObserver)
            self.openDestinationObserver = nil
        }
        if let focusSyncObserver {
            DistributedNotificationCenter.default.removeObserver(focusSyncObserver)
            self.focusSyncObserver = nil
        }
        if let snapshotSyncObserver {
            DistributedNotificationCenter.default.removeObserver(snapshotSyncObserver)
            self.snapshotSyncObserver = nil
        }
        if let loginInFlightObserver {
            NotificationCenter.default.removeObserver(loginInFlightObserver)
            self.loginInFlightObserver = nil
        }
        removeEventMonitor()
        discardPopover(force: true)
        hideDesktopDashboard()
        if let statusItem {
            NSStatusBar.system.removeStatusItem(statusItem)
        }
        statusItem = nil
    }

    /// Blocks dismiss only while login HTTP is in flight — Sign In form stays dismissible.
    private var mustRetainPopover: Bool {
        loginInFlight || session.isLoggingIn
    }

    // MARK: - Status item

    private func installStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = item.button {
            button.imagePosition = .imageOnly
            button.imageScaling = .scaleProportionallyDown
            button.appearsDisabled = false
            button.target = self
            button.action = #selector(togglePopover(_:))
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
            button.setAccessibilityLabel("Project Tracker")
        }
        statusItem = item
    }

    private func observe() {
        session.objectWillChange
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.refreshButton() }
            .store(in: &cancellables)
        dataStore.objectWillChange
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.refreshButton() }
            .store(in: &cancellables)
        timerStore.objectWillChange
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.refreshButton()
                self?.syncFocusTick()
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: .mfOpenDesktopDashboard)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.openDesktopDashboard() }
            .store(in: &cancellables)

        // E2E / automation: `DistributedNotificationCenter` can open the popover
        // without unreliable menu-bar CG clicks (AX coords for extras are flaky).
        // Retain the observer token — otherwise the registration is dropped immediately.
        popoverToggleObserver = DistributedNotificationCenter.default.addObserver(
            forName: .mfToggleMenuBarPopover,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.togglePopover(nil)
        }

        openDestinationObserver = DistributedNotificationCenter.default.addObserver(
            forName: TrackerDeepLink.openDestinationName,
            object: nil,
            queue: .main
        ) { [weak self] note in
            let raw = (note.object as? String)
                ?? AppGroupStore.consumePendingOpenDestination()
            self?.handleOpenDestination(raw)
        }

        focusSyncObserver = DistributedNotificationCenter.default.addObserver(
            forName: TrackerDeepLink.focusTimerDidChangeName,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.timerStore.reloadFromAppGroup()
            self?.refreshButton()
            self?.syncFocusTick()
        }

        snapshotSyncObserver = DistributedNotificationCenter.default.addObserver(
            forName: TrackerDeepLink.snapshotDidChangeName,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            guard let self else { return }
            self.dataStore.hydrateFromSnapshot(AppGroupStore.loadSnapshot())
            Task { @MainActor in
                await self.dataStore.refreshAll()
                WidgetReloader.reload(aggressive: true)
            }
        }

        loginInFlightObserver = NotificationCenter.default.addObserver(
            forName: .mfLoginInFlight,
            object: nil,
            queue: .main
        ) { [weak self] note in
            self?.loginInFlight = (note.object as? String) == "1" || self?.session.isLoggingIn == true
        }

        session.objectWillChange
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                // Keep loginInFlight aligned even if LoginView remount skipped a notify.
                // Clear as soon as HTTP finishes — do not retain while Sign In form is idle.
                guard let self else { return }
                self.loginInFlight = self.session.isLoggingIn
            }
            .store(in: &cancellables)

        // Consume any pending deep link left by a widget while the app was launching.
        if let pending = AppGroupStore.consumePendingOpenDestination() {
            DispatchQueue.main.async { [weak self] in
                self?.handleOpenDestination(pending)
            }
        }

        syncFocusTick()
    }

    /// Widget `widgetURL` / App Intent destination → popover tab or Desktop Dashboard.
    func handleOpenDestination(_ raw: String?) {
        let destination = TrackerDeepLink.Destination(rawValue: (raw ?? "home").lowercased()) ?? .home
        AppGroupStore.pendingOpenDestination = nil
        NSApp.activate(ignoringOtherApps: true)

        switch destination {
        case .dashboard:
            // Don't yank Sign In mid-flight for a dashboard deep link.
            if mustRetainPopover { return }
            AppGroupStore.pendingPresentLogin = false
            openDesktopDashboard()
        case .login:
            // Already signed in — open Tasks, don't stack Sign In over authenticated chrome.
            if session.isAuthenticated && !session.isLoggingIn {
                AppGroupStore.pendingPresentLogin = false
                AppGroupStore.clearPendingLoginIntents()
                session.syncAuthToAppGroup()
                WidgetReloader.reload(aggressive: true)
                hideDesktopDashboard()
                ensurePopoverShown()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                    NotificationCenter.default.post(name: .mfSelectPopoverTab, object: "tasks")
                }
                return
            }
            AppGroupStore.pendingPresentLogin = true
            hideDesktopDashboard()
            ensurePopoverShown()
            // Fresh host may not have subscribed yet — flag + delayed notify.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                NotificationCenter.default.post(name: .mfPresentLogin, object: nil)
            }
        case .home, .tasks, .chat, .projects, .timer, .focus, .compose:
            if mustRetainPopover && !session.isAuthenticated {
                // Keep the single Sign In popover; ignore tab deep links until auth.
                hideDesktopDashboard()
                ensurePopoverShown()
                return
            }
            AppGroupStore.pendingPresentLogin = false
            hideDesktopDashboard()
            ensurePopoverShown()
            let tab = destination.popoverTabRawValue ?? "tasks"
            // Delay so a freshly hosted MenuBarRootView can subscribe.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                NotificationCenter.default.post(name: .mfSelectPopoverTab, object: tab)
                if destination == .compose {
                    NotificationCenter.default.post(name: .mfFocusComposeField, object: nil)
                }
            }
        }
    }

    /// Called from `AppDelegate` when Launch Services delivers `mfprojecttracker://…`.
    func handleDeepLinkURL(_ url: URL) {
        let destination = TrackerDeepLink.parse(url) ?? .home
        handleOpenDestination(destination.rawValue)
    }

    private func ensurePopoverShown() {
        NSApp.activate(ignoringOtherApps: true)
        if popover?.isShown == true { return }
        // Single path — never performClick + showPopover (that raced and orphaned a second popover).
        showPopover()
    }

    private func syncFocusTick() {
        focusTick?.cancel()
        guard timerStore.state.isRunning else {
            focusTick = nil
            return
        }
        focusTick = Timer.publish(every: 1, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.timerStore.tick()
                self?.refreshButton()
            }
    }

    private func refreshButton() {
        guard let button = statusItem?.button else { return }
        let image = MenuBarStripRenderer.image(
            authenticated: session.isAuthenticated,
            tasksOpen: dataStore.openPersonalTodos.count,
            chatUnread: min(dataStore.unreadChatCount, 99),
            projectsOpen: dataStore.openProjectTodos.count,
            focusRunning: timerStore.state.isRunning,
            focusRemaining: timerStore.state.displayString
        )
        button.image = image
        button.image?.isTemplate = false
        button.appearsDisabled = false
        button.contentTintColor = nil
        button.toolTip = accessibilityNarrative
        button.setAccessibilityTitle(accessibilityNarrative)
        statusItem?.length = NSStatusItem.variableLength
    }

    private var accessibilityNarrative: String {
        guard session.isAuthenticated else {
            return "Project Tracker, sign in"
        }
        var bits = [
            "Project Tracker",
            "\(dataStore.openPersonalTodos.count) personal open",
            "\(min(dataStore.unreadChatCount, 99)) unread chat",
            "\(dataStore.openProjectTodos.count) project open",
        ]
        if timerStore.state.isRunning {
            bits.append("focus \(timerStore.state.displayString) remaining")
        }
        return bits.joined(separator: ", ")
    }

    // MARK: - Popover

    @objc private func togglePopover(_ sender: Any?) {
        if let popover, popover.isShown {
            // Keep open only while login HTTP is in flight (avoids -999 mid-request).
            if mustRetainPopover { return }
            // User closed while on Sign In — treat like Cancel so deep links don't reopen it.
            if session.isPresentingLoginUI && !session.isLoggingIn {
                session.cancelLoginDraft()
            }
            closePopover()
            return
        }
        showPopover()
    }

    private func showPopover() {
        guard let button = statusItem?.button else { return }

        // Dashboard must not ghost under / beside the menu-bar popover (multi-monitor).
        hideDesktopDashboard()

        // Already visible — never allocate a second NSPopover (root cause of stacked Sign In + Tasks).
        if let existing = popover, existing.isShown {
            return
        }

        // Drop any closed/orphaned popover reference before creating a fresh host.
        discardPopover(force: true)

        let root = MenuBarRootView()
            .environmentObject(session)
            .environmentObject(dataStore)
            .environmentObject(timerStore)
            .environmentObject(accentStore)
            .frame(width: TrackerTheme.Chrome.popoverWidth)

        let hosting = NSHostingController(rootView: root)
        // Fixed size — fittingSize is often 0 before first layout in NSPopover.
        let width = TrackerTheme.Chrome.popoverWidth
        let height: CGFloat = 540
        hosting.view.frame = NSRect(x: 0, y: 0, width: width, height: height)

        let pop = NSPopover()
        pop.contentSize = NSSize(width: width, height: height)
        // applicationDefined: widgetURL activation must not auto-dismiss the popover
        // the way .transient does when another window briefly becomes key.
        pop.behavior = .applicationDefined
        pop.animates = true
        pop.contentViewController = hosting
        popover = pop

        NSApp.activate(ignoringOtherApps: true)
        // Anchor to the status item's button — follows the menu bar screen on multi-monitor.
        pop.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)

        installOutsideClickMonitor()
    }

    private func installOutsideClickMonitor() {
        removeEventMonitor()
        // Delay outside-click dismiss so the activating widget/URL click does not close us.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
            guard let self, self.popover?.isShown == true, self.eventMonitor == nil else { return }
            self.eventMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
                guard let self else { return }
                // Retain only while login HTTP is in flight — idle Sign In is dismissible.
                if self.mustRetainPopover { return }
                if self.session.isPresentingLoginUI && !self.session.isLoggingIn {
                    self.session.cancelLoginDraft()
                }
                self.closePopover()
            }
        }
    }

    private func removeEventMonitor() {
        if let eventMonitor {
            NSEvent.removeMonitor(eventMonitor)
            self.eventMonitor = nil
        }
    }

    private func closePopover() {
        if mustRetainPopover { return }
        discardPopover(force: false)
    }

    /// Tears down the current popover. `force` bypasses Sign In retain (app quit / replace).
    private func discardPopover(force: Bool) {
        if !force, mustRetainPopover { return }
        removeEventMonitor()
        if let popover {
            popover.performClose(nil)
        }
        self.popover = nil
    }

    // MARK: - Desktop dashboard (NSPopover has no SwiftUI openWindow)

    private func hideDesktopDashboard() {
        guard let dashboardWindow else { return }
        dashboardWindow.orderOut(nil)
    }

    private func openDesktopDashboard() {
        if mustRetainPopover { return }
        discardPopover(force: false)
        if let dashboardWindow, dashboardWindow.isVisible {
            positionDashboardOnStatusItemScreen(dashboardWindow)
            dashboardWindow.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let root = DesktopDashboardView()
            .environmentObject(session)
            .environmentObject(dataStore)
            .environmentObject(timerStore)
            .environmentObject(accentStore)

        let hosting = NSHostingController(rootView: root)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 420, height: 520),
            styleMask: [.titled, .closable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "Project Tracker Dashboard"
        window.contentViewController = hosting
        window.isReleasedWhenClosed = false
        DesktopDashboardWindowStyler.apply(to: window)
        positionDashboardOnStatusItemScreen(window)
        window.makeKeyAndOrderFront(nil)
        dashboardWindow = window
        NSApp.activate(ignoringOtherApps: true)
    }

    /// Place the floating dashboard on the same screen as the status item (not an orphan display).
    private func positionDashboardOnStatusItemScreen(_ window: NSWindow) {
        let screen = statusItem?.button?.window?.screen ?? NSScreen.main
        guard let visible = screen?.visibleFrame else {
            window.center()
            return
        }
        let size = window.frame.size
        let x = visible.midX - size.width / 2
        let y = visible.midY - size.height / 2
        window.setFrameOrigin(NSPoint(x: x, y: y))
    }
}

/// Renders the closed strip as a **dark capsule** with light glyphs (high contrast
/// next to other menu-bar items, independent of wallpaper luminance).
enum MenuBarStripRenderer {
    private static let rowHeight: CGFloat = 22
    private static let iconPointSize: CGFloat = 11
    private static let valueFont = NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .semibold)
    private static let guestFont = NSFont.systemFont(ofSize: 11, weight: .semibold)
    private static let sepFont = NSFont.systemFont(ofSize: 10, weight: .semibold)

    /// Capsule fill — koyu charcoal chip so white glyphs stay readable among status items.
    private static let capsuleFill = NSColor(calibratedWhite: 0.11, alpha: 0.98)
    private static let capsuleStroke = NSColor.white.withAlphaComponent(0.22)
    private static let glyphInk = NSColor.white
    private static let separatorInk = NSColor.white.withAlphaComponent(0.7)

    @MainActor
    static var statusTint: NSColor { .white }

    @MainActor
    static func image(
        authenticated: Bool,
        tasksOpen: Int,
        chatUnread: Int,
        projectsOpen: Int,
        focusRunning: Bool,
        focusRemaining: String
    ) -> NSImage {
        if !authenticated {
            let attr = NSAttributedString(
                string: "Sign in",
                attributes: [.font: guestFont, .foregroundColor: glyphInk]
            )
            let textSize = attr.size()
            let size = NSSize(width: ceil(textSize.width) + 14, height: rowHeight)
            return makeChip(size: size) { _ in
                attr.draw(at: NSPoint(x: 7, y: (rowHeight - textSize.height) / 2))
            }
        }

        var chips: [(symbol: String, value: String)] = [
            (TrackerTheme.Symbol.tasks, "\(tasksOpen)"),
            (chatUnread > 0 ? TrackerTheme.Symbol.chat : TrackerTheme.Symbol.chatQuiet, "\(chatUnread)"),
            (projectsOpen > 0 ? TrackerTheme.Symbol.projects : TrackerTheme.Symbol.projectsQuiet, "\(projectsOpen)"),
        ]
        if focusRunning {
            chips.append((TrackerTheme.Symbol.focus, focusRemaining))
        }

        let symbolConfig = NSImage.SymbolConfiguration(pointSize: iconPointSize, weight: .bold)
            .applying(NSImage.SymbolConfiguration(paletteColors: [glyphInk]))
        let valueAttrs: [NSAttributedString.Key: Any] = [
            .font: valueFont,
            .foregroundColor: glyphInk,
        ]
        let sep = NSAttributedString(string: "·", attributes: [
            .font: sepFont,
            .foregroundColor: separatorInk,
        ])

        struct LaidOutChip {
            let icon: NSImage
            let value: NSAttributedString
            let iconSize: NSSize
            let valueSize: NSSize
        }

        var laid: [LaidOutChip] = []
        for chip in chips {
            let base = NSImage(systemSymbolName: chip.symbol, accessibilityDescription: nil)
                ?? NSImage(size: NSSize(width: 12, height: 12))
            let icon = base.withSymbolConfiguration(symbolConfig) ?? base
            let value = NSAttributedString(string: chip.value, attributes: valueAttrs)
            laid.append(LaidOutChip(
                icon: icon,
                value: value,
                iconSize: icon.size,
                valueSize: value.size()
            ))
        }

        let chipGap: CGFloat = 3
        let padX: CGFloat = 8
        let sepPad: CGFloat = 4
        let sepSize = sep.size()
        var width = padX * 2
        for (i, c) in laid.enumerated() {
            if i > 0 { width += sepPad * 2 + sepSize.width }
            width += c.iconSize.width + chipGap + c.valueSize.width
        }

        let size = NSSize(width: ceil(width), height: rowHeight)
        return makeChip(size: size) { _ in
            var x = padX
            let midY = rowHeight / 2
            for (i, c) in laid.enumerated() {
                if i > 0 {
                    x += sepPad
                    sep.draw(at: NSPoint(x: x, y: midY - sepSize.height / 2))
                    x += sepSize.width + sepPad
                }
                let iconRect = NSRect(
                    x: x,
                    y: midY - c.iconSize.height / 2,
                    width: c.iconSize.width,
                    height: c.iconSize.height
                )
                c.icon.draw(
                    in: iconRect,
                    from: .zero,
                    operation: .sourceOver,
                    fraction: 1,
                    respectFlipped: true,
                    hints: nil
                )
                x += c.iconSize.width + chipGap
                c.value.draw(at: NSPoint(x: x, y: midY - c.valueSize.height / 2))
                x += c.valueSize.width
            }
        }
    }

    private static func makeChip(size: NSSize, draw: @escaping (NSRect) -> Void) -> NSImage {
        let img = NSImage(size: size, flipped: false) { bounds in
            let chip = bounds.insetBy(dx: 0.5, dy: 1)
            let path = NSBezierPath(roundedRect: chip, xRadius: 7, yRadius: 7)
            capsuleFill.setFill()
            path.fill()
            capsuleStroke.setStroke()
            path.lineWidth = 1
            path.stroke()
            draw(bounds)
            return true
        }
        // Original (colored) — dark capsule + white glyphs stay readable on any wallpaper.
        img.isTemplate = false
        return img
    }
}
