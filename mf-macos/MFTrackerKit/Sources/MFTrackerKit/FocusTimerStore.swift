import Combine
import Foundation

@MainActor
public final class FocusTimerStore: ObservableObject {
    @Published public private(set) var state: FocusTimerState

    public init(initial: FocusTimerState = AppGroupStore.loadTimer()) {
        self.state = Self.normalized(initial)
    }

    public func applyPreset(seconds: Int) {
        pause()
        state = FocusTimerState(
            durationSeconds: seconds,
            remainingSeconds: seconds,
            isRunning: false,
            endsAt: nil
        )
        persist()
    }

    public func start() {
        guard !state.isRunning else { return }
        let remaining = max(1, state.remainingSeconds)
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
            endsAt: nil
        )
        persist()
    }

    public func tick() {
        guard state.isRunning else { return }
        let remaining = state.liveRemaining()
        if remaining == 0 {
            state.remainingSeconds = 0
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
