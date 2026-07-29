import MFTrackerKit
import SwiftUI

struct MenuBarLabel: View {
    @EnvironmentObject private var dataStore: TrackerDataStore
    @EnvironmentObject private var timerStore: FocusTimerStore

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "checklist")
            if timerStore.state.isRunning {
                Text(timerStore.state.displayString)
                    .monospacedDigit()
            } else if dataStore.openCount > 0 {
                Text("\(dataStore.openCount)")
                    .monospacedDigit()
            }
        }
    }
}

struct MenuBarRootView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var dataStore: TrackerDataStore
    @EnvironmentObject private var timerStore: FocusTimerStore
    @State private var showLogin = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider()
            if session.isAuthenticated {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        QuickActionsSection()
                        FocusTimerSection()
                        TasksSection()
                        ProjectsSection()
                    }
                    .padding(12)
                }
                .frame(maxHeight: 520)
            } else {
                VStack(spacing: 12) {
                    Text("Sign in to MF Project Tracker")
                        .font(.headline)
                    Text("Uses the same mf-go GraphQL account as the mobile app.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Button("Sign In…") { showLogin = true }
                        .keyboardShortcut(.defaultAction)
                }
                .frame(maxWidth: .infinity)
                .padding(24)
            }
            if let status = dataStore.statusMessage ?? session.lastError {
                Divider()
                Text(status)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .onAppear {
            session.bootstrap()
            timerStore.reloadFromAppGroup()
            if session.isAuthenticated {
                Task { await dataStore.refreshAll() }
            }
        }
        .sheet(isPresented: $showLogin) {
            LoginView(isPresented: $showLogin)
                .environmentObject(session)
                .environmentObject(dataStore)
        }
        .onChange(of: session.isAuthenticated) { _, authenticated in
            if authenticated {
                Task { await dataStore.refreshAll() }
            }
        }
        .task(id: timerStore.state.isRunning) {
            guard timerStore.state.isRunning else { return }
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                timerStore.tick()
                WidgetReloader.reload()
            }
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("MF Project Tracker")
                    .font(.headline)
                if let user = session.session?.user {
                    Text(user.email)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if session.isAuthenticated {
                Button {
                    Task { await dataStore.refreshAll() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
                .disabled(dataStore.isLoading)
            }
        }
        .padding(12)
    }
}
