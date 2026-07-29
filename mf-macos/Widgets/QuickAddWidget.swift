import AppIntents
import MFTrackerKit
import SwiftUI
import WidgetKit

struct QuickAddEntry: TimelineEntry {
    let date: Date
}

struct QuickAddProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickAddEntry {
        QuickAddEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickAddEntry) -> Void) {
        completion(QuickAddEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickAddEntry>) -> Void) {
        let next = Calendar.current.date(byAdding: .hour, value: 12, to: Date()) ?? Date().addingTimeInterval(43_200)
        completion(Timeline(entries: [QuickAddEntry(date: Date())], policy: .after(next)))
    }
}

struct QuickAddWidget: Widget {
    let kind = "QuickAddWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickAddProvider()) { _ in
            QuickAddView()
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Quick Add Todo")
        .description("Create a personal todo via App Intent.")
        .supportedFamilies([.systemSmall])
    }
}

struct QuickAddView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Quick Add", systemImage: "plus.circle.fill")
                .font(.headline)
            Text("Create a personal todo")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button(intent: CreateTodoIntent()) {
                Label("New Todo", systemImage: "square.and.pencil")
            }
            Spacer(minLength: 0)
        }
        .padding(4)
    }
}

struct CreateTodoIntent: AppIntent {
    static var title: LocalizedStringResource = "Create Todo"
    static var description = IntentDescription("Creates a personal todo in Project Tracker.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Title")
    var title: String

    init() {
        self.title = ""
    }

    init(title: String) {
        self.title = title
    }

    func perform() async throws -> some IntentResult {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return .result()
        }
        guard let session = KeychainStore.loadSession() else {
            throw GraphQLClientError.missingToken
        }
        let client = GraphQLClient(endpoint: AppGroupStore.graphqlURL, accessToken: session.accessToken)
        do {
            _ = try await client.createTodo(title: trimmed)
        } catch GraphQLClientError.unauthorized {
            let refreshed = try await client.refreshTokens(userID: session.user.id, refreshToken: session.refreshToken)
            try KeychainStore.saveSession(refreshed)
            client.accessToken = refreshed.accessToken
            _ = try await client.createTodo(title: trimmed)
        }
        let todos = (try? await client.myTodos()) ?? AppGroupStore.loadSnapshot().todos
        var snapshot = AppGroupStore.loadSnapshot()
        snapshot.todos = todos
        snapshot.updatedAt = Date()
        AppGroupStore.saveSnapshot(snapshot)
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

struct CompleteTodoIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete Todo"

    @Parameter(title: "Todo ID")
    var todoId: String

    init() {
        self.todoId = ""
    }

    init(todoId: String) {
        self.todoId = todoId
    }

    func perform() async throws -> some IntentResult {
        guard let session = KeychainStore.loadSession() else {
            throw GraphQLClientError.missingToken
        }
        let client = GraphQLClient(endpoint: AppGroupStore.graphqlURL, accessToken: session.accessToken)
        do {
            _ = try await client.updateTodo(id: todoId, completed: true)
        } catch GraphQLClientError.unauthorized {
            let refreshed = try await client.refreshTokens(userID: session.user.id, refreshToken: session.refreshToken)
            try KeychainStore.saveSession(refreshed)
            client.accessToken = refreshed.accessToken
            _ = try await client.updateTodo(id: todoId, completed: true)
        }
        if let todos = try? await client.myTodos() {
            var snapshot = AppGroupStore.loadSnapshot()
            snapshot.todos = todos
            snapshot.updatedAt = Date()
            AppGroupStore.saveSnapshot(snapshot)
        }
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
