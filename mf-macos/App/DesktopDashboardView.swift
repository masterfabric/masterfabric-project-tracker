import AppKit
import MFTrackerKit
import SwiftUI

/// Floating glass Desktop panel — glance metrics only.
/// Accent is chosen in **Settings → Appearance**, not here.
struct DesktopDashboardView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var dataStore: TrackerDataStore
    @EnvironmentObject private var timerStore: FocusTimerStore
    @EnvironmentObject private var accentStore: AccentPreferenceStore

    private var accent: Color { accentStore.color }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.bottom, 10)

            statusBlock
                .padding(.bottom, 8)

            if let pulse = dataStore.projectPulse {
                Label {
                    Text(Self.shortPulseCaption(pulse))
                        .lineLimit(1)
                        .truncationMode(.middle)
                } icon: {
                    Image(systemName: TrackerTheme.Symbol.projects)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .symbolRenderingMode(.hierarchical)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 8)
            }

            focusLine
                .padding(.bottom, dataStore.unreadChatCount > 0 ? 6 : 10)

            if dataStore.unreadChatCount > 0 {
                chatLine
                    .padding(.bottom, 10)
            }

            TrackerAccentHairline(accent: accent, opacity: 0.4)
                .padding(.horizontal, -2)
                .padding(.bottom, 8)

            HStack(spacing: 6) {
                TrackerThemeIcon(TrackerTheme.Symbol.tasks, tint: accent, glowing: false, size: 10)
                Text("Open tasks")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(TrackerTheme.readableSecondary)
                Spacer(minLength: 0)
                Text("\(dataStore.openCount)")
                    .font(.caption2.weight(.semibold).monospacedDigit())
                    .foregroundStyle(accent)
            }
            .padding(.bottom, 6)

            taskList
        }
        .padding(14)
        .frame(width: 400)
        .background {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(.ultraThinMaterial)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.42),
                            accent.opacity(0.28),
                            Color.white.opacity(0.08),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 0.9
                )
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .padding(8)
        .onAppear {
            timerStore.reloadFromAppGroup()
            if session.isAuthenticated {
                Task { await dataStore.refreshAll() }
            }
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            TrackerThemeIcon("square.grid.2x2.fill", tint: accent, size: 12)
            Text("Project Tracker")
                .font(.headline.weight(.semibold))
            Spacer(minLength: 0)
            HStack(spacing: 4) {
                TrackerThemeIcon(TrackerTheme.Symbol.tasks, tint: accent, glowing: false, size: 10)
                Text("\(dataStore.openCount)")
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(accent)
                Text("open")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Button {
                Task { await dataStore.refreshAll() }
            } label: {
                TrackerThemeIcon(
                    TrackerTheme.Symbol.refresh,
                    tint: accent.opacity(dataStore.isLoading ? 0.5 : 0.85),
                    glowing: false,
                    size: 12
                )
            }
            .buttonStyle(.borderless)
            .disabled(dataStore.isLoading)
            .help("Refresh")
            Button {
                // AppKit-hosted glance panel (not SwiftUI Window) — dismiss env is a no-op.
                for window in NSApp.windows where window.title.localizedCaseInsensitiveContains("Dashboard") {
                    window.orderOut(nil)
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.borderless)
            .help("Close")
            .accessibilityLabel("Close")
        }
    }

    private var statusBlock: some View {
        VStack(alignment: .leading, spacing: 5) {
            // Same chip order as the closed menu-bar strip: Personal · Chat · Project.
            TrackerMetricPair("Personal", value: "\(dataStore.openPersonalTodos.count)", tint: TrackerTheme.personal)
            TrackerMetricPair("Chat", value: "\(dataStore.unreadChatCount)", tint: TrackerTheme.chat)
            TrackerMetricPair("Project", value: "\(dataStore.openProjectTodos.count)", tint: TrackerTheme.projects)
            // One compact pulse row only when a project is selected and there is activity.
            if let pulse = dataStore.projectPulse, pulse.openCount + pulse.doneCount > 0 {
                TrackerMetricPair(
                    "Pulse",
                    value: "\(pulse.openCount) open · \(pulse.doneCount) done",
                    tint: accent
                )
            }
        }
    }

    /// Prefer project name; keep org short; never dump long verify/test titles.
    private static func shortPulseCaption(_ pulse: ProjectPulse) -> String {
        let project = clippedName(pulse.projectName, limit: 28)
        let org = clippedName(pulse.organizationName, limit: 22)
        if project.isEmpty { return org }
        if org.isEmpty { return project }
        return "\(org) · \(project)"
    }

    private static func clippedName(_ raw: String, limit: Int) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > limit else { return trimmed }
        let idx = trimmed.index(trimmed.startIndex, offsetBy: max(0, limit - 1))
        return String(trimmed[..<idx]) + "…"
    }

    private var focusLine: some View {
        HStack(spacing: 6) {
            TrackerThemeIcon(
                timerStore.state.isRunning ? TrackerTheme.Symbol.focusActive : TrackerTheme.Symbol.focus,
                tint: TrackerTheme.focusTint(running: timerStore.state.isRunning),
                glowing: false,
                size: 11
            )
            Text(timerStore.state.displayString)
                .font(.subheadline.monospacedDigit().weight(.semibold))
                .foregroundStyle(timerStore.state.isRunning ? accent : Color.primary)
            if let title = timerStore.state.selectedFocusTaskTitle, !title.isEmpty {
                Text("· \(title)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            } else {
                Text(timerStore.state.isRunning ? "· Focus" : "· Idle")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
    }

    private var chatLine: some View {
        HStack(spacing: 6) {
            TrackerThemeIcon(
                TrackerTheme.Symbol.chatUnread,
                tint: TrackerTheme.chat,
                size: 11
            )
            Text("\(dataStore.unreadChatCount) unread")
                .font(.caption.weight(.semibold))
                .foregroundStyle(TrackerTheme.chat)
            if let org = dataStore.selectedOrganizationName {
                Text("· \(org)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private var taskList: some View {
        if dataStore.openTrackerTasks.isEmpty {
            HStack(alignment: .top, spacing: 8) {
                TrackerThemeIcon(
                    TrackerTheme.Symbol.emptyTasks,
                    tint: accent.opacity(0.7),
                    glowing: false,
                    size: 13
                )
                Text("No open personal or project tasks")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
        } else {
            ScrollView {
                let tasks = Self.uniqueById(Array(dataStore.openTrackerTasks.prefix(10)))
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(tasks.enumerated()), id: \.element.id) { index, task in
                        TrackerTaskRow(
                            title: task.title,
                            scopeBadge: task.scopeBadge,
                            scope: task.scope,
                            dueAt: task.dueAt
                        )
                        if index < tasks.count - 1 {
                            TrackerSectionDivider()
                        }
                    }
                }
            }
            .frame(maxHeight: 280)
        }
    }

    /// Keeps ForEach identity stable if a bad snapshot ever repeats the same scoped id.
    private static func uniqueById(_ tasks: [TrackerTaskItem]) -> [TrackerTaskItem] {
        var seen = Set<String>()
        return tasks.filter { seen.insert($0.id).inserted }
    }
}
