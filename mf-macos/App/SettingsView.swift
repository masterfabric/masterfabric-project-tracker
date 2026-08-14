import AppKit
import MFTrackerKit
import SwiftUI

/// In-popover settings — no separate macOS Settings window.
struct MenuBarSettingsPanel: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var dataStore: TrackerDataStore
    @EnvironmentObject private var timerStore: FocusTimerStore
    @EnvironmentObject private var accentStore: AccentPreferenceStore
    @State private var graphqlURL = AppGroupStore.graphqlURL.absoluteString
    @State private var bundleID = AppGroupStore.clientBundleID
    @State private var apiKey = AppGroupStore.apiKey ?? ""
    @State private var particularKey = AppGroupStore.projectTrackerParticularKey
    @State private var demoActive = AppGroupStore.demoSeedActive
    var onClose: (() -> Void)?

    private var pad: CGFloat { TrackerTheme.Chrome.sectionPadding }
    private var accent: Color { accentStore.color }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                appearanceSection
                applicationSection
                serverSection
                accountSection
                aboutSection
            }
            .padding(.horizontal, pad)
            .padding(.vertical, 12)
        }
        .onAppear { demoActive = AppGroupStore.demoSeedActive }
    }

    private var appearanceSection: some View {
        settingsBlock(title: "Appearance") {
            Text("Accent")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            TrackerAccentSwatchPicker(selection: $accentStore.preset)
            Text("Tints popover, dashboard chrome, and widgets (\(accentStore.preset.displayName)). Menu bar strip stays system template contrast.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var applicationSection: some View {
        settingsBlock(title: "Application") {
            Button {
                NSWorkspace.shared.open(MFTrackerConstants.expoDeepLink)
            } label: {
                Text("Open Mobile App")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(accent)
            }
            .buttonStyle(.plain)

            TrackerSectionDivider()

            Text("Widget data")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(
                demoActive
                    ? "Demo seed is active — menu bar and widgets share the same fake snapshot."
                    : "Widgets read the same App Group snapshot as the menu bar after Refresh. Empty API → empty UI until you Load demo data (Debug also auto-seeds on Refresh)."
            )
            .font(.caption2)
            .foregroundStyle(.tertiary)
            .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 12) {
                Button("Load demo data") {
                    dataStore.applyDemoSeed()
                    timerStore.reloadFromAppGroup()
                    demoActive = true
                }
                .buttonStyle(.plain)
                .font(.caption.weight(.semibold))
                .foregroundStyle(accent)

                if demoActive {
                    Button("Clear demo") {
                        Task {
                            await dataStore.clearDemoSeed()
                            timerStore.reloadFromAppGroup()
                            demoActive = AppGroupStore.demoSeedActive
                        }
                    }
                    .buttonStyle(.plain)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var serverSection: some View {
        settingsBlock(title: "Server") {
            Text("GraphQL URL")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            TextField("http://127.0.0.1:8080/graphql", text: $graphqlURL)
                .textFieldStyle(.roundedBorder)
                .font(.caption)
            Text("Client Bundle ID")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            TextField("com.masterfabric.monoExpo", text: $bundleID)
                .textFieldStyle(.roundedBorder)
                .font(.caption)
            Text("API Key (X-API-Key)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            SecureField("From local.env EXPO_PUBLIC_MF_APP_API_KEY", text: $apiKey)
                .textFieldStyle(.roundedBorder)
                .font(.caption)
            Text("Particular key")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            TextField("project_tracker", text: $particularKey)
                .textFieldStyle(.roundedBorder)
                .font(.caption)
            Text("Prefer: npm run mf-macos:env (syncs repo-root local.env into build + App Group).")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .fixedSize(horizontal: false, vertical: true)
            Button("Save server settings") {
                if let url = URL(string: graphqlURL.trimmingCharacters(in: .whitespacesAndNewlines)) {
                    AppGroupStore.graphqlURL = url
                    session.client.endpoint = url
                }
                let bid = bundleID.trimmingCharacters(in: .whitespacesAndNewlines)
                if !bid.isEmpty { AppGroupStore.clientBundleID = bid }
                AppGroupStore.apiKey = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
                let pk = particularKey.trimmingCharacters(in: .whitespacesAndNewlines)
                if !pk.isEmpty { AppGroupStore.projectTrackerParticularKey = pk }
            }
            .buttonStyle(.plain)
            .font(.caption.weight(.semibold))
            .foregroundStyle(accent)
        }
    }

    private var accountSection: some View {
        settingsBlock(title: "Account") {
            if let user = session.session?.user {
                Text(user.email)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
                Button("Sign Out", role: .destructive) {
                    Task { await session.logout() }
                    onClose?()
                }
                .buttonStyle(.plain)
                .font(.caption.weight(.semibold))
            } else {
                Text("Not signed in")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var aboutSection: some View {
        settingsBlock(title: "About") {
            Text("MF Project Tracker macOS menu bar companion. Widgets read App Group snapshots refreshed by this app.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func settingsBlock<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Kept only if something still references `SettingsView` — redirects to the in-popover panel.
struct SettingsView: View {
    var body: some View {
        MenuBarSettingsPanel()
            .frame(width: TrackerTheme.Chrome.popoverWidth - 8, height: 400)
            .padding(8)
    }
}
