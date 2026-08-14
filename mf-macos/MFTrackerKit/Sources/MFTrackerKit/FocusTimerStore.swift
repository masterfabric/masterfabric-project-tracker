import Combine
import Foundation

@MainActor
public final class FocusTimerStore: ObservableObject {
    @Published public private(set) var state: FocusTimerState

    public init(initial: FocusTimerState = AppGroupStore.loadTimer()) {
        self.state = Self.normalized(initial)
    }

    public var canStart: Bool {
        !state.isRunning && (state.remainingSeconds > 0 || state.hasFocusTask)
    }

    public func applyPreset(seconds: Int) {
        pause()
        state = FocusTimerState(
            durationSeconds: seconds,
            remainingSeconds: seconds,
            isRunning: false,
            endsAt: nil,
            selectedFocusTaskId: state.selectedFocusTaskId,
            selectedFocusTaskTitle: state.selectedFocusTaskTitle,
            selectedFocusTaskScope: state.selectedFocusTaskScope
        )
        persist()
    }

    /// Bind the local focus session to an open personal/project task. At 0:00, applies the 25m preset.
    public func selectFocusTask(_ task: TrackerTaskItem?) {
        if state.isRunning {
            pause()
        }
        if let task {
            state.selectedFocusTaskId = task.id
            state.selectedFocusTaskTitle = task.title
            state.selectedFocusTaskScope = task.scope
            if state.remainingSeconds <= 0 {
                let seconds = FocusTimerState.defaultPresetSeconds
                state.durationSeconds = seconds
                state.remainingSeconds = seconds
            }
        } else {
            state.selectedFocusTaskId = nil
            state.selectedFocusTaskTitle = nil
            state.selectedFocusTaskScope = nil
        }
        persist()
    }

    public func start() {
        guard !state.isRunning else { return }
        var remaining = state.remainingSeconds
        if remaining <= 0 {
            let seconds = state.durationSeconds > 0
                ? state.durationSeconds
                : FocusTimerState.defaultPresetSeconds
            state.durationSeconds = seconds
            remaining = seconds
            state.remainingSeconds = seconds
        }
        state.isRunning = true
        state.endsAt = Date().addingTimeInterval(TimeInterval(remaining))
        persist()
    }

    public func pause() {
        guard state.isRunning else { return }
        state.remainingSeconds = state.liveRemaining()
        state.isRunning = false
        state.endsAt = nil
        persist()
    }

    public func reset() {
        state = FocusTimerState(
            durationSeconds: state.durationSeconds,
            remainingSeconds: state.durationSeconds,
            isRunning: false,
            endsAt: nil,
            selectedFocusTaskId: state.selectedFocusTaskId,
            selectedFocusTaskTitle: state.selectedFocusTaskTitle,
            selectedFocusTaskScope: state.selectedFocusTaskScope
        )
        persist()
    }

    public func tick() {
        guard state.isRunning else { return }
        let remaining = state.liveRemaining()
        // Always assign so @Published refreshes closed MenuBarExtra / widgets each second.
        state.remainingSeconds = remaining
        if remaining == 0 {
            state.isRunning = false
            state.endsAt = nil
            persist()
        }
    }

    public func reloadFromAppGroup() {
        state = Self.normalized(AppGroupStore.loadTimer())
    }

    private func persist() {
        AppGroupStore.saveTimer(state)
        WidgetReloader.reload()
    }

    private static func normalized(_ state: FocusTimerState) -> FocusTimerState {
        var copy = state
        if copy.isRunning, let endsAt = copy.endsAt {
            let remaining = max(0, Int(endsAt.timeIntervalSinceNow))
            if remaining == 0 {
                copy.isRunning = false
                copy.remainingSeconds = 0
                copy.endsAt = nil
            } else {
                copy.remainingSeconds = remaining
            }
        }
        return copy
    }
}
