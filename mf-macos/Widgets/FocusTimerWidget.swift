import AppIntents
import MFTrackerKit
import SwiftUI
import WidgetKit

struct FocusTimerEntry: TimelineEntry {
    let date: Date
    let isAuthenticated: Bool
    let state: FocusTimerState
}

struct FocusTimerProvider: TimelineProvider {
    func placeholder(in context: Context) -> FocusTimerEntry {
        FocusTimerEntry(date: Date(), isAuthenticated: true, state: FocusTimerState(remainingSeconds: 18 * 60, isRunning: true, selectedFocusTaskTitle: "Ship focus"))
    }
    func getSnapshot(in context: Context, completion: @escaping (FocusTimerEntry) -> Void) {
        completion(Self.makeEntry())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<FocusTimerEntry>) -> Void) {
        let entry = Self.makeEntry()
        let now = Date()
        guard entry.isAuthenticated else {
            let next = Date().addingTimeInterval(MFTrackerConstants.signedOutWidgetRecheckSeconds)
            completion(Timeline(entries: [entry], policy: .after(next)))
            return
        }
        let state = entry.state
        var entries = [FocusTimerEntry(date: now, isAuthenticated: true, state: state)]
        if state.isRunning, let endsAt = state.endsAt {
            for offset in stride(from: 30, through: max(30, Int(endsAt.timeIntervalSince(now))), by: 30) {
                let date = now.addingTimeInterval(TimeInterval(offset))
                if date <= endsAt { entries.append(FocusTimerEntry(date: date, isAuthenticated: true, state: state)) }
            }
            completion(Timeline(entries: entries, policy: .after(endsAt)))
        } else {
            let next = Calendar.current.date(byAdding: .minute, value: 30, to: now) ?? now.addingTimeInterval(1800)
            completion(Timeline(entries: entries, policy: .after(next)))
        }
    }

    private static func makeEntry() -> FocusTimerEntry {
        AppGroupStore.flushSuiteToDisk()
        let snapshot = AppGroupStore.loadSnapshotForWidgets()
        let authenticated = snapshot.isAuthenticated || AppGroupStore.widgetIsAuthenticated
        guard authenticated else {
            return FocusTimerEntry(date: Date(), isAuthenticated: false, state: FocusTimerState())
        }
        return FocusTimerEntry(date: Date(), isAuthenticated: true, state: AppGroupStore.loadTimerForWidgets())
    }
}

struct FocusTimerWidget: Widget {
    let kind = "FocusTimerWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FocusTimerProvider()) { entry in
            FocusTimerView(entry: entry)
                .containerBackground(for: .widget) { TrackerWidgetGlassBackground() }
                .widgetURL(entry.isAuthenticated ? TrackerDeepLink.url(.timer) : TrackerDeepLink.url(.login))
        }
        .configurationDisplayName("Project Tracker Focus")
        .description("Small glance: countdown ring + Start/Pause.")
        .supportedFamilies([.systemSmall])
    }
}

/// Compact Small layout — ring fills the tile; no wasted Spacer void.
struct FocusTimerView: View {
    let entry: FocusTimerEntry
    private var accent: Color { TrackerTheme.userAccent }
    private var running: Bool { entry.state.isRunning }
    private var tint: Color { TrackerTheme.focusTint(running: running) }
    private var remaining: Int { entry.state.liveRemaining(at: entry.date) }
    private var duration: Int {
        max(1, entry.state.durationSeconds > 0 ? entry.state.durationSeconds : FocusTimerState.defaultPresetSeconds)
    }
    private var progress: Double { 1.0 - (Double(remaining) / Double(duration)) }

    var body: some View {
        Group {
            if !entry.isAuthenticated {
                Button(intent: OpenLoginIntent()) {
                    WidgetGraphics.SignInEmptyState(tint: accent, compact: true)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } else {
                signedInBody
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var signedInBody: some View {
        VStack(spacing: 4) {
            Button(intent: OpenTrackerDestinationIntent(destination: .timer)) {
                ZStack {
                    WidgetGraphics.ProgressRing(progress: running ? progress : 0, lineWidth: 8, accent: tint)
                        .frame(width: 84, height: 84)
                    VStack(spacing: 0) {
                        Text(remaining.asClock)
                            .font(.system(size: 22, weight: .bold, design: .rounded).monospacedDigit())
                            .foregroundStyle(tint)
                            .minimumScaleFactor(0.7)
                            .lineLimit(1)
                        Text(running ? "Focus" : "Idle")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(running ? tint : .secondary)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if let title = entry.state.focusTaskDisplayTitle {
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity)
            }
            Button(intent: ToggleFocusTimerIntent()) {
                Label(running ? "Pause" : "Start", systemImage: running ? "pause.fill" : "play.fill")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(tint)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 4)
                    .background {
                        Capsule().fill(tint.opacity(0.16))
                    }
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
    }
}

private extension Int {
    var asClock: String { String(format: "%d:%02d", self / 60, self % 60) }
}
