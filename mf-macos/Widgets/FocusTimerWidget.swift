import AppIntents
import MFTrackerKit
import SwiftUI
import WidgetKit

struct FocusTimerEntry: TimelineEntry {
    let date: Date
    let state: FocusTimerState
}

struct FocusTimerProvider: TimelineProvider {
    func placeholder(in context: Context) -> FocusTimerEntry {
        FocusTimerEntry(date: Date(), state: FocusTimerState())
    }

    func getSnapshot(in context: Context, completion: @escaping (FocusTimerEntry) -> Void) {
        completion(FocusTimerEntry(date: Date(), state: AppGroupStore.loadTimer()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FocusTimerEntry>) -> Void) {
        let state = AppGroupStore.loadTimer()
        let now = Date()
        var entries: [FocusTimerEntry] = [FocusTimerEntry(date: now, state: state)]
        if state.isRunning, let endsAt = state.endsAt {
            for offset in stride(from: 30, through: max(30, Int(endsAt.timeIntervalSince(now))), by: 30) {
                let date = now.addingTimeInterval(TimeInterval(offset))
                if date <= endsAt {
                    entries.append(FocusTimerEntry(date: date, state: state))
                }
            }
            entries.append(FocusTimerEntry(date: endsAt, state: FocusTimerState(
                durationSeconds: state.durationSeconds,
                remainingSeconds: 0,
                isRunning: false,
                endsAt: nil
            )))
            completion(Timeline(entries: entries, policy: .after(endsAt)))
        } else {
            let next = Calendar.current.date(byAdding: .minute, value: 30, to: now) ?? now.addingTimeInterval(1800)
            completion(Timeline(entries: entries, policy: .after(next)))
        }
    }
}

struct FocusTimerWidget: Widget {
    let kind = "FocusTimerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FocusTimerProvider()) { entry in
            FocusTimerView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Focus Timer")
        .description("Local focus countdown shared with the menu bar.")
        .supportedFamilies([.systemSmall])
    }
}

struct FocusTimerView: View {
    let entry: FocusTimerEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Focus", systemImage: "timer")
                .font(.headline)
            Text(entry.state.liveRemaining(at: entry.date).asClock)
                .font(.system(.title, design: .rounded).monospacedDigit())
            if entry.state.isRunning {
                Button(intent: ToggleFocusTimerIntent()) {
                    Label("Pause", systemImage: "pause.fill")
                }
            } else {
                Button(intent: ToggleFocusTimerIntent()) {
                    Label("Start", systemImage: "play.fill")
                }
            }
        }
        .padding(4)
    }
}

private extension Int {
    var asClock: String {
        String(format: "%d:%02d", self / 60, self % 60)
    }
}

struct ToggleFocusTimerIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Focus Timer"
    static var description = IntentDescription("Start or pause the local focus timer.")

    func perform() async throws -> some IntentResult {
        var state = AppGroupStore.loadTimer()
        if state.isRunning {
            state.remainingSeconds = state.liveRemaining()
            state.isRunning = false
            state.endsAt = nil
        } else {
            let remaining = max(1, state.remainingSeconds == 0 ? state.durationSeconds : state.remainingSeconds)
            state.remainingSeconds = remaining
            state.isRunning = true
            state.endsAt = Date().addingTimeInterval(TimeInterval(remaining))
        }
        AppGroupStore.saveTimer(state)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
