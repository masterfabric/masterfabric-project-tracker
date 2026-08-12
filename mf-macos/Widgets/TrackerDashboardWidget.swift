import AppIntents
import MFTrackerKit
import SwiftUI
import WidgetKit

struct TrackerDashboardEntry: TimelineEntry {
    let date: Date
    let isAuthenticated: Bool
    let tasks: [TrackerTaskItem]
    let personalOpen: Int
    let projectOpen: Int
    let pulse: ProjectPulse?
    let timer: FocusTimerState
    let unreadChat: Int
    let updatedAt: Date
}

struct TrackerDashboardProvider: TimelineProvider {
    func placeholder(in context: Context) -> TrackerDashboardEntry { Self.sample }
    func getSnapshot(in context: Context, completion: @escaping (TrackerDashboardEntry) -> Void) {
        completion(Self.makeEntry())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<TrackerDashboardEntry>) -> Void) {
        let entry = Self.makeEntry()
        let seconds = entry.isAuthenticated ? 15 * 60.0 : MFTrackerConstants.signedOutWidgetRecheckSeconds
        let next = Date().addingTimeInterval(seconds)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private static var sample: TrackerDashboardEntry {
        TrackerDashboardEntry(
            date: Date(),
            isAuthenticated: true,
            tasks: [
                TrackerTaskItem(id: "personal:1", title: "Ship dashboard charts", isOpen: true, dueAt: Date(), scope: .personal),
                TrackerTaskItem(id: "project:2", title: "Review pulse ring", isOpen: true, dueAt: nil, scope: .project, projectName: "Core"),
            ],
            personalOpen: 5, projectOpen: 3,
            pulse: ProjectPulse(projectId: "p", projectName: "Core", organizationName: "MasterFabric", openCount: 3, doneCount: 12),
            timer: FocusTimerState(remainingSeconds: 18 * 60, isRunning: true),
            unreadChat: 2, updatedAt: Date()
        )
    }

    private static func makeEntry() -> TrackerDashboardEntry {
        AppGroupStore.flushSuiteToDisk()
        let snapshot = AppGroupStore.loadSnapshotForWidgets()
        let authenticated = snapshot.isAuthenticated || AppGroupStore.widgetIsAuthenticated
        guard authenticated else {
            return TrackerDashboardEntry(
                date: Date(),
                isAuthenticated: false,
                tasks: [],
                personalOpen: 0,
                projectOpen: 0,
                pulse: nil,
                timer: FocusTimerState(),
                unreadChat: 0,
                updatedAt: snapshot.updatedAt
            )
        }
        return TrackerDashboardEntry(
            date: Date(),
            isAuthenticated: true,
            tasks: Array(snapshot.openTrackerTasks.prefix(8)),
            personalOpen: snapshot.openTodos.count,
            projectOpen: snapshot.openProjectTodos.count,
            pulse: snapshot.projectPulse,
            timer: AppGroupStore.loadTimerForWidgets(),
            unreadChat: snapshot.unreadMessageCount,
            updatedAt: snapshot.updatedAt
        )
    }
}

struct TrackerDashboardWidget: Widget {
    let kind = "TrackerDashboardWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TrackerDashboardProvider()) { entry in
            TrackerDashboardView(entry: entry)
                .containerBackground(for: .widget) { TrackerWidgetGlassBackground() }
                .widgetURL(entry.isAuthenticated ? TrackerDeepLink.url(.dashboard) : TrackerDeepLink.url(.login))
        }
        .configurationDisplayName("Project Tracker Dashboard")
        .description("Medium: metrics + bars. Large: bars + sparkline + task list.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct TrackerDashboardView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TrackerDashboardEntry

    private var accent: Color { TrackerTheme.userAccent }
    private var done: Int { entry.pulse?.doneCount ?? 0 }
    private var openTotal: Int { entry.personalOpen + entry.projectOpen }

    var body: some View {
        Group {
            if !entry.isAuthenticated {
                Button(intent: OpenLoginIntent()) {
                    WidgetGraphics.SignInEmptyState(tint: accent, compact: family != .systemLarge)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } else {
                switch family {
                case .systemLarge:
                    largeBody
                default:
                    mediumBody
                }
            }
        }
        .padding(10)
    }

    /// Medium: bars + 2×2 short metrics (Me/Proj/Chat/Done) — no "Pe…" truncation.
    private var mediumBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                WidgetGraphics.IconHeader(
                    systemImage: "square.grid.2x2.fill",
                    title: "Dashboard",
                    tint: accent,
                    trailing: "\(openTotal)"
                )
                Spacer(minLength: 0)
                Button(intent: OpenTrackerDestinationIntent(destination: .dashboard)) {
                    Image(systemName: "arrow.up.right.circle.fill")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(accent)
                }
                .buttonStyle(.plain)
            }
            HStack(alignment: .center, spacing: 12) {
                WidgetGraphics.StackedMetricBars(
                    personal: entry.personalOpen,
                    project: entry.projectOpen,
                    done: done,
                    accent: accent,
                    height: 72
                )
                .frame(width: 108)
                metricsGrid
            }
            timerFooter
        }
    }

    /// Large: wide chart + list (compact empty, no void).
    private var largeBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                WidgetGraphics.IconHeader(
                    systemImage: "square.grid.2x2.fill",
                    title: "Dashboard",
                    tint: accent,
                    trailing: "\(openTotal)"
                )
                Spacer(minLength: 0)
                Button(intent: OpenTrackerDestinationIntent(destination: .dashboard)) {
                    Image(systemName: "arrow.up.right.circle.fill")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(accent)
                }
                .buttonStyle(.plain)
            }
            HStack(alignment: .center, spacing: 14) {
                WidgetGraphics.StackedMetricBars(
                    personal: entry.personalOpen,
                    project: entry.projectOpen,
                    done: done,
                    accent: accent,
                    height: 88
                )
                .frame(width: 140)
                VStack(alignment: .leading, spacing: 8) {
                    metricsGrid
                    WidgetGraphics.OpenDoneSparkline(
                        open: max(openTotal, 1),
                        done: max(done, 1),
                        accent: accent,
                        height: 24
                    )
                    timerFooter
                }
            }
            TrackerSectionDivider()
            Text("Open tasks")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            if entry.tasks.isEmpty {
                WidgetGraphics.EmptyGlyph(
                    systemImage: "checklist",
                    title: "Inbox clear",
                    subtitle: nil,
                    tint: accent,
                    compact: true
                )
            } else {
                ForEach(entry.tasks.prefix(6)) { task in
                    Button(intent: CompleteTodoIntent(todoId: task.id)) {
                        HStack(spacing: 6) {
                            WidgetGraphics.ChecklistMark(tint: TrackerTheme.scopeTint(task.scope))
                            Text(task.title).font(.caption).lineLimit(1)
                            Spacer(minLength: 0)
                            Image(systemName: task.scope == .project ? "folder.fill" : "person.fill")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(TrackerTheme.scopeTint(task.scope))
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    /// 2×2 grid with short words that always fit.
    private var metricsGrid: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                metricButton(
                    value: "\(entry.personalOpen)", label: "Me",
                    tint: TrackerTheme.personal, icon: "person.fill",
                    destination: .tasks
                )
                metricButton(
                    value: "\(entry.projectOpen)", label: "Proj",
                    tint: accent, icon: "folder.fill",
                    destination: .projects
                )
            }
            HStack(spacing: 8) {
                metricButton(
                    value: "\(entry.unreadChat)", label: "Chat",
                    tint: TrackerTheme.chat, icon: "bubble.left.fill",
                    destination: .chat
                )
                metricButton(
                    value: "\(done)", label: "Done",
                    tint: accent.opacity(0.75), icon: "checkmark.seal.fill",
                    destination: .projects
                )
            }
        }
    }

    private func metricButton(
        value: String,
        label: String,
        tint: Color,
        icon: String,
        destination: TrackerOpenDestination
    ) -> some View {
        Button(intent: OpenTrackerDestinationIntent(destination: destination)) {
            WidgetGraphics.GlanceNumber(
                value: value, label: label,
                tint: tint, icon: icon, compact: true
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var timerFooter: some View {
        Button(intent: ToggleFocusTimerIntent()) {
            HStack(spacing: 6) {
                Image(systemName: entry.timer.isRunning ? "timer.circle.fill" : "timer")
                    .foregroundStyle(TrackerTheme.focusTint(running: entry.timer.isRunning))
                Text(entry.timer.liveRemaining(at: entry.date).asDashboardClock)
                    .font(.caption.monospacedDigit().weight(.bold))
                    .foregroundStyle(entry.timer.isRunning ? TrackerTheme.userAccent : .primary)
                Spacer(minLength: 0)
                Text(entry.timer.isRunning ? "Pause" : "Start")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(TrackerTheme.focusTint(running: entry.timer.isRunning))
                Text(entry.updatedAt, style: .time)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private extension Int {
    var asDashboardClock: String { String(format: "%d:%02d", self / 60, self % 60) }
}
