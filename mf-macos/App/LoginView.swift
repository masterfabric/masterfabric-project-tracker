import MFTrackerKit
import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var dataStore: TrackerDataStore
    @Binding var isPresented: Bool

    @State private var email = ""
    @State private var password = ""
    @State private var graphqlURL = AppGroupStore.graphqlURL.absoluteString
    @State private var bundleID = AppGroupStore.clientBundleID
    @State private var isSubmitting = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Sign In")
                .font(.title2.bold())
            TextField("Email", text: $email)
                .textFieldStyle(.roundedBorder)
            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)
            TextField("GraphQL URL", text: $graphqlURL)
                .textFieldStyle(.roundedBorder)
            TextField("Client Bundle ID", text: $bundleID)
                .textFieldStyle(.roundedBorder)
            Text("Uses X-Bundle-ID (same registered client as Expo: com.masterfabric.monoExpo).")
                .font(.caption2)
                .foregroundStyle(.secondary)
            if let error = session.lastError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
            HStack {
                Button("Cancel") { isPresented = false }
                Spacer()
                Button(isSubmitting ? "Signing in…" : "Sign In") {
                    Task {
                        isSubmitting = true
                        if let url = URL(string: graphqlURL.trimmingCharacters(in: .whitespacesAndNewlines)) {
                            AppGroupStore.graphqlURL = url
                            session.client.endpoint = url
                        }
                        let trimmedBundle = bundleID.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !trimmedBundle.isEmpty {
                            AppGroupStore.clientBundleID = trimmedBundle
                        }
                        await session.login(email: email, password: password)
                        isSubmitting = false
                        if session.isAuthenticated {
                            await dataStore.refreshAll()
                            isPresented = false
                        }
                    }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(email.isEmpty || password.isEmpty || isSubmitting)
            }
        }
        .padding(20)
        .frame(width: 380)
    }
}
