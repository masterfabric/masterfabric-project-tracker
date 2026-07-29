import AppKit
import MFTrackerKit
import SwiftUI

struct QuickActionsSection: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var dataStore: TrackerDataStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Quick actions")
                .font(.subheadline.weight(.semibold))
            HStack(spacing: 8) {
                TextField("New todo", text: $dataStore.draftTodoTitle)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit {
                        Task { await dataStore.createDraftTodo() }
                    }
                Button("Add") {
                    Task { await dataStore.createDraftTodo() }
                }
                .disabled(dataStore.draftTodoTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            HStack {
                Button("Open App") {
                    NSWorkspace.shared.open(MFTrackerConstants.expoDeepLink)
                }
                Spacer()
                Button("Sign Out", role: .destructive) {
                    Task { await session.logout() }
                }
            }
        }
    }
}

struct TasksSection: View {
    @EnvironmentObject private var dataStore: TrackerDataStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("My tasks")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(dataStore.openCount) open")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if dataStore.openTodos.isEmpty {
                Text("No open tasks")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(dataStore.openTodos.prefix(12)) { todo in
                    HStack(alignment: .top, spacing: 8) {
                        Button {
                            Task { await dataStore.toggleTodo(todo) }
                        } label: {
                            Image(systemName: todo.completed ? "checkmark.circle.fill" : "circle")
                        }
                        .buttonStyle(.borderless)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(todo.title)
                                .font(.body)
                                .lineLimit(2)
                            if let due = todo.dueAt {
                                Text(due, style: .date)
                                    .font(.caption2)
                                    .foregroundStyle(due < Date() ? .red : .secondary)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                }
            }
        }
    }
}

struct ProjectsSection: View {
    @EnvironmentObject private var dataStore: TrackerDataStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Projects")
                .font(.subheadline.weight(.semibold))

            if dataStore.organizations.isEmpty {
                Text("No organizations")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Picker("Organization", selection: Binding(
                    get: { dataStore.selectedOrganizationId ?? "" },
                    set: { id in
                        Task { await dataStore.selectOrganization(id) }
                    }
                )) {
                    ForEach(dataStore.organizations) { org in
                        Text(org.name).tag(org.id)
                    }
                }

                if dataStore.projects.isEmpty {
                    Text("No projects in this org")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Picker("Project", selection: Binding(
                        get: { dataStore.selectedProjectId ?? "" },
                        set: { id in
                            Task { await dataStore.selectProject(id) }
                        }
                    )) {
                        ForEach(dataStore.projects) { project in
                            Text(project.name).tag(project.id)
                        }
                    }

                    if let pulse = dataStore.projectPulse {
                        HStack {
                            Label("\(pulse.openCount) open", systemImage: "circle")
                            Label("\(pulse.doneCount) done", systemImage: "checkmark.circle")
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
}

struct FocusTimerSection: View {
    @EnvironmentObject private var timerStore: FocusTimerStore

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Focus timer")
                .font(.subheadline.weight(.semibold))
            Text(timerStore.state.displayString)
                .font(.system(.title, design: .rounded).monospacedDigit())
            HStack {
                ForEach(FocusTimerState.presets, id: \.self) { seconds in
                    Button("\(seconds / 60)m") {
                        timerStore.applyPreset(seconds: seconds)
                        WidgetReloader.reload()
                    }
                }
            }
            HStack {
                if timerStore.state.isRunning {
                    Button("Pause") {
                        timerStore.pause()
                        WidgetReloader.reload()
                    }
                } else {
                    Button("Start") {
                        timerStore.start()
                        WidgetReloader.reload()
                    }
                    .disabled(timerStore.state.remainingSeconds == 0)
                }
                Button("Reset") {
                    timerStore.reset()
                    WidgetReloader.reload()
                }
            }
        }
    }
}
