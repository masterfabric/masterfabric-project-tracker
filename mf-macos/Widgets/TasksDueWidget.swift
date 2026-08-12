import AppIntents
import MFTrackerKit
import SwiftUI
import WidgetKit

struct TasksEntry: TimelineEntry {
    let date: Date
    let isAuthenticated: Bool
    let tasks: [TrackerTaskItem]
    let personalOpen: Int
    let projectOpen: Int
    let projectName: String?
    let overdue: Int
    let dueToday: Int
    let later: Int
    let undated: Int
}

struct TasksDueProvider: TimelineProvider {
    func placeholder(in context: Context) -> TasksEntry { Self.sample }
    func getSnapshot(in context: Context, completion: @escaping (TasksEntry) -> Void) {
        completion(Self.makeEntry())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<TasksEntry>) -> Void) {
        let entry = Self.makeEntry()
        let seconds = entry.isAuthenticated ? 15 * 60.0 : MFTrackerConstants.signedOutWidgetRecheckSeconds
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(seconds))))
    }

    private static var sample: TasksEntry {
        TasksEntry(
            date: Date(),
            isAuthenticated: true,
            tasks: [
                TrackerTaskItem(id: "personal:1", title: "Ship checklist widget", isOpen: true, dueAt: Date(), scope: .personal),
                TrackerTaskItem(id: "project:2", title: "Due distribution bars", isOpen: true, dueAt: nil, scope: .project, projectName: "Core"),
            ],
            personalOpen: 3, projectOpen: 2, projectName: "Core",
            overdue: 1, dueToday: 2, later: 1, undated: 1
        )
    }

    private static func makeEntry() -> TasksEntry {
        AppGroupStore.flushSuiteToDisk()
        let snapshot = AppGroupStore.loadSnapshotForWidgets()
        let authenticated = snapshot.isAuthenticated || AppGroupStore.widgetIsAuthenticated
        guard authenticated else {
            return TasksEntry(
                date: Date(),
                isAuthenticated: false,
                tasks: [],
                personalOpen: 0,
                projectOpen: 0,
                projectName: nil,
                overdue: 0, dueToday: 0, later: 0, undated: 0
            )
        }
        let tasks = Array(snapshot.openTrackerTasks.prefix(10))
        let cal = Calendar.current
        let start = cal.startOfDay(for: Date())
        let end = cal.date(byAdding: .day, value: 1, to: start) ?? start
        var overdue = 0, today = 0, later = 0, undated = 0
        for t in snapshot.openTrackerTasks {
            guard let due = t.dueAt else { undated += 1; continue }
            if due < start { overdue += 1 }
            else if due < end { today += 1 }
            else { later += 1 }
        }
        return TasksEntry(
            date: Date(),
            isAuthenticated: true,
            tasks: tasks,
            personalOpen: snapshot.openTodos.count,
            projectOpen: snapshot.openProjectTodos.count,
            projectName: snapshot.projectPulse?.projectName,
            overdue: overdue, dueToday: today, later: later, undated: undated
        )
    }
}

struct TasksDueWidget: Widget {
    let kind = "TasksDueWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TasksDueProvider()) { entry in
            TasksDueView(entry: entry)
                .containerBackground(for: .widget) { TrackerWidgetGlassBackground() }
                .widgetURL(entry.isAuthenticated ? TrackerDeepLink.url(.tasks) : TrackerDeepLink.url(.login))
        }
        .configurationDisplayName("Project Tracker Tasks")
        .description("Small: glance counts. Medium/Large: due bars + checklist.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct TasksDueView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TasksEntry
    private var accent: Color { TrackerTheme.userAccent }
    private var total: Int { entry.personalOpen + entry.projectOpen }

    var body: some View {
        Group {
            if !entry.isAuthenticated {
                Button(intent: OpenLoginIntent()) {
                    WidgetGraphics.SignInEmptyState(tint: accent, compact: family == .systemSmall)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } else {
                switch family {
                case .systemSmall: smallBody
                case .systemLarge: largeBody
                default: mediumBody
                }
            }
        }
        .padding(10)
    }

    /// Small = icon + big numbers only (no essay / no "Tod…" chips).
    private var smallBody: some View {
        VStack(alignment: .leading, spacing: 10) {
            WidgetGraphics.IconHeader(
                systemImage: "checklist",
                title: "Tasks",
                tint: accent,
                trailing: "\(total)"
            )
            HStack(spacing: 6) {
                WidgetGraphics.IconCount(
                    systemImage: "person.fill",
                    value: entry.personalOpen,
                    tint: TrackerTheme.personal,
                    accessibilityName: "Personal"
                )
                WidgetGraphics.IconCount(
                    systemImage: "folder.fill",
                    value: entry.projectOpen,
                    tint: accent,
                    accessibilityName: "Project"
                )
            }
            HStack(spacing: 6) {
                dueIcon("exclamationmark.triangle.fill", entry.overdue, TrackerTheme.danger, "Late")
                dueIcon("sun.max.fill", entry.dueToday, accent, "Today")
                dueIcon("calendar", entry.later, accent.opacity(0.75), "Soon")
            }
            Spacer(minLength: 0)
            Button(intent: OpenTrackerDestinationIntent(destination: .tasks)) {
                Label("Open Tasks", systemImage: "arrow.up.right")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(accent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 4)
                    .background { Capsule().fill(accent.opacity(0.14)) }
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }

    private var mediumBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                WidgetGraphics.IconHeader(
                    systemImage: "checklist",
                    title: "Open Tasks",
                    tint: accent,
                    trailing: "\(total)"
                )
                Spacer(minLength: 0)
                Button(intent: OpenTrackerDestinationIntent(destination: .tasks)) {
                    Image(systemName: "arrow.up.right.circle.fill")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(accent)
                }
                .buttonStyle(.plain)
            }
            HStack(spacing: 8) {
                countPill("person.fill", entry.personalOpen, TrackerTheme.personal)
                countPill("folder.fill", entry.projectOpen, accent)
                Spacer(minLength: 0)
            }
            WidgetGraphics.DueDistributionBars(
                overdue: entry.overdue, today: entry.dueToday, later: entry.later, undated: entry.undated,
                accent: accent, height: 56
            )
            TrackerSectionDivider()
            if entry.tasks.isEmpty {
                WidgetGraphics.EmptyGlyph(
                    systemImage: "checkmark.circle.fill",
                    title: "Inbox clear",
                    subtitle: nil,
                    tint: accent,
                    compact: true
                )
            } else {
                ForEach(entry.tasks.prefix(3)) { task in
                    checklistRow(task, showDue: true)
                }
            }
        }
    }

    /// Large = chart left + list right; empty fills with compact glyph (no giant void).
    private var largeBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                WidgetGraphics.IconHeader(
                    systemImage: "checklist",
                    title: "Open Tasks",
                    tint: accent,
                    trailing: "\(total)"
                )
                Spacer(minLength: 0)
                Button(intent: OpenTrackerDestinationIntent(destination: .tasks)) {
                    Image(systemName: "arrow.up.right.circle.fill")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(accent)
                }
                .buttonStyle(.plain)
            }
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        countPill("person.fill", entry.personalOpen, TrackerTheme.personal)
                        countPill("folder.fill", entry.projectOpen, accent)
                    }
                    WidgetGraphics.DueDistributionBars(
                        overdue: entry.overdue, today: entry.dueToday, later: entry.later, undated: entry.undated,
                        accent: accent, height: 140
                    )
                }
                .frame(width: 148)
                VStack(alignment: .leading, spacing: 5) {
                    if entry.tasks.isEmpty {
                        WidgetGraphics.EmptyGlyph(
                            systemImage: "checkmark.circle.fill",
                            title: "Inbox clear",
                            subtitle: "Add from menu bar",
                            tint: accent,
                            compact: true
                        )
                        .padding(.top, 8)
                        Spacer(minLength: 0)
                    } else {
                        ForEach(entry.tasks.prefix(8)) { task in
                            checklistRow(task, showDue: true)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func dueIcon(_ systemImage: String, _ n: Int, _ tint: Color, _ name: String) -> some View {
        VStack(spacing: 2) {
            Image(systemName: systemImage)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(tint)
            Text("\(n)")
                .font(.caption.weight(.bold).monospacedDigit())
                .foregroundStyle(tint)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(name) \(n)")
    }

    private func checklistRow(_ task: TrackerTaskItem, showDue: Bool) -> some View {
        Button(intent: CompleteTodoIntent(todoId: task.id)) {
            HStack(alignment: .top, spacing: 6) {
                WidgetGraphics.ChecklistMark(tint: TrackerTheme.scopeTint(task.scope))
                VStack(alignment: .leading, spacing: 1) {
                    Text(task.title).font(.caption.weight(.medium)).lineLimit(1)
                    if showDue, let due = task.dueAt {
                        Text(due, style: .date)
                            .font(.caption2)
                            .foregroundStyle(due < Date() ? TrackerTheme.danger : .secondary)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func countPill(_ icon: String, _ n: Int, _ tint: Color) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon).font(.system(size: 9, weight: .bold))
            Text("\(n)").font(.caption2.weight(.bold).monospacedDigit())
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background { Capsule().fill(tint.opacity(0.14)) }
    }
}
