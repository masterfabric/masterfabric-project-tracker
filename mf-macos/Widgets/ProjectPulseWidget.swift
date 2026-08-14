import AppIntents
import MFTrackerKit
import SwiftUI
import WidgetKit

struct ProjectPulseEntry: TimelineEntry {
    let date: Date
    let isAuthenticated: Bool
    let pulse: ProjectPulse?
    let personalOpen: Int
}

struct ProjectPulseProvider: TimelineProvider {
    func placeholder(in context: Context) -> ProjectPulseEntry {
        ProjectPulseEntry(
            date: Date(),
            isAuthenticated: true,
            pulse: ProjectPulse(projectId: "p", projectName: "Core", organizationName: "MasterFabric", openCount: 4, doneCount: 12),
            personalOpen: 2
        )
    }
    func getSnapshot(in context: Context, completion: @escaping (ProjectPulseEntry) -> Void) {
        completion(Self.makeEntry())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ProjectPulseEntry>) -> Void) {
        let entry = Self.makeEntry()
        let seconds = entry.isAuthenticated ? 15 * 60.0 : MFTrackerConstants.signedOutWidgetRecheckSeconds
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(seconds))))
    }
    private static func makeEntry() -> ProjectPulseEntry {
        AppGroupStore.flushSuiteToDisk()
        let s = AppGroupStore.loadSnapshotForWidgets()
        let authenticated = s.isAuthenticated || AppGroupStore.widgetIsAuthenticated
        guard authenticated else {
            return ProjectPulseEntry(date: Date(), isAuthenticated: false, pulse: nil, personalOpen: 0)
        }
        return ProjectPulseEntry(date: Date(), isAuthenticated: true, pulse: s.projectPulse, personalOpen: s.openTodos.count)
    }
}

struct ProjectPulseWidget: Widget {
    let kind = "ProjectPulseWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ProjectPulseProvider()) { entry in
            ProjectPulseView(entry: entry)
                .containerBackground(for: .widget) { TrackerWidgetGlassBackground() }
                .widgetURL(entry.isAuthenticated ? TrackerDeepLink.url(.projects) : TrackerDeepLink.url(.login))
        }
        .configurationDisplayName("Project Tracker Pulse")
        .description("Small: ring glance. Medium: ring + open/done split.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct ProjectPulseView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ProjectPulseEntry
    private var accent: Color { TrackerTheme.userAccent }

    var body: some View {
        Group {
            if entry.isAuthenticated {
                Button(intent: OpenTrackerDestinationIntent(destination: .projects)) {
                    pulseContent
                }
                .buttonStyle(.plain)
            } else {
                Button(intent: OpenLoginIntent()) {
                    pulseContent
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var pulseContent: some View {
        Group {
            if !entry.isAuthenticated {
                WidgetGraphics.SignInEmptyState(tint: accent, compact: family == .systemSmall)
            } else if let pulse = entry.pulse {
                switch family {
                case .systemSmall: smallFilled(pulse)
                default: mediumFilled(pulse)
                }
            } else {
                switch family {
                case .systemSmall: smallEmpty
                default: mediumEmpty
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
    }

    private func smallFilled(_ pulse: ProjectPulse) -> some View {
        let total = max(1, pulse.openCount + pulse.doneCount)
        let donePct = Double(pulse.doneCount) / Double(total)
        return VStack(spacing: 6) {
            ZStack {
                WidgetGraphics.DualRing(open: pulse.openCount, done: pulse.doneCount, accent: accent)
                    .frame(width: 72, height: 72)
                Text("\(Int((donePct * 100).rounded()))%")
                    .font(.caption.bold().monospacedDigit())
                    .foregroundStyle(accent)
            }
            Text(pulse.projectName)
                .font(.caption.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text("\(pulse.openCount) open · \(pulse.doneCount) done")
                .font(.caption2.monospacedDigit())
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func mediumFilled(_ pulse: ProjectPulse) -> some View {
        HStack(spacing: 14) {
            ZStack {
                WidgetGraphics.DualRing(open: pulse.openCount, done: pulse.doneCount, accent: accent)
                    .frame(width: 88, height: 88)
                VStack(spacing: 0) {
                    Text("\(pulse.doneCount)")
                        .font(.title3.bold().monospacedDigit())
                        .foregroundStyle(accent)
                    Text("done").font(.caption2).foregroundStyle(.secondary)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(pulse.projectName)
                    .font(.headline.weight(.semibold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                Text(pulse.organizationName)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                WidgetGraphics.SegmentedTrack(open: pulse.openCount, done: pulse.doneCount, accent: accent, height: 8)
                HStack(spacing: 10) {
                    Label("\(pulse.openCount) open", systemImage: "circle.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(accent)
                        .labelStyle(.titleAndIcon)
                    Label("\(entry.personalOpen) me", systemImage: "person.fill")
                        .font(.caption2)
                        .foregroundStyle(TrackerTheme.personal)
                        .labelStyle(.titleAndIcon)
                }
                Spacer(minLength: 0)
            }
        }
    }

    /// Small empty: icon + two short lines.
    private var smallEmpty: some View {
        VStack(spacing: 8) {
            Image(systemName: "folder.badge.plus")
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(accent.opacity(0.85))
            Text("No project")
                .font(.caption.weight(.bold))
            Text("Pick in menu bar")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Medium empty: compact CTA copy — no empty ring essay.
    private var mediumEmpty: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .stroke(accent.opacity(0.2), lineWidth: 8)
                    .frame(width: 72, height: 72)
                Image(systemName: "folder.badge.plus")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(accent.opacity(0.9))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Project Pulse")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(accent)
                Text("No project selected")
                    .font(.subheadline.weight(.medium))
                Text("Pick one in the menu bar")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
            }
            Spacer(minLength: 0)
        }
    }
}
