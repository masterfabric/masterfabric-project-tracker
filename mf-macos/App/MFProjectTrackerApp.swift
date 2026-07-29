import AppKit
import MFTrackerKit
import SwiftUI
import WidgetKit

@main
struct MFProjectTrackerApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var session: SessionStore
    @StateObject private var dataStore: TrackerDataStore
    @StateObject private var timerStore = FocusTimerStore()

    init() {
        let session = SessionStore()
        _session = StateObject(wrappedValue: session)
        _dataStore = StateObject(wrappedValue: TrackerDataStore(session: session))
        WidgetReloader.reloadHandler = {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    var body: some Scene {
        MenuBarExtra {
            MenuBarRootView()
                .environmentObject(session)
                .environmentObject(dataStore)
                .environmentObject(timerStore)
                .frame(width: 360)
        } label: {
            MenuBarLabel()
                .environmentObject(dataStore)
                .environmentObject(timerStore)
        }
        .menuBarExtraStyle(.window)

        Settings {
            SettingsView()
                .environmentObject(session)
                .environmentObject(dataStore)
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
    }
}
