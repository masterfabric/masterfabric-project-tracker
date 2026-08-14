import AppKit
import MFTrackerKit
import SwiftUI

struct QuickActionsSection: View {
    @EnvironmentObject private var dataStore: TrackerDataStore
    @EnvironmentObject private var accentStore: AccentPreferenceStore
    /// When false, parent already drew the Tasks section header — keep a compact “New” row only.
    var showsInnerHeader: Bool = true
    @State private var isComposing = false

    private var canAdd: Bool {
        !dataStore.draftTodoTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var accent: Color { accentStore.color }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if isComposing {
                composeHeader
                composeRow
                if dataStore.taskScope == .project {
                    projectHintRow
                }
            } else {
                collapsedNewButton
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .mfFocusComposeField)) { _ in
            if dataStore.taskScope != .personal {
                dataStore.setTaskScope(.personal)
            }
            isComposing = true
        }
    }

    /// Intentional entry — no always-visible field that invites accidental submits.
    private var collapsedNewButton: some View {
        Button {
            // Default new work to personal so menu-bar Add never surprises into project scope.
            if dataStore.taskScope != .personal {
                dataStore.setTaskScope(.personal)
            }
            isComposing = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: TrackerTheme.Symbol.add)
                    .font(.system(size: 14, weight: .bold))
                Text("New")
                    .font(.caption.weight(.semibold))
                Spacer(minLength: 0)
            }
            .foregroundStyle(accent)
            .frame(minHeight: TrackerTheme.Chrome.hitTarget)
            .padding(.horizontal, 12)
            .background {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(accent.opacity(0.1))
            }
            .overlay {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .strokeBorder(accent.opacity(0.22), lineWidth: 0.6)
            }
            .contentShape(Rectangle())
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("New task")
        .help("Create a personal or project task")
    }

    private var composeHeader: some View {
        HStack(spacing: 8) {
            Text("New task")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Spacer(minLength: 0)
            MenuBarIconButton(
                systemImage: "xmark",
                tint: .secondary,
                help: "Cancel"
            ) {
                dismissCompose()
            }
            .accessibilityLabel("Cancel new task")
        }
    }

    private var composeRow: some View {
        HStack(spacing: 8) {
            Picker("Scope", selection: Binding(
                get: { dataStore.taskScope },
                set: { dataStore.setTaskScope($0) }
            )) {
                ForEach(TrackerTaskScope.allCases) { scope in
                    Text(scope.label).tag(scope)
                }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .frame(width: 92)
            .frame(minHeight: TrackerTheme.Chrome.hitTarget)
            .layoutPriority(0)
            .accessibilityLabel("Task scope")

            MenuBarTextField(
                text: $dataStore.draftTodoTitle,
                placeholder: dataStore.draftPlaceholder,
                onSubmit: { Task { await submitCompose() } }
            )
            .frame(maxWidth: .infinity)
            .frame(height: 28)
            .layoutPriority(1)
            .accessibilityLabel("Task title")

            Button {
                Task { await submitCompose() }
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(canAdd ? accent : Color.secondary.opacity(0.4))
                    .frame(width: TrackerTheme.Chrome.hitTarget, height: TrackerTheme.Chrome.hitTarget)
                    .background {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(canAdd ? accent.opacity(0.14) : Color.primary.opacity(0.04))
                    }
            }
            .buttonStyle(.plain)
            .disabled(!canAdd)
            .layoutPriority(2)
            .accessibilityLabel("Add task")
            .help("Add")
        }
        .frame(maxWidth: .infinity)
    }

    private var projectHintRow: some View {
        HStack(spacing: 4) {
            Image(systemName: "folder.fill")
                .font(.system(size: 8, weight: .semibold))
                .foregroundStyle(accent.opacity(0.7))
            Text(projectHint)
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var projectHint: String {
        if dataStore.projects.isEmpty {
            return "Pick org/project under Projects first."
        }
        return dataStore.selectedProjectName.map { "Creating in \($0)" } ?? "Select a project"
    }

    private func dismissCompose() {
        dataStore.draftTodoTitle = ""
        isComposing = false
    }

    private func submitCompose() async {
        let title = dataStore.draftTodoTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        let ok = await dataStore.createDraftTodo()
        if ok {
            isComposing = false
        }
    }
}

/// Time-bucket filters inside the Tasks tab.
///
/// Rules (real `dueAt` only — no invented statuses):
/// - **Today**: overdue + due today (Personal / Project). Undated open tasks follow in a
///   trailing **No due date** subsection.
/// - **Week**: overdue + due within the next 7 calendar days (incl. today). Undated excluded
///   (they live under Today → No due date).
/// - **All**: every open personal + project task, Personal / Project grouped.
private enum TasksTimeFilter: String, CaseIterable, Identifiable {
    case today
    case week
    case all

    var id: String { rawValue }

    /// Short label for equal-width slice columns.
    var title: String {
        switch self {
        case .today: return "Today"
        case .week: return "Week"
        case .all: return "All"
        }
    }

    var accessibilityTitle: String {
        switch self {
        case .today: return "Today"
        case .week: return "This week"
        case .all: return "All"
        }
    }

    var systemImage: String {
        switch self {
        case .today: return "sun.max"
        case .week: return "calendar"
        case .all: return "list.bullet"
        }
    }

    func matches(_ dueAt: Date?) -> Bool {
        switch self {
        case .today:
            return TaskDueCaption.isOverdue(dueAt) || TaskDueCaption.isDueToday(dueAt)
        case .week:
            return TaskDueCaption.isOverdue(dueAt) || TaskDueCaption.isDueWithinDays(dueAt, days: 7)
        case .all:
            return true
        }
    }
}

struct TasksSection: View {
    @EnvironmentObject private var dataStore: TrackerDataStore
    @EnvironmentObject private var accentStore: AccentPreferenceStore
    /// When false, parent draws the Tasks section header (counts / overdue live there).
    var showsInnerHeader: Bool = true
    @State private var timeFilter: TasksTimeFilter = .today

    private var accent: Color { accentStore.color }

    private var overdueCount: Int {
        let personal = dataStore.openPersonalTodos.filter { TaskDueCaption.isOverdue($0.dueAt) }.count
        let project = dataStore.openProjectTodos.filter { TaskDueCaption.isOverdue($0.dueAt) }.count
        return personal + project
    }

    /// Dated tasks for the active filter (Today / This week / All), sorted by urgency.
    private var personalFiltered: [UserTodo] {
        Array(
            dataStore.openPersonalTodos
                .filter { timeFilter.matches($0.dueAt) }
                .sorted { TaskDueCaption.sortByDue($0.dueAt, $1.dueAt) }
                .prefix(timeFilter == .all ? 12 : 16)
        )
    }

    private var projectFiltered: [OrganizationProjectTodo] {
        Array(
            dataStore.openProjectTodos
                .filter { timeFilter.matches($0.dueAt) }
                .sorted { TaskDueCaption.sortByDue($0.dueAt, $1.dueAt) }
                .prefix(timeFilter == .all ? 14 : 16)
        )
    }

    /// Undated open tasks — shown only under **Today** as a secondary subsection.
    private var personalUndated: [UserTodo] {
        guard timeFilter == .today else { return [] }
        return Array(
            dataStore.openPersonalTodos
                .filter { $0.dueAt == nil }
                .prefix(8)
        )
    }

    private var projectUndated: [OrganizationProjectTodo] {
        guard timeFilter == .today else { return [] }
        return Array(
            dataStore.openProjectTodos
                .filter { $0.dueAt == nil }
                .prefix(8)
        )
    }

    private var filterEmpty: Bool {
        personalFiltered.isEmpty && projectFiltered.isEmpty && personalUndated.isEmpty && projectUndated.isEmpty
    }

    private func sliceCount(_ filter: TasksTimeFilter) -> Int {
        switch filter {
        case .today:
            let datedP = dataStore.openPersonalTodos.filter {
                TaskDueCaption.isOverdue($0.dueAt) || TaskDueCaption.isDueToday($0.dueAt)
            }.count
            let datedJ = dataStore.openProjectTodos.filter {
                TaskDueCaption.isOverdue($0.dueAt) || TaskDueCaption.isDueToday($0.dueAt)
            }.count
            let undated = dataStore.openPersonalTodos.filter { $0.dueAt == nil }.count
                + dataStore.openProjectTodos.filter { $0.dueAt == nil }.count
            return datedP + datedJ + undated
        case .week:
            let p = dataStore.openPersonalTodos.filter {
                TaskDueCaption.isOverdue($0.dueAt) || TaskDueCaption.isDueWithinDays($0.dueAt, days: 7)
            }.count
            let j = dataStore.openProjectTodos.filter {
                TaskDueCaption.isOverdue($0.dueAt) || TaskDueCaption.isDueWithinDays($0.dueAt, days: 7)
            }.count
            return p + j
        case .all:
            return dataStore.openCount
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if showsInnerHeader {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    HStack(spacing: 5) {
                        Image(systemName: "checklist")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(accent)
                        Text("Open tasks")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    .layoutPriority(1)
                    Spacer(minLength: 4)
                    Text("\(dataStore.openPersonalTodos.count) personal · \(dataStore.openProjectTodos.count) project")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .layoutPriority(0)
                }

                if overdueCount > 0 {
                    Text("\(overdueCount) overdue")
                        .font(.caption2.weight(.semibold).monospacedDigit())
                        .foregroundStyle(TrackerTheme.danger)
                }
            }

            timeFilterBar

            Group {
                if dataStore.openCount == 0 {
                    MenuBarEmptyHint(
                        systemImage: TrackerTheme.Symbol.emptyTasks,
                        message: "No open personal or project tasks — tap New to add one.",
                        tint: accent
                    )
                } else if filterEmpty {
                    MenuBarEmptyHint(
                        systemImage: emptyFilterSymbol,
                        message: emptyFilterMessage,
                        tint: accent
                    )
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 6) {
                            if !personalFiltered.isEmpty {
                                taskGroupHeader(
                                    title: "Personal",
                                    systemImage: "person.fill",
                                    tint: TrackerTheme.personal,
                                    count: personalFiltered.count
                                )
                                ForEach(personalFiltered) { todo in
                                    TaskLine(
                                        title: todo.title,
                                        isOpen: !todo.completed,
                                        dueAt: todo.dueAt,
                                        scope: .personal,
                                        projectChip: nil,
                                        statusLabel: todo.completed ? "Done" : nil,
                                        onToggle: { Task { await dataStore.toggleTodo(todo) } }
                                    )
                                }
                            }

                            if !projectFiltered.isEmpty {
                                taskGroupHeader(
                                    title: dataStore.selectedProjectName.map { "Project · \($0)" } ?? "Project",
                                    systemImage: "folder.fill",
                                    tint: accent,
                                    count: projectFiltered.count
                                )
                                ForEach(projectFiltered) { todo in
                                    TaskLine(
                                        title: todo.title,
                                        isOpen: todo.isOpen,
                                        dueAt: todo.dueAt,
                                        scope: .project,
                                        projectChip: dataStore.selectedProjectName,
                                        statusLabel: todo.isOpen ? nil : todo.status.capitalized,
                                        onToggle: { Task { await dataStore.toggleProjectTodo(todo) } }
                                    )
                                }
                            }

                            if !personalUndated.isEmpty || !projectUndated.isEmpty {
                                taskGroupHeader(
                                    title: "No due date",
                                    systemImage: "calendar.badge.minus",
                                    tint: .secondary,
                                    count: personalUndated.count + projectUndated.count
                                )
                                ForEach(personalUndated) { todo in
                                    TaskLine(
                                        title: todo.title,
                                        isOpen: !todo.completed,
                                        dueAt: todo.dueAt,
                                        scope: .personal,
                                        projectChip: nil,
                                        statusLabel: todo.completed ? "Done" : nil,
                                        onToggle: { Task { await dataStore.toggleTodo(todo) } }
                                    )
                                }
                                ForEach(projectUndated) { todo in
                                    TaskLine(
                                        title: todo.title,
                                        isOpen: todo.isOpen,
                                        dueAt: todo.dueAt,
                                        scope: .project,
                                        projectChip: dataStore.selectedProjectName,
                                        statusLabel: todo.isOpen ? nil : todo.status.capitalized,
                                        onToggle: { Task { await dataStore.toggleProjectTodo(todo) } }
                                    )
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                        .padding(.trailing, 2)
                    }
                    .scrollIndicators(.hidden)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    /// Equal-width Today / Week / All slices — icon + label scale; count stays visible.
    private var timeFilterBar: some View {
        HStack(spacing: 6) {
            ForEach(TasksTimeFilter.allCases) { filter in
                let selected = timeFilter == filter
                let count = sliceCount(filter)
                Button {
                    timeFilter = filter
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: filter.systemImage)
                            .font(.system(size: 11, weight: .semibold))
                            .layoutPriority(2)
                        Text(filter.title)
                            .font(.system(size: 11, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                            .layoutPriority(0)
                        Spacer(minLength: 2)
                        Text("\(count)")
                            .font(.system(size: 11, weight: .bold).monospacedDigit())
                            .lineLimit(1)
                            .layoutPriority(3)
                    }
                    .foregroundStyle(selected ? accent : Color.secondary.opacity(0.8))
                    .padding(.horizontal, 8)
                    .frame(maxWidth: .infinity)
                    .frame(height: TrackerTheme.Chrome.hitTarget)
                    .background {
                        RoundedRectangle(cornerRadius: 9, style: .continuous)
                            .fill(selected ? accent.opacity(0.14) : Color.primary.opacity(0.04))
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: 9, style: .continuous)
                            .strokeBorder(selected ? accent.opacity(0.35) : Color.clear, lineWidth: 0.8)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(filter.accessibilityTitle), \(count) tasks")
                .accessibilityAddTraits(selected ? [.isSelected, .isButton] : .isButton)
                .help(filter.accessibilityTitle)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Task time filter")
    }

    private var emptyFilterSymbol: String {
        switch timeFilter {
        case .today: return "sun.max"
        case .week: return "calendar"
        case .all: return TrackerTheme.Symbol.emptyTasks
        }
    }

    private var emptyFilterMessage: String {
        switch timeFilter {
        case .today:
            return "Nothing due today or overdue."
        case .week:
            let undated = dataStore.openPersonalTodos.filter { $0.dueAt == nil }.count
                + dataStore.openProjectTodos.filter { $0.dueAt == nil }.count
            if undated > 0 {
                return "Nothing due in the next 7 days. \(undated) undated task\(undated == 1 ? "" : "s") live under Today → No due date."
            }
            return "Nothing due in the next 7 days or overdue."
        case .all:
            return "No open personal or project tasks — tap New to add one."
        }
    }

    private func taskGroupHeader(title: String, systemImage: String, tint: Color, count: Int) -> some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(tint)
                .frame(width: 18, height: 18)
                .layoutPriority(1)
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.tail)
                .layoutPriority(0)
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
            Text("\(count)")
                .font(.caption2.monospacedDigit().weight(.semibold))
                .foregroundStyle(tint.opacity(0.9))
                .lineLimit(1)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background {
                    Capsule(style: .continuous)
                        .fill(tint.opacity(0.12))
                }
                .layoutPriority(2)
        }
        .padding(.top, 6)
        .frame(maxWidth: .infinity)
        .frame(minHeight: TrackerTheme.Chrome.rowMinHeight)
    }
}

struct ProjectsSection: View {
    @EnvironmentObject private var dataStore: TrackerDataStore
    @EnvironmentObject private var accentStore: AccentPreferenceStore
    var showsInnerHeader: Bool = true

    private var accent: Color { accentStore.color }
    private var projectsOpen: Int { dataStore.openProjectTodos.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if showsInnerHeader {
                HStack(spacing: 5) {
                    Image(systemName: "folder.fill")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(accent)
                    Text("Projects")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            } else {
                MenuBarSectionHeader(
                    title: "Projects",
                    systemImage: projectsOpen > 0 ? "folder.fill" : "folder",
                    tint: accent,
                    trailing: dataStore.selectedProjectName
                )
            }

            if dataStore.organizations.isEmpty {
                MenuBarEmptyHint(
                    systemImage: "building.2.fill",
                    message: "No organizations yet — join one on mobile or web.",
                    tint: accent
                )
            } else {
                HStack(spacing: 8) {
                    Label("Organization", systemImage: "building.2.fill")
                        .labelStyle(.titleAndIcon)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .symbolRenderingMode(.hierarchical)
                        .lineLimit(1)
                        .layoutPriority(0)
                    Spacer(minLength: 4)
                    Picker("", selection: Binding(
                        get: { dataStore.selectedOrganizationId ?? "" },
                        set: { id in Task { await dataStore.selectOrganization(id) } }
                    )) {
                        ForEach(dataStore.organizations) { org in
                            Text(org.name).tag(org.id)
                        }
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .trailing)
                    .layoutPriority(1)
                }
                .frame(maxWidth: .infinity)

                HStack(spacing: 8) {
                    Label("Project", systemImage: "folder.fill")
                        .labelStyle(.titleAndIcon)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .symbolRenderingMode(.hierarchical)
                        .lineLimit(1)
                        .layoutPriority(0)
                    Spacer(minLength: 4)
                    Picker("", selection: Binding(
                        get: { dataStore.selectedProjectId ?? "" },
                        set: { id in Task { await dataStore.selectProject(id) } }
                    )) {
                        if dataStore.projects.isEmpty {
                            Text("No projects").tag("")
                        } else {
                            ForEach(dataStore.projects) { project in
                                Text(project.name).tag(project.id)
                            }
                        }
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                    .disabled(dataStore.projects.isEmpty)
                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .trailing)
                    .layoutPriority(1)
                }
                .frame(maxWidth: .infinity)

                if let pulse = dataStore.projectPulse {
                    HStack(spacing: 8) {
                        Label("Pulse", systemImage: "waveform.path.ecg")
                            .labelStyle(.titleAndIcon)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .symbolRenderingMode(.hierarchical)
                            .lineLimit(1)
                            .layoutPriority(0)
                        Spacer(minLength: 4)
                        TrackerScopeChip(
                            "\(pulse.openCount) open",
                            emphasized: pulse.openCount > 0,
                            tint: accent
                        )
                        TrackerScopeChip(
                            "\(pulse.doneCount) done",
                            emphasized: false,
                            tint: TrackerTheme.personal
                        )
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct FocusTimerSection: View {
    @EnvironmentObject private var timerStore: FocusTimerStore
    @EnvironmentObject private var dataStore: TrackerDataStore
    @EnvironmentObject private var accentStore: AccentPreferenceStore
    var showsInnerHeader: Bool = true

    private var openTasks: [TrackerTaskItem] { dataStore.openTrackerTasks }
    private var running: Bool { timerStore.state.isRunning }
    private var accent: Color { accentStore.color }
    private var focusTint: Color { TrackerTheme.focusTint(running: running) }
    private var focusIcon: String { running ? "timer.circle.fill" : "timer" }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if showsInnerHeader {
                HStack(spacing: 5) {
                    Image(systemName: focusIcon)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(focusTint)
                    Text("Focus")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(focusTint)
                }
            } else {
                MenuBarSectionHeader(
                    title: "Focus",
                    systemImage: focusIcon,
                    tint: focusTint,
                    trailing: running ? timerStore.state.displayString : nil
                )
            }

            HStack {
                Label("Timer", systemImage: "hourglass")
                    .labelStyle(.titleAndIcon)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .symbolRenderingMode(.hierarchical)
                    .lineLimit(1)
                    .layoutPriority(0)
                Spacer(minLength: 4)
                Text(timerStore.state.displayString)
                    .font(.title3.monospacedDigit().weight(.semibold))
                    .foregroundStyle(running ? accent : .primary)
                    .lineLimit(1)
                    .layoutPriority(1)
            }
            .padding(.vertical, 6)
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity)
            .background {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(running ? accent.opacity(0.12) : Color.primary.opacity(0.04))
            }
            .overlay {
                if running {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(accent.opacity(0.32), lineWidth: 0.6)
                }
            }

            if let title = timerStore.state.focusTaskDisplayTitle, !title.isEmpty {
                HStack(spacing: 8) {
                    Label("Focusing", systemImage: "target")
                        .labelStyle(.titleAndIcon)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .symbolRenderingMode(.hierarchical)
                        .lineLimit(1)
                        .layoutPriority(0)
                    Spacer(minLength: 4)
                    Text(title)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(accent)
                        .lineLimit(1)
                        .truncationMode(.tail)
                        .frame(minWidth: 0, maxWidth: .infinity, alignment: .trailing)
                        .layoutPriority(1)
                }
                .frame(maxWidth: .infinity)
            }

            HStack(spacing: 8) {
                Label("Task", systemImage: "checklist")
                    .labelStyle(.titleAndIcon)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .symbolRenderingMode(.hierarchical)
                    .lineLimit(1)
                    .layoutPriority(0)
                Spacer(minLength: 4)
                Picker("", selection: Binding(
                    get: { timerStore.state.selectedFocusTaskId ?? "" },
                    set: { id in
                        if id.isEmpty {
                            timerStore.selectFocusTask(nil)
                        } else if let task = openTasks.first(where: { $0.id == id }) {
                            timerStore.selectFocusTask(task)
                        }
                        WidgetReloader.reload()
                    }
                )) {
                    Text("None").tag("")
                    ForEach(openTasks) { task in
                        Text(taskPickerLabel(task)).tag(task.id)
                    }
                }
                .labelsHidden()
                .pickerStyle(.menu)
                .disabled(openTasks.isEmpty)
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .trailing)
                .layoutPriority(1)
            }
            .frame(maxWidth: .infinity)

            HStack(spacing: 6) {
                ForEach(FocusTimerState.presets, id: \.self) { seconds in
                    Button("\(seconds / 60)m") {
                        timerStore.applyPreset(seconds: seconds)
                        WidgetReloader.reload()
                    }
                    .buttonStyle(.plain)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(accent.opacity(0.9))
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: TrackerTheme.Chrome.hitTarget)
                    .background {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(accent.opacity(0.1))
                    }
                }
                if running {
                    MenuBarIconButton(
                        systemImage: "pause.fill",
                        tint: accent,
                        help: "Pause"
                    ) {
                        timerStore.pause()
                        WidgetReloader.reload()
                    }
                    .accessibilityLabel("Pause")
                } else {
                    MenuBarIconButton(
                        systemImage: "play.fill",
                        tint: timerStore.canStart ? accent : Color.secondary.opacity(0.4),
                        help: "Start",
                        disabled: !timerStore.canStart,
                        emphasized: timerStore.canStart
                    ) {
                        timerStore.start()
                        WidgetReloader.reload()
                    }
                    .accessibilityLabel("Start")
                }
                MenuBarIconButton(
                    systemImage: "arrow.counterclockwise",
                    tint: .secondary,
                    help: "Reset"
                ) {
                    timerStore.reset()
                    WidgetReloader.reload()
                }
                .accessibilityLabel("Reset")
            }
            .frame(maxWidth: .infinity)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func taskPickerLabel(_ task: TrackerTaskItem) -> String {
        let prefix = task.scope == .personal ? "Personal" : (task.projectName ?? "Project")
        return "\(prefix): \(task.title)"
    }
}

struct ChatSection: View {
    @EnvironmentObject private var dataStore: TrackerDataStore
    /// When true, fill parent height: message list scrolls; compose stays pinned below.
    var expanded: Bool = false
    var showsInnerHeader: Bool = true
    /// Optional fixed message viewport (legacy). Prefer nil + expanded fill layout.
    var messageAreaHeight: CGFloat? = nil
    @State private var composeNonEmpty = false
    @State private var scrollToBottomTick = 0

    private var canSend: Bool {
        composeNonEmpty || !dataStore.draftChatBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var previewMessages: [OrganizationMessage] {
        let all = dataStore.chatMessagesOldestFirst
        return expanded ? all : Array(all.suffix(4))
    }

    private var chatTint: Color {
        dataStore.unreadChatCount > 0 ? TrackerTheme.chat : .secondary
    }

    private var chatIcon: String {
        dataStore.unreadChatCount > 0 ? "bubble.left.and.bubble.right.fill" : "bubble.left.fill"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if showsInnerHeader {
                HStack(spacing: 8) {
                    HStack(spacing: 5) {
                        Image(systemName: chatIcon)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(chatTint)
                        Text("Chat")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(chatTint)
                            .lineLimit(1)
                    }
                    .layoutPriority(1)
                    if dataStore.unreadChatCount > 0 {
                        Text("\(min(dataStore.unreadChatCount, 99))")
                            .font(.caption2.weight(.bold).monospacedDigit())
                            .foregroundStyle(.white)
                            .lineLimit(1)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(Capsule().fill(TrackerTheme.chat.opacity(0.85)))
                            .layoutPriority(1)
                    }
                    Spacer(minLength: 4)
                    if let org = dataStore.organizations.first(where: { $0.id == dataStore.selectedOrganizationId }) {
                        Text(org.name)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                            .lineLimit(1)
                            .truncationMode(.tail)
                            .frame(minWidth: 0, maxWidth: 140, alignment: .trailing)
                            .layoutPriority(0)
                    }
                }
                .frame(maxWidth: .infinity)
            } else {
                MenuBarSectionHeader(
                    title: "Chat",
                    systemImage: chatIcon,
                    tint: dataStore.unreadChatCount > 0 ? TrackerTheme.chat : TrackerTheme.chat.opacity(0.75),
                    trailing: dataStore.organizations.first(where: { $0.id == dataStore.selectedOrganizationId })?.name,
                    badge: dataStore.unreadChatCount > 0
                        ? "\(min(dataStore.unreadChatCount, 99))"
                        : nil,
                    badgeTint: TrackerTheme.chat
                )
            }

            if dataStore.organizations.count > 1 {
                HStack(spacing: 8) {
                    Label("Organization", systemImage: "building.2.fill")
                        .labelStyle(.titleAndIcon)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .symbolRenderingMode(.hierarchical)
                        .lineLimit(1)
                        .layoutPriority(0)
                    Spacer(minLength: 4)
                    Picker("", selection: Binding(
                        get: { dataStore.selectedOrganizationId ?? "" },
                        set: { id in Task { await dataStore.selectOrganization(id) } }
                    )) {
                        ForEach(dataStore.organizations) { org in
                            Text(org.name).tag(org.id)
                        }
                    }
                    .labelsHidden()
                    .pickerStyle(.menu)
                    .frame(minWidth: 0, maxWidth: .infinity, alignment: .trailing)
                    .layoutPriority(1)
                }
                .frame(maxWidth: .infinity)
            }

            messageArea
                .frame(maxWidth: .infinity, maxHeight: expanded ? .infinity : nil, alignment: .topLeading)
                .layoutPriority(expanded ? 1 : 0)

            if dataStore.selectedOrganizationId != nil {
                HStack(spacing: 8) {
                    MenuBarTextField(
                        text: $dataStore.draftChatBody,
                        placeholder: "Message…",
                        onSubmit: { Task { await sendChat() } },
                        onTextChange: { value in
                            composeNonEmpty = !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        }
                    )
                    .frame(maxWidth: .infinity, minHeight: 28, idealHeight: 28, maxHeight: 28)
                    .layoutPriority(1)

                    Button {
                        Task { await sendChat() }
                    } label: {
                        Image(systemName: "paperplane.fill")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(canSend ? TrackerTheme.chat : Color.secondary.opacity(0.4))
                            .frame(width: TrackerTheme.Chrome.hitTarget, height: TrackerTheme.Chrome.hitTarget)
                            .background {
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(canSend ? TrackerTheme.chat.opacity(0.14) : Color.primary.opacity(0.04))
                            }
                    }
                    .buttonStyle(.plain)
                    .disabled(!canSend)
                    .layoutPriority(2)
                    .accessibilityLabel("Send")
                    .help("Send")
                }
                .frame(maxWidth: .infinity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: expanded ? .infinity : nil, alignment: .topLeading)
        .clipped()
        .onAppear {
            composeNonEmpty = !dataStore.draftChatBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            dataStore.markChatRead()
        }
        .onChange(of: dataStore.draftChatBody) { _, value in
            composeNonEmpty = !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    @ViewBuilder
    private var messageArea: some View {
        if dataStore.selectedOrganizationId == nil {
            MenuBarEmptyHint(
                systemImage: "bubble.left.and.bubble.right",
                message: "Select an organization to chat.",
                tint: TrackerTheme.chat
            )
            .frame(maxWidth: .infinity, minHeight: messageAreaHeight ?? 80, alignment: .topLeading)
        } else if previewMessages.isEmpty {
            MenuBarEmptyHint(
                systemImage: "text.bubble.fill",
                message: "No messages yet — say hello to the team.",
                tint: TrackerTheme.chat
            )
            .frame(maxWidth: .infinity, minHeight: messageAreaHeight ?? 80, alignment: .topLeading)
        } else if expanded {
            GeometryReader { geo in
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 6) {
                            ForEach(previewMessages) { message in
                                chatRow(message)
                                    .id(message.id)
                            }
                        }
                        .padding(.vertical, 2)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                    .scrollIndicators(.hidden)
                    // Hard height from GeometryReader so macOS ScrollView cannot
                    // expand to content size (which made the parent clip with no scroll).
                    .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
                    .onAppear {
                        scrollToLatest(proxy, animated: false)
                    }
                    .onChange(of: scrollToBottomTick) { _, _ in
                        scrollToLatest(proxy, animated: true)
                    }
                    .onChange(of: previewMessages.count) { oldCount, newCount in
                        // Only pin when messages were appended (send / refresh growth),
                        // not on every identity churn — avoids fighting user scroll-up.
                        if newCount > oldCount {
                            scrollToLatest(proxy, animated: true)
                        }
                    }
                }
            }
            .frame(
                maxWidth: .infinity,
                minHeight: messageAreaHeight ?? 120,
                idealHeight: messageAreaHeight,
                maxHeight: messageAreaHeight ?? .infinity
            )
        } else {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(previewMessages) { message in
                    chatRow(message)
                }
            }
        }
    }

    private func chatRow(_ message: OrganizationMessage) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 10))
                .foregroundStyle(TrackerTheme.chat.opacity(0.55))
                .layoutPriority(1)
            Text(message.authorNickname.isEmpty ? "Member" : message.authorNickname)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(TrackerTheme.chat.opacity(0.85))
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(width: 52, alignment: .leading)
                .layoutPriority(1)
            Text(message.body)
                .font(.caption)
                .lineLimit(expanded ? 4 : 2)
                .truncationMode(.tail)
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                .layoutPriority(0)
        }
        .padding(.vertical, 3)
        .padding(.horizontal, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(TrackerTheme.chat.opacity(0.05))
        }
    }

    private func scrollToLatest(_ proxy: ScrollViewProxy, animated: Bool) {
        guard let lastId = previewMessages.last?.id else { return }
        DispatchQueue.main.async {
            if animated {
                withAnimation(.easeOut(duration: 0.15)) {
                    proxy.scrollTo(lastId, anchor: .bottom)
                }
            } else {
                proxy.scrollTo(lastId, anchor: .bottom)
            }
        }
    }

    private func sendChat() async {
        await dataStore.sendDraftChat()
        composeNonEmpty = false
        scrollToBottomTick += 1
    }
}

private struct TaskLine: View {
    let title: String
    let isOpen: Bool
    let dueAt: Date?
    let scope: TrackerTaskScope
    let projectChip: String?
    let statusLabel: String?
    let onToggle: () -> Void

    private var overdue: Bool { TaskDueCaption.isOverdue(dueAt) }
    private var dueLabel: String? { TaskDueCaption.label(for: dueAt) }

    private var circleTint: Color {
        if !isOpen { return TrackerTheme.personal }
        if overdue { return TrackerTheme.danger }
        return TrackerTheme.scopeTint(scope)
    }

    private var dueTint: Color {
        if overdue { return TrackerTheme.danger }
        if TaskDueCaption.isDueToday(dueAt) { return TrackerTheme.userAccent }
        return .secondary
    }

    private var checkIcon: String {
        if !isOpen { return "checkmark.circle.fill" }
        if overdue { return "exclamationmark.circle" }
        return "circle"
    }

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            Button(action: onToggle) {
                Image(systemName: checkIcon)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(circleTint)
                    .frame(width: 24, height: TrackerTheme.Chrome.hitTarget)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .layoutPriority(2)
            .help(isOpen ? "Mark done" : "Reopen")

            Text(title)
                .font(.callout.weight(.medium))
                .foregroundStyle(isOpen ? Color.primary : Color.secondary)
                .strikethrough(!isOpen, color: .secondary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                .layoutPriority(1)

            HStack(spacing: 6) {
                if let projectChip, !projectChip.isEmpty {
                    TrackerScopeChip(
                        projectChip,
                        emphasized: true,
                        tint: TrackerTheme.userAccent
                    )
                    .frame(maxWidth: 88, alignment: .trailing)
                }

                if let statusLabel, !statusLabel.isEmpty {
                    Text(statusLabel)
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }

                if let dueLabel {
                    HStack(spacing: 3) {
                        if overdue {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 9, weight: .bold))
                        } else if TaskDueCaption.isDueToday(dueAt) {
                            Image(systemName: "sun.max.fill")
                                .font(.system(size: 9, weight: .bold))
                        }
                        Text(dueLabel)
                            .font(.caption2.weight(overdue || TaskDueCaption.isDueToday(dueAt) ? .semibold : .regular))
                    }
                    .foregroundStyle(dueTint)
                    .lineLimit(1)
                }
            }
            .layoutPriority(0)
        }
        .padding(.vertical, 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(minHeight: TrackerTheme.Chrome.rowMinHeight + 4)
        .background {
            if overdue && isOpen {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(TrackerTheme.danger.opacity(0.07))
            }
        }
    }
}

/// Compact empty-state row used inside popover sections (theme-tinted icon + invite copy).
struct MenuBarEmptyHint: View {
    let systemImage: String
    let message: String
    var tint: Color = TrackerTheme.userAccent

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            TrackerThemeIcon(systemImage, tint: tint.opacity(0.8), size: 13)
                .frame(width: 18)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Relative due captions from real `dueAt` — no invented statuses.
private enum TaskDueCaption {
    static func label(for date: Date?) -> String? {
        guard let date else { return nil }
        let cal = Calendar.current
        let start = cal.startOfDay(for: Date())
        let dueDay = cal.startOfDay(for: date)
        let days = cal.dateComponents([.day], from: start, to: dueDay).day ?? 0
        switch days {
        case ..<0: return "Overdue"
        case 0: return "Due today"
        case 1: return "Tomorrow"
        default:
            return DateFormatter.shortDate.string(from: date)
        }
    }

    static func isOverdue(_ date: Date?) -> Bool {
        guard let date else { return false }
        return Calendar.current.startOfDay(for: date) < Calendar.current.startOfDay(for: Date())
    }

    static func isDueToday(_ date: Date?) -> Bool {
        guard let date else { return false }
        return Calendar.current.isDateInToday(date)
    }

    /// Inclusive window from start of today through start of today + (`days` - 1).
    /// Example: `days: 7` → today through the next 6 days (a 7-day horizon).
    static func isDueWithinDays(_ date: Date?, days: Int) -> Bool {
        guard let date, days > 0 else { return false }
        let cal = Calendar.current
        let start = cal.startOfDay(for: Date())
        let dueDay = cal.startOfDay(for: date)
        guard dueDay >= start else { return false }
        let end = cal.date(byAdding: .day, value: days - 1, to: start) ?? start
        return dueDay <= end
    }

    /// Overdue / sooner due first; undated last.
    static func sortByDue(_ lhs: Date?, _ rhs: Date?) -> Bool {
        switch (lhs, rhs) {
        case (nil, nil): return false
        case (nil, _): return false
        case (_, nil): return true
        case let (a?, b?): return a < b
        }
    }
}

private extension DateFormatter {
    static let shortDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        return formatter
    }()
}
