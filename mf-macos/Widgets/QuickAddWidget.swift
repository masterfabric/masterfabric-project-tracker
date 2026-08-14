import AppIntents
import MFTrackerKit
import SwiftUI
import WidgetKit

struct QuickAddEntry: TimelineEntry {
    let date: Date
    let isAuthenticated: Bool
    let scope: TrackerTaskScope
    let projectName: String?
    let personalOpen: Int
    let projectOpen: Int
}

struct QuickAddProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickAddEntry {
        QuickAddEntry(date: Date(), isAuthenticated: true, scope: .personal, projectName: "Core", personalOpen: 2, projectOpen: 4)
    }
    func getSnapshot(in context: Context, completion: @escaping (QuickAddEntry) -> Void) {
        completion(Self.makeEntry())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickAddEntry>) -> Void) {
        let entry = Self.makeEntry()
        let seconds = entry.isAuthenticated ? 12 * 3600.0 : MFTrackerConstants.signedOutWidgetRecheckSeconds
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(seconds))))
    }
    private static func makeEntry() -> QuickAddEntry {
        AppGroupStore.flushSuiteToDisk()
        let s = AppGroupStore.loadSnapshotForWidgets()
        let authenticated = s.isAuthenticated || AppGroupStore.widgetIsAuthenticated
        guard authenticated else {
            return QuickAddEntry(
                date: Date(),
                isAuthenticated: false,
                scope: .personal,
                projectName: nil,
                personalOpen: 0,
                projectOpen: 0
            )
        }
        return QuickAddEntry(
            date: Date(),
            isAuthenticated: true,
            scope: s.taskScope,
            projectName: s.projectPulse?.projectName,
            personalOpen: s.openTodos.count,
            projectOpen: s.openProjectTodos.count
        )
    }
}

struct QuickAddWidget: Widget {
    let kind = "QuickAddWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickAddProvider()) { entry in
            QuickAddView(entry: entry)
                .containerBackground(for: .widget) { TrackerWidgetGlassBackground() }
                .widgetURL(entry.isAuthenticated ? TrackerDeepLink.url(.compose) : TrackerDeepLink.url(.login))
        }
        .configurationDisplayName("Project Tracker Quick Add")
        .description("Small: big Add CTA. Medium: field + create button.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct QuickAddView: View {
    @Environment(\.widgetFamily) private var family
    let entry: QuickAddEntry
    private var accent: Color { TrackerTheme.userAccent }
    private var isProject: Bool { entry.scope == .project }
    private var scopeLabel: String { isProject ? (entry.projectName ?? "Project") : "Personal" }
    private var scopeTint: Color { isProject ? accent : TrackerTheme.personal }
    private var placeholder: String { isProject ? "New issue…" : "New todo…" }
    private var ctaTitle: String { isProject ? "Create issue" : "Create todo" }

    var body: some View {
        Group {
            if !entry.isAuthenticated {
                Button(intent: OpenLoginIntent()) {
                    WidgetGraphics.SignInEmptyState(tint: accent, compact: family == .systemSmall)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } else if family == .systemSmall {
                smallBody
            } else {
                mediumBody
            }
        }
        .padding(10)
    }

    /// Small = giant plus CTA only. Opens compose (title dialogs fail on Desktop widgets).
    private var smallBody: some View {
        Button(intent: QuickAddOpenComposeIntent()) {
            VStack(spacing: 8) {
                Image(systemName: isProject ? "folder.fill" : "person.fill")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(scopeTint)
                Text(scopeLabel)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 40, weight: .semibold))
                    .foregroundStyle(accent)
                Text("Add")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(accent)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Medium = one themed Button (no separate white TextField chrome).
    private var mediumBody: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "square.and.pencil")
                    .font(.body.weight(.bold))
                    .foregroundStyle(accent)
                Text("Quick Add")
                    .font(.headline.weight(.bold))
                Spacer(minLength: 0)
                HStack(spacing: 4) {
                    Image(systemName: isProject ? "folder.fill" : "person.fill")
                        .font(.system(size: 9, weight: .bold))
                    Text(scopeLabel)
                        .font(.caption2.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
                .foregroundStyle(scopeTint)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background {
                    Capsule().fill(scopeTint.opacity(0.16))
                }
            }

            Button(intent: QuickAddOpenComposeIntent()) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(accent)
                        Text(placeholder)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Color.white.opacity(0.55))
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 11)
                    .background {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color.black.opacity(0.32))
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(accent.opacity(0.5), lineWidth: 1)
                    }

                    HStack {
                        Image(systemName: "plus.circle.fill")
                        Text(ctaTitle)
                            .font(.subheadline.weight(.bold))
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.right.circle.fill")
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(accent)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }
}
