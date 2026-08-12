import AppKit
import MFTrackerKit
import SwiftUI

/// Closed-strip canvas — flat iStat metrics: Tasks · Chat · Projects [· Focus].
/// Monochrome black ink for `NSStatusItem` template images (system adapts menu-bar contrast).
struct MenuBarStripCanvas: View {
    let authenticated: Bool
    let tasksOpen: Int
    let chatUnread: Int
    let projectsOpen: Int
    let focusRunning: Bool
    let focusRemaining: String

    var body: some View {
        Group {
            if authenticated {
                HStack(spacing: 0) {
                    chip(TrackerTheme.Symbol.tasks, "\(tasksOpen)")
                    separator
                    chip(
                        chatUnread > 0 ? TrackerTheme.Symbol.chat : TrackerTheme.Symbol.chatQuiet,
                        "\(chatUnread)"
                    )
                    separator
                    chip(
                        projectsOpen > 0 ? TrackerTheme.Symbol.projects : TrackerTheme.Symbol.projectsQuiet,
                        "\(projectsOpen)"
                    )
                    if focusRunning {
                        separator
                        chip(TrackerTheme.Symbol.focus, focusRemaining)
                    }
                }
                .padding(.horizontal, 2)
            } else {
                Text("Sign in")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundStyle(TrackerTheme.Strip.guestLabel)
                    .padding(.horizontal, 4)
            }
        }
        .frame(height: TrackerTheme.Strip.rowHeight)
        .padding(.vertical, 2)
        // Preview-only; live strip is AppKit dark capsule (MenuBarStripRenderer).
        .environment(\.colorScheme, .dark)
        .padding(.horizontal, 6)
        .background {
            Capsule(style: .continuous)
                .fill(Color.black.opacity(0.88))
        }
    }

    private var separator: some View {
        Text("·")
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(TrackerTheme.Strip.separator)
            .padding(.horizontal, 4)
    }

    private func chip(_ systemImage: String, _ value: String) -> some View {
        HStack(spacing: 3) {
            Image(systemName: systemImage)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(TrackerTheme.Strip.iconInk)
                .frame(height: 14)
            Text(value)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(TrackerTheme.Strip.chipValue())
        }
        .padding(.horizontal, 1)
    }
}

private enum MenuBarPopoverTab: String, CaseIterable, Identifiable {
    case tasks
    case chat
    case projects
    case timer

    var id: String { rawValue }

    var title: String {
        switch self {
        case .tasks: return "Tasks"
        case .chat: return "Chat"
        case .projects: return "Projects"
        case .timer: return "Timer"
        }
    }

    var systemImage: String {
        switch self {
        case .tasks: return TrackerTheme.Symbol.tasks
        case .chat: return TrackerTheme.Symbol.chatQuiet
        case .projects: return TrackerTheme.Symbol.projectsQuiet
        case .timer: return TrackerTheme.Symbol.focus
        }
    }
}

struct MenuBarRootView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var dataStore: TrackerDataStore
    @EnvironmentObject private var timerStore: FocusTimerStore
    @EnvironmentObject private var accentStore: AccentPreferenceStore
    @State private var showLogin = false
    @State private var selectedTab: MenuBarPopoverTab = .tasks
    @State private var showingSettings = false

    private var popoverWidth: CGFloat { TrackerTheme.Chrome.popoverWidth }
    private let contentHeight: CGFloat = 412
    private var pad: CGFloat { TrackerTheme.Chrome.sectionPadding }
    private var accent: Color { accentStore.color }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Rectangle()
                .fill(Color.primary.opacity(0.08))
                .frame(height: 1)

            // Exactly one body: Sign In XOR authenticated chrome XOR guest teaser.
            // Never stack LoginView under Tasks (orphan NSPopover was a separate bug).
            Group {
                if wantsLoginBody {
                    LoginView(isPresented: $showLogin)
                } else if session.isAuthenticated {
                    if showingSettings {
                        MenuBarSettingsPanel(onClose: { showingSettings = false })
                    } else {
                        VStack(alignment: .leading, spacing: 0) {
                            tabBar
                            Rectangle()
                                .fill(Color.primary.opacity(0.06))
                                .frame(height: 1)
                            tabContent
                                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        }
                    }
                } else {
                    signInBlock
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .frame(height: contentHeight)

            Rectangle()
                .fill(Color.primary.opacity(0.08))
                .frame(height: 1)
            footer
        }
        .frame(width: popoverWidth)
        .clipped()
        .onAppear {
            session.bootstrap()
            timerStore.reloadFromAppGroup()
            if AppGroupStore.consumePendingPresentLogin() {
                presentLogin()
            }
            // Already cleared session with a Session expired message — open inline Sign In.
            if !session.isAuthenticated,
               let error = session.lastError,
               error.localizedCaseInsensitiveContains("session expired")
            {
                presentLogin()
            }
            // Resume Sign In UI if a remount happened mid-login / with drafts.
            if session.isLoggingIn || (!session.loginDraftPassword.isEmpty && !session.isAuthenticated) {
                presentLogin()
            }
            syncLoginPresentationFlag()
            if session.isAuthenticated && !wantsLoginBody {
                Task { await dataStore.refreshAll() }
            }
        }
        .onChange(of: showLogin) { _, _ in
            syncLoginPresentationFlag()
        }
        .onReceive(NotificationCenter.default.publisher(for: .mfSelectPopoverTab)) { note in
            guard let raw = note.object as? String,
                  let tab = MenuBarPopoverTab(rawValue: raw)
            else { return }
            // Never yank Sign In away while login HTTP is in flight.
            if session.isLoggingIn { return }
            selectedTab = tab
            showingSettings = false
            showLogin = false
            syncLoginPresentationFlag()
        }
        .onChange(of: session.isAuthenticated) { _, authenticated in
            if authenticated {
                showLogin = false
                session.setPresentingLoginUI(false)
                Task {
                    await dataStore.refreshAll()
                    AppGroupStore.flushSuiteToDisk()
                    WidgetReloader.reload(aggressive: true)
                }
            } else {
                showingSettings = false
                // Avoid wiping a just-written login snapshot when login clears a stale
                // Keychain token (isLoggingIn) or a transient auth flip races refresh.
                if !session.isLoggingIn {
                    dataStore.clearLocalStateForSignOut()
                }
                if let error = session.lastError,
                   error.localizedCaseInsensitiveContains("session expired")
                {
                    presentLogin()
                }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: MFTrackerConstants.sessionExpiredNotification)) { _ in
            presentLogin()
        }
        .onReceive(NotificationCenter.default.publisher(for: .mfPresentLogin)) { _ in
            presentLogin()
        }
        .task(id: timerStore.state.isRunning) {
            guard timerStore.state.isRunning else { return }
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                timerStore.tick()
                WidgetReloader.reload()
            }
        }
    }

    /// Sign In form takes the body — never simultaneously with Tasks tabs.
    /// Driven by local `showLogin` / in-flight login only — do NOT OR `isPresentingLoginUI`
    /// (that made Cancel a no-op: showLogin=false still left wantsLoginBody true).
    private var wantsLoginBody: Bool {
        showLogin || session.isLoggingIn
    }

    private func presentLogin() {
        showingSettings = false
        showLogin = true
        session.setPresentingLoginUI(true)
    }

    private func syncLoginPresentationFlag() {
        session.setPresentingLoginUI(showLogin || session.isLoggingIn)
    }

    // MARK: - Tabs (icon-first, larger hit targets)

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(MenuBarPopoverTab.allCases) { tab in
                Button {
                    selectedTab = tab
                    showingSettings = false
                } label: {
                    VStack(spacing: 3) {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: tab.systemImage)
                                .font(.system(size: TrackerTheme.Chrome.tabIconGlyph, weight: .semibold))
                                .frame(width: 20, height: 20)
                            if tab == .chat, dataStore.unreadChatCount > 0 {
                                Circle()
                                    .fill(TrackerTheme.chat)
                                    .frame(width: 7, height: 7)
                                    .offset(x: 4, y: -2)
                            }
                        }
                        Text(tab.title)
                            .font(.system(size: 9, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .foregroundStyle(selectedTab == tab ? accent : Color.secondary.opacity(0.75))
                    .frame(maxWidth: .infinity)
                    .frame(height: TrackerTheme.Chrome.hitTarget + 8)
                    .contentShape(Rectangle())
                    .overlay(alignment: .bottom) {
                        Rectangle()
                            .fill(selectedTab == tab ? accent : Color.clear)
                            .frame(height: 2)
                    }
                }
                .buttonStyle(.plain)
                .help(tab.title)
                .accessibilityLabel(tab.title)
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 8)
        .padding(.bottom, 4)
    }

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .tasks:
            // Chrome + New + slices stay fixed; only the task list scrolls (avoids
            // scrollbar crowding the Today/Week/All row).
            VStack(alignment: .leading, spacing: 12) {
                tasksChrome
                QuickActionsSection(showsInnerHeader: false)
                TasksSection(showsInnerHeader: false)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            .padding(.horizontal, pad)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        case .chat:
            ChatSection(expanded: true, showsInnerHeader: true)
                .padding(.horizontal, pad)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        case .projects:
            ScrollView {
                ProjectsSection(showsInnerHeader: true)
                    .padding(.horizontal, pad)
                    .padding(.vertical, 12)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .scrollIndicators(.hidden)
        case .timer:
            ScrollView {
                FocusTimerSection(showsInnerHeader: true)
                    .padding(.horizontal, pad)
                    .padding(.vertical, 12)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
            }
            .scrollIndicators(.hidden)
        }
    }

    /// Minimal Tasks chrome — count + overdue only (no dense caption strip).
    private var tasksChrome: some View {
        HStack(spacing: 8) {
            TrackerThemeIcon(
                TrackerTheme.Symbol.tasks,
                tint: TrackerTheme.tasksTint(overdue: overdueOpenCount > 0),
                well: true,
                size: 12
            )
            Text("\(dataStore.openCount)")
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(.primary.opacity(0.85))
                .layoutPriority(1)
            Text("open")
                .font(.caption)
                .foregroundStyle(.tertiary)
                .lineLimit(1)
            if overdueOpenCount > 0 {
                Text("·")
                    .foregroundStyle(.quaternary)
                Text("\(overdueOpenCount)")
                    .font(.caption.weight(.bold).monospacedDigit())
                    .foregroundStyle(TrackerTheme.overdue)
                    .layoutPriority(1)
                Text("overdue")
                    .font(.caption)
                    .foregroundStyle(TrackerTheme.overdue.opacity(0.85))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(dataStore.openCount) open tasks\(overdueOpenCount > 0 ? ", \(overdueOpenCount) overdue" : "")")
    }

    private var overdueOpenCount: Int {
        let personal = dataStore.openPersonalTodos.filter {
            guard let due = $0.dueAt else { return false }
            return Calendar.current.startOfDay(for: due) < Calendar.current.startOfDay(for: Date())
        }.count
        let project = dataStore.openProjectTodos.filter {
            guard let due = $0.dueAt else { return false }
            return Calendar.current.startOfDay(for: due) < Calendar.current.startOfDay(for: Date())
        }.count
        return personal + project
    }

    // MARK: - Header / footer

    private var header: some View {
        HStack(alignment: .center, spacing: 6) {
            if showingSettings && !wantsLoginBody {
                MenuBarIconButton(
                    systemImage: TrackerTheme.Symbol.back,
                    tint: accent,
                    help: "Back"
                ) {
                    showingSettings = false
                }
                .accessibilityLabel("Back")
                Text("Settings")
                    .font(.headline.weight(.semibold))
                Spacer(minLength: 0)
            } else {
                Text("Tracker")
                    .font(.headline.weight(.semibold))
                    .layoutPriority(1)
                if session.isAuthenticated, !wantsLoginBody, let user = session.session?.user {
                    Text(user.shortDisplayLabel)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .layoutPriority(0)
                        .frame(minWidth: 0, maxWidth: 160, alignment: .leading)
                }
                Spacer(minLength: 8)
                if session.isAuthenticated && !wantsLoginBody {
                    MenuBarIconButton(
                        systemImage: TrackerTheme.Symbol.refresh,
                        tint: accent.opacity(dataStore.isLoading ? 0.4 : 0.95),
                        help: "Refresh",
                        disabled: dataStore.isLoading
                    ) {
                        Task { await dataStore.refreshAll() }
                    }
                    .layoutPriority(2)
                    .accessibilityLabel("Refresh")
                }
            }
        }
        .padding(.horizontal, pad)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
    }

    private var footer: some View {
        HStack(spacing: 4) {
            if session.isAuthenticated && !showingSettings && !wantsLoginBody {
                MenuBarIconButton(
                    systemImage: TrackerTheme.Symbol.signOut,
                    tint: Color.secondary,
                    help: "Sign Out"
                ) {
                    Task { await session.logout() }
                }
                .accessibilityLabel("Sign Out")
            }

            Spacer(minLength: 0)

            if session.isAuthenticated && !showingSettings && !wantsLoginBody,
               let status = dataStore.statusMessage, !status.isEmpty
            {
                Text(status)
                    .font(.caption2)
                    .foregroundStyle(.quaternary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .trailing)
                    .layoutPriority(0)
            } else if !session.isAuthenticated || wantsLoginBody {
                Text(statusText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }

            if session.isAuthenticated && !wantsLoginBody {
                MenuBarIconButton(
                    systemImage: TrackerTheme.Symbol.dashboard,
                    tint: accent.opacity(0.95),
                    help: "Desktop dashboard"
                ) {
                    openDesktopDashboard()
                }
                .accessibilityLabel("Desktop dashboard")

                MenuBarIconButton(
                    systemImage: TrackerTheme.Symbol.settings,
                    tint: showingSettings ? accent : accent.opacity(0.95),
                    help: showingSettings ? "Close settings" : "Settings",
                    emphasized: showingSettings
                ) {
                    showingSettings.toggle()
                }
                .accessibilityLabel(showingSettings ? "Close settings" : "Settings")
            }
        }
        .padding(.horizontal, pad - 2)
        .padding(.vertical, 6)
    }

    private var signInBlock: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Sign in")
                .font(.subheadline.weight(.semibold))
            Text("Same account as the mobile app.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button {
                presentLogin()
            } label: {
                Text("Sign In…")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(accent)
                    .frame(minHeight: TrackerTheme.Chrome.hitTarget)
                    .padding(.horizontal, 12)
                    .background {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(accent.opacity(0.12))
                    }
            }
            .buttonStyle(.plain)
            .keyboardShortcut(.defaultAction)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(pad)
    }

    private var statusText: String {
        if let status = dataStore.statusMessage, !status.isEmpty { return status }
        if let error = session.lastError, !error.isEmpty { return error }
        return "Ready"
    }

    private func openDesktopDashboard() {
        NotificationCenter.default.post(name: .mfOpenDesktopDashboard, object: nil)
        NSApp.activate(ignoringOtherApps: true)
    }
}

extension Notification.Name {
    static let mfOpenDesktopDashboard = Notification.Name("mfOpenDesktopDashboard")
    /// Posted via `DistributedNotificationCenter` so UI e2e can open the menu bar popover.
    static let mfToggleMenuBarPopover = Notification.Name("com.masterfabric.projectTracker.macos.toggleMenuBarPopover")
    /// Widget / deep link selected a popover tab (`object` = `tasks`|`chat`|`projects`|`timer`).
    static let mfSelectPopoverTab = Notification.Name("mfSelectPopoverTab")
    /// Widget Quick Add — focus the Tasks compose field after opening the popover.
    static let mfFocusComposeField = Notification.Name("mfFocusComposeField")
    /// Widget / deep link → show inline Sign In in the popover body.
    static let mfPresentLogin = Notification.Name("mfPresentLogin")
    /// `object` is `"1"` while login HTTP is in flight — only then must status item / outside-click retain the popover.
    static let mfLoginInFlight = Notification.Name("mfLoginInFlight")
}

/// Minimal flat icon control — ~30pt hit, no label clutter.
struct MenuBarIconButton: View {
    let systemImage: String
    var tint: Color = TrackerTheme.userAccent
    var help: String? = nil
    var disabled: Bool = false
    var emphasized: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: TrackerTheme.Chrome.iconButtonGlyph, weight: .semibold))
                .foregroundStyle(disabled ? tint.opacity(0.35) : tint)
                .frame(width: TrackerTheme.Chrome.hitTarget, height: TrackerTheme.Chrome.hitTarget)
                .contentShape(Rectangle())
                .background {
                    if emphasized {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(tint.opacity(0.12))
                    }
                }
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .help(help ?? "")
    }
}

/// Flat icon + title row.
struct MenuBarSectionHeader: View {
    let title: String
    let systemImage: String
    var tint: Color = TrackerTheme.userAccent
    var trailing: String? = nil
    var badge: String? = nil
    var badgeTint: Color = TrackerTheme.chat

    var body: some View {
        HStack(spacing: 8) {
            TrackerThemeIcon(systemImage, tint: tint, well: true, size: 12)
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.primary.opacity(0.85))
                .lineLimit(1)
                .layoutPriority(1)
            if let badge, !badge.isEmpty {
                Text(badge)
                    .font(.caption2.weight(.bold).monospacedDigit())
                    .foregroundStyle(badgeTint)
                    .lineLimit(1)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background {
                        Capsule(style: .continuous)
                            .fill(TrackerTheme.Chrome.badgeFill(badgeTint))
                    }
                    .layoutPriority(1)
            }
            Spacer(minLength: 4)
            if let trailing, !trailing.isEmpty {
                Text(trailing)
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(minWidth: 0, maxWidth: 140, alignment: .trailing)
                    .layoutPriority(0)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(minHeight: TrackerTheme.Chrome.rowMinHeight)
    }
}
