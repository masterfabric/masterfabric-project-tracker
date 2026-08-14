import AppKit
import MFTrackerKit
import SwiftUI

/// Inline Sign In form for the menu bar popover (never a sheet overlay).
/// User auth only — GraphQL URL / Bundle ID / API key come from env (Settings for advanced).
struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var dataStore: TrackerDataStore
    @Binding var isPresented: Bool

    @State private var email = ""
    @State private var password = ""

    private var accent: Color { TrackerTheme.userAccent }
    private var pad: CGFloat { TrackerTheme.Chrome.sectionPadding }
    private var canSubmit: Bool { !session.isLoggingIn }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Sign In")
                .font(.subheadline.weight(.semibold))
            Text("Same account as the mobile app.")
                .font(.caption)
                .foregroundStyle(.secondary)

            // AppKit fields — SwiftUI TextField/SecureField often never bind inside NSPopover.
            MenuBarTextField(text: $email, placeholder: "Email", onSubmit: submitIfPossible) { email = $0 }
                .frame(height: 28)
                .accessibilityLabel("Email")
            MenuBarSecureField(text: $password, placeholder: "Password", onSubmit: submitIfPossible) { password = $0 }
                .frame(height: 28)
                .accessibilityLabel("Password")

            if let error = session.lastError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel(error)
            }
            HStack {
                Button("Cancel") {
                    guard !session.isLoggingIn else { return }
                    session.cancelLoginDraft()
                    isPresented = false
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .frame(minHeight: TrackerTheme.Chrome.hitTarget)
                .disabled(session.isLoggingIn)
                .accessibilityLabel("Cancel")
                Spacer()
                Button(session.isLoggingIn ? "Signing in…" : "Sign In") {
                    submitIfPossible()
                }
                .buttonStyle(.plain)
                .font(.caption.weight(.semibold))
                .foregroundStyle(accent)
                .frame(minHeight: TrackerTheme.Chrome.hitTarget)
                .padding(.horizontal, 12)
                .background {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(accent.opacity(0.12))
                }
                .keyboardShortcut(.defaultAction)
                // Enabled whenever idle — credentials are read live from AppKit fields on click
                // (AX / SecureField can fill NSViews without SwiftUI disabling-state catching up).
                .disabled(!canSubmit)
                .accessibilityLabel("Sign In")
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(pad)
        .onChange(of: session.isAuthenticated) { _, authenticated in
            guard authenticated else { return }
            Task {
                await dataStore.refreshAll()
                WidgetReloader.reload(aggressive: true)
                isPresented = false
            }
        }
        .onChange(of: session.isLoggingIn) { _, loggingIn in
            NotificationCenter.default.post(
                name: .mfLoginInFlight,
                object: loggingIn ? "1" : "0"
            )
        }
        .onAppear {
            AppGroupStore.seedFromBundleIfNeeded()
            session.client.endpoint = AppGroupStore.graphqlURL
        }
        .onDisappear {
            if !session.isLoggingIn {
                NotificationCenter.default.post(name: .mfLoginInFlight, object: "0")
            }
        }
    }

    private func submitIfPossible() {
        // Flush AppKit field editors into SwiftUI bindings before reading password.
        NSApp.keyWindow?.makeFirstResponder(nil)
        let live = Self.liveCredentialFields(fallbackEmail: email, fallbackPassword: password)
        email = live.email
        password = live.password
        guard !live.email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !live.password.isEmpty else {
            session.lastError = "Enter email and password."
            return
        }
        guard !session.isLoggingIn else { return }
        // Endpoint + headers come from App Group / Info.plist (sync-env / install-debug).
        AppGroupStore.seedFromBundleIfNeeded()
        session.client.endpoint = AppGroupStore.graphqlURL
        session.beginLogin(email: live.email, password: live.password)
    }

    /// Read AppKit field values directly — AX can update NSViews without SwiftUI `@State` catching up.
    private static func liveCredentialFields(fallbackEmail: String, fallbackPassword: String) -> (email: String, password: String) {
        var emailVal = fallbackEmail
        var passVal = fallbackPassword
        for window in NSApp.windows {
            guard let root = window.contentView else { continue }
            var textFields: [NSTextField] = []
            var secureFields: [NSSecureTextField] = []
            collectFields(in: root, textFields: &textFields, secureFields: &secureFields)
            if let first = textFields.first(where: { !($0 is NSSecureTextField) }), !first.stringValue.isEmpty {
                emailVal = first.stringValue
            }
            if let secure = secureFields.first, !secure.stringValue.isEmpty {
                passVal = secure.stringValue
            } else if passVal.isEmpty,
                      let second = textFields.filter({ !($0 is NSSecureTextField) }).dropFirst().first,
                      !second.stringValue.isEmpty
            {
                // Some macOS AX builds report NSSecureTextField as a plain NSTextField.
                passVal = second.stringValue
            }
        }
        return (emailVal, passVal)
    }

    private static func collectFields(
        in view: NSView,
        textFields: inout [NSTextField],
        secureFields: inout [NSSecureTextField]
    ) {
        if let secure = view as? NSSecureTextField {
            secureFields.append(secure)
        } else if let field = view as? NSTextField {
            textFields.append(field)
        }
        for child in view.subviews {
            collectFields(in: child, textFields: &textFields, secureFields: &secureFields)
        }
    }
}
