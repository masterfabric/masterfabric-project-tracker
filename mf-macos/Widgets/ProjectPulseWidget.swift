import MFTrackerKit
import SwiftUI
import WidgetKit

struct ProjectPulseEntry: TimelineEntry {
    let date: Date
    let pulse: ProjectPulse?
}

struct ProjectPulseProvider: TimelineProvider {
    func placeholder(in context: Context) -> ProjectPulseEntry {
        ProjectPulseEntry(
            date: Date(),
            pulse: ProjectPulse(
                projectId: "p",
                projectName: "Core",
                organizationName: "MasterFabric",
                openCount: 4,
                doneCount: 12
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (ProjectPulseEntry) -> Void) {
        completion(ProjectPulseEntry(date: Date(), pulse: AppGroupStore.loadSnapshot().projectPulse))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ProjectPulseEntry>) -> Void) {
        let entry = ProjectPulseEntry(date: Date(), pulse: AppGroupStore.loadSnapshot().projectPulse)
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct ProjectPulseWidget: Widget {
    let kind = "ProjectPulseWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ProjectPulseProvider()) { entry in
            ProjectPulseView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Project Pulse")
        .description("Open vs done counts for the selected project.")
        .supportedFamilies([.systemMedium])
    }
}

struct ProjectPulseView: View {
    let entry: ProjectPulseEntry

    var body: some View {
        if let pulse = entry.pulse {
            VStack(alignment: .leading, spacing: 8) {
                Text(pulse.projectName)
                    .font(.headline)
                Text(pulse.organizationName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                HStack(spacing: 16) {
                    VStack {
                        Text("\(pulse.openCount)")
                            .font(.largeTitle.bold())
                        Text("Open")
                            .font(.caption)
                    }
                    VStack {
                        Text("\(pulse.doneCount)")
                            .font(.largeTitle.bold())
                        Text("Done")
                            .font(.caption)
                    }
                    Spacer()
                }
            }
            .padding(4)
        } else {
            VStack(alignment: .leading) {
                Text("Project Pulse")
                    .font(.headline)
                Text("Select a project in the menu bar app.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(4)
        }
    }
}
