import MFTrackerKit
import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var graphqlURL = AppGroupStore.graphqlURL.absoluteString

    var body: some View {
        Form {
            Section("Server") {
                TextField("GraphQL URL", text: $graphqlURL)
                Button("Save URL") {
                    if let url = URL(string: graphqlURL.trimmingCharacters(in: .whitespacesAndNewlines)) {
                        AppGroupStore.graphqlURL = url
                        session.client.endpoint = url
                    }
                }
            }
            Section("Account") {
                if let user = session.session?.user {
                    LabeledContent("Signed in as", value: user.email)
                    Button("Sign Out", role: .destructive) {
                        Task { await session.logout() }
                    }
                } else {
                    Text("Not signed in")
                        .foregroundStyle(.secondary)
                }
            }
            Section("About") {
                Text("MF Project Tracker macOS menu bar companion. Widgets read App Group snapshots refreshed by this app.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(20)
        .frame(width: 420, height: 280)
    }
}
