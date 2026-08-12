import MFTrackerKit
import SwiftUI
import WidgetKit

@main
struct MFTrackerWidgets: WidgetBundle {
    init() {
        AppGroupStore.seedFromBundleIfNeeded()
    }

    var body: some Widget {
        TrackerDashboardWidget()
        ChatNotificationsWidget()
        TasksDueWidget()
        ProjectPulseWidget()
        FocusTimerWidget()
        QuickAddWidget()
    }
}
