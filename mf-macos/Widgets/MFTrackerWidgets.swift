import MFTrackerKit
import SwiftUI
import WidgetKit

@main
struct MFTrackerWidgets: WidgetBundle {
    var body: some Widget {
        TasksDueWidget()
        ProjectPulseWidget()
        FocusTimerWidget()
        QuickAddWidget()
    }
}
