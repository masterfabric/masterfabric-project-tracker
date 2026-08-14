import AppIntents
import MFTrackerKit
import SwiftUI
import WidgetKit

struct ChatNotificationsEntry: TimelineEntry {
    let date: Date
    let isAuthenticated: Bool
    let messages: [OrganizationMessage]
    let organizationName: String?
    let unreadCount: Int
}

struct ChatNotificationsProvider: TimelineProvider {
    func placeholder(in context: Context) -> ChatNotificationsEntry {
        ChatNotificationsEntry(
            date: Date(),
            isAuthenticated: true,
            messages: [
                OrganizationMessage(id: "1", organizationID: "o", authorUserID: "u", authorNickname: "Alex", body: "Ship notes ready.", createdAt: Date().addingTimeInterval(-600)),
                OrganizationMessage(id: "2", organizationID: "o", authorUserID: "u2", authorNickname: "Sam", body: "Dashboard charts look good.", createdAt: Date().addingTimeInterval(-120)),
            ],
            organizationName: "MasterFabric Demo Organization",
            unreadCount: 2
        )
    }
    func getSnapshot(in context: Context, completion: @escaping (ChatNotificationsEntry) -> Void) {
        completion(Self.makeEntry())
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<ChatNotificationsEntry>) -> Void) {
        let entry = Self.makeEntry()
        let seconds = entry.isAuthenticated ? 10 * 60.0 : MFTrackerConstants.signedOutWidgetRecheckSeconds
        completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(seconds))))
    }
    private static func makeEntry() -> ChatNotificationsEntry {
        AppGroupStore.flushSuiteToDisk()
        let s = AppGroupStore.loadSnapshotForWidgets()
        let authenticated = s.isAuthenticated || AppGroupStore.widgetIsAuthenticated
        guard authenticated else {
            return ChatNotificationsEntry(
                date: Date(),
                isAuthenticated: false,
                messages: [],
                organizationName: nil,
                unreadCount: 0
            )
        }
        return ChatNotificationsEntry(
            date: Date(),
            isAuthenticated: true,
            messages: Array(s.recentMessages.prefix(8)),
            organizationName: s.chatOrganizationName,
            unreadCount: s.unreadMessageCount
        )
    }
}

struct ChatNotificationsWidget: Widget {
    let kind = "ChatNotificationsWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ChatNotificationsProvider()) { entry in
            ChatNotificationsView(entry: entry)
                .containerBackground(for: .widget) { TrackerWidgetGlassBackground() }
                .widgetURL(entry.isAuthenticated ? TrackerDeepLink.url(.chat) : TrackerDeepLink.url(.login))
        }
        .configurationDisplayName("Project Tracker Notifications")
        .description("Small: glance unread. Medium/Large: message cards.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct ChatNotificationsView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ChatNotificationsEntry
    private var chatTint: Color { TrackerTheme.chat }

    var body: some View {
        Group {
            if entry.isAuthenticated {
                Button(intent: OpenTrackerDestinationIntent(destination: .chat)) {
                    chatContent
                }
                .buttonStyle(.plain)
            } else {
                Button(intent: OpenLoginIntent()) {
                    chatContent
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var chatContent: some View {
        Group {
            if !entry.isAuthenticated {
                WidgetGraphics.SignInEmptyState(tint: chatTint, compact: family == .systemSmall)
            } else {
                switch family {
                case .systemSmall: smallBody
                case .systemLarge: largeBody
                default: mediumBody
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .contentShape(Rectangle())
    }

    /// Small = unread glance — no essay.
    private var smallBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: entry.unreadCount > 0 ? "bell.badge.fill" : "bubble.left.fill")
                    .font(.title3.weight(.bold))
                    .foregroundStyle(chatTint)
                Spacer(minLength: 0)
                Text("\(entry.unreadCount)")
                    .font(.largeTitle.bold().monospacedDigit())
                    .foregroundStyle(chatTint)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
            }
            Text("Chat")
                .font(.caption.weight(.bold))
            if let first = entry.messages.first {
                Text(first.body)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            } else {
                Text("No messages")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
    }

    /// Medium = header + up to 3 cards, or compact empty (no ghost plates).
    private var mediumBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            if entry.messages.isEmpty {
                emptyState(subtitle: "Open Chat, then Refresh")
            } else {
                ForEach(entry.messages.prefix(3)) { message in
                    notificationCard(message, lines: 1)
                }
            }
            Spacer(minLength: 0)
        }
    }

    /// Large = org + up to 6 cards, or compact empty (no ghost plates).
    private var largeBody: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            if let org = entry.organizationName {
                Text(org)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            if entry.messages.isEmpty {
                emptyState(subtitle: "Open Chat in the menu bar")
            } else {
                ForEach(entry.messages.prefix(6)) { message in
                    notificationCard(message, lines: 2)
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func emptyState(subtitle: String) -> some View {
        VStack(spacing: 8) {
            Spacer(minLength: 0)
            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(chatTint.opacity(0.85))
            Text("No messages")
                .font(.subheadline.weight(.semibold))
            Text(subtitle)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
    }

    private var header: some View {
        HStack(spacing: 6) {
            Image(systemName: entry.unreadCount > 0 ? "bell.badge.fill" : "bubble.left.and.bubble.right.fill")
                .font(.caption.weight(.bold))
                .foregroundStyle(chatTint)
            Text("Notifications")
                .font(.headline.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.85)
            Spacer(minLength: 0)
            Text("\(entry.unreadCount)")
                .font(.caption2.weight(.bold).monospacedDigit())
                .foregroundStyle(entry.unreadCount > 0 ? Color.white : .secondary)
                .padding(.horizontal, 7)
                .padding(.vertical, 2)
                .background {
                    Capsule().fill(entry.unreadCount > 0 ? chatTint : Color.primary.opacity(0.08))
                }
        }
    }

    private func notificationCard(_ message: OrganizationMessage, lines: Int) -> some View {
        HStack(alignment: .top, spacing: 8) {
            ZStack {
                Circle()
                    .fill(chatTint.opacity(0.85))
                    .frame(width: 22, height: 22)
                Text(initials(message.authorNickname))
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(.white)
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(message.authorNickname.isEmpty ? "Member" : message.authorNickname)
                        .font(.caption.weight(.bold))
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    if let created = message.createdAt {
                        Text(created, style: .time).font(.caption2).foregroundStyle(.secondary)
                    }
                }
                Text(message.body)
                    .font(.caption2)
                    .foregroundStyle(.primary)
                    .lineLimit(lines)
            }
        }
        .padding(7)
        .background {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(Color.black.opacity(0.22))
        }
        .overlay {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .strokeBorder(chatTint.opacity(0.22), lineWidth: 0.6)
        }
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        if parts.isEmpty { return "?" }
        return parts.map { String($0.prefix(1)).uppercased() }.joined()
    }
}
