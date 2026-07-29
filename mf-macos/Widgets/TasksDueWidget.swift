import MFTrackerKit
import SwiftUI
import WidgetKit

struct TasksEntry: TimelineEntry {
    let date: Date
    let todos: [UserTodo]
}

struct TasksDueProvider: TimelineProvider {
    func placeholder(in context: Context) -> TasksEntry {
        TasksEntry(
            date: Date(),
            todos: [
                UserTodo(id: "1", userID: "u", title: "Ship macOS widgets", completed: false, dueAt: Date()),
            ]
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (TasksEntry) -> Void) {
        let snapshot = AppGroupStore.loadSnapshot()
        completion(TasksEntry(date: Date(), todos: Array(snapshot.openTodos.prefix(5))))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TasksEntry>) -> Void) {
        let snapshot = AppGroupStore.loadSnapshot()
        let entry = TasksEntry(date: Date(), todos: Array(snapshot.openTodos.prefix(5)))
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct TasksDueWidget: Widget {
    let kind = "TasksDueWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TasksDueProvider()) { entry in
            TasksDueView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("My Tasks")
        .description("Open and due-soon tasks from Project Tracker.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct TasksDueView: View {
    let entry: TasksEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("My Tasks", systemImage: "checklist")
                .font(.headline)
            if entry.todos.isEmpty {
                Text("No open tasks")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
            } else {
                ForEach(entry.todos.prefix(familyLimit)) { todo in
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "circle")
                            .font(.caption2)
                        Text(todo.title)
                            .font(.caption)
                            .lineLimit(2)
                    }
                }
                Spacer(minLength: 0)
            }
        }
        .padding(4)
    }

    private var familyLimit: Int {
        entry.todos.count > 1 ? entry.todos.count : 1
    }
}
