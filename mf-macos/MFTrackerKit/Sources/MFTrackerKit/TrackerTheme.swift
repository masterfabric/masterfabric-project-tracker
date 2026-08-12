import Combine
import SwiftUI

/// Soft accent presets shared by Desktop Dashboard + WidgetKit (App Group).
public enum TrackerAccentPreset: String, CaseIterable, Codable, Sendable, Identifiable {
    case sky
    case teal
    case mint
    case orange
    case rose
    case violet
    case graphite

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .sky: return "Sky"
        case .teal: return "Teal"
        case .mint: return "Mint"
        case .orange: return "Orange"
        case .rose: return "Rose"
        case .violet: return "Violet"
        case .graphite: return "Graphite"
        }
    }

    /// Flat product tint — solid fill, no bloom.
    public var color: Color {
        switch self {
        case .sky: return Color(red: 0.35, green: 0.58, blue: 0.92)
        case .teal: return Color(red: 0.22, green: 0.62, blue: 0.64)
        case .mint: return Color(red: 0.28, green: 0.72, blue: 0.55)
        case .orange: return Color(red: 0.92, green: 0.55, blue: 0.28)
        case .rose: return Color(red: 0.88, green: 0.42, blue: 0.52)
        case .violet: return Color(red: 0.58, green: 0.48, blue: 0.88)
        case .graphite: return Color(red: 0.45, green: 0.48, blue: 0.52)
        }
    }
}

/// Observable accent preference (app target). Widgets read `AppGroupStore.accentPreset` on timeline.
@MainActor
public final class AccentPreferenceStore: ObservableObject {
    public static let shared = AccentPreferenceStore()

    @Published public var preset: TrackerAccentPreset {
        didSet {
            guard oldValue != preset else { return }
            AppGroupStore.accentPreset = preset
            WidgetReloader.reload()
        }
    }

    public init(preset: TrackerAccentPreset = AppGroupStore.accentPreset) {
        self.preset = preset
        if AppGroupStore.accentPreset != preset {
            AppGroupStore.accentPreset = preset
        }
    }

    public var color: Color { preset.color }

    public func select(_ preset: TrackerAccentPreset) {
        self.preset = preset
    }
}

/// Flat MasterFabric / iStat chrome — solid accent fills, no luminous shadows.
public enum TrackerTheme {
    // MARK: Semantic colors

    public static let danger = Color.red
    public static var overdue: Color { danger }
    /// Focus/timer uses the same user accent as Tasks/Projects (no separate orange system).
    public static var focus: Color { userAccent }
    public static let chat = Color(red: 0.35, green: 0.58, blue: 0.92)
    public static let personal = Color(red: 0.45, green: 0.52, blue: 0.58)

    public static var userAccent: Color { AppGroupStore.accentPreset.color }
    public static var accent: Color { userAccent }
    public static var accentSoft: Color { userAccent.opacity(0.55) }

    public static var tasks: Color { userAccent }
    public static var projects: Color { userAccent }

    public static func label(_ colorScheme: ColorScheme) -> Color { Color.primary }
    public static func secondaryLabel(_ colorScheme: ColorScheme) -> Color { readableSecondary }
    public static func accent(for colorScheme: ColorScheme) -> Color { userAccent }

    /// Readable secondary on dark ultraThinMaterial / black widget chrome.
    /// System `.secondary` often reads as near-invisible charcoal on those surfaces.
    public static var readableSecondary: Color { Color.primary.opacity(0.72) }

    public static let ink = Color.primary
    public static let slate = readableSecondary
    public static let canvas = Color.clear
    public static let surface = Color.clear
    public static let hairline = Color.primary.opacity(0.12)

    public static func canvas(for colorScheme: ColorScheme) -> Color { .clear }
    public static func surface(for colorScheme: ColorScheme) -> Color { .clear }

    public static func scopeTint(_ scope: TrackerTaskScope) -> Color {
        scope == .project ? projects : personal
    }

    public static func tasksTint(overdue: Bool) -> Color {
        overdue ? danger : tasks
    }

    /// Flat chat tint — same readability at zero unread (no muted grey-out).
    public static func chatTint(unread: Bool) -> Color {
        chat
    }

    /// Same accent hue; running is full strength, idle is softer.
    public static func focusTint(running: Bool) -> Color {
        running ? userAccent : userAccent.opacity(0.55)
    }

    // MARK: SF Symbol names

    public enum Symbol {
        public static let tasks = "checklist"
        public static let chat = "bubble.left.fill"
        public static let chatQuiet = "bubble.left"
        public static let chatUnread = "bubble.left.and.bubble.right.fill"
        public static let projects = "folder.fill"
        public static let projectsQuiet = "folder"
        public static let focus = "timer"
        public static let focusActive = "timer.circle.fill"
        public static let personal = "person.fill"
        public static let add = "plus.circle.fill"
        public static let send = "paperplane.fill"
        public static let refresh = "arrow.clockwise"
        public static let settings = "gearshape"
        public static let dashboard = "rectangle.on.rectangle"
        public static let signOut = "rectangle.portrait.and.arrow.right"
        public static let signIn = "arrow.right.circle.fill"
        public static let emptyTasks = "checkmark.circle"
        public static let emptyChat = "text.bubble"
        public static let emptyOrg = "building.2"
        public static let dueOverdue = "exclamationmark.triangle.fill"
        public static let dueToday = "sun.max.fill"
        public static let checkOpen = "circle"
        public static let checkDone = "checkmark.circle.fill"
        public static let checkOverdue = "exclamationmark.circle"
        public static let back = "chevron.left"
    }

    // MARK: Flat chrome (no bloom)

    public enum Chrome {
        public static let iconWellSize: CGFloat = 22
        public static let sectionPadding: CGFloat = 14
        /// Stable MenuBarExtra / NSPopover content width — keep AppKit + SwiftUI in sync.
        public static let popoverWidth: CGFloat = 380
        /// Comfortable menu-bar tap targets without feeling like a phone UI.
        public static let hitTarget: CGFloat = 30
        public static let iconButtonGlyph: CGFloat = 15
        public static let tabIconGlyph: CGFloat = 15
        public static let rowMinHeight: CGFloat = 28

        /// Kept for API compatibility — always clear (no glow).
        public static func glow(_ tint: Color, active: Bool = true) -> Color { .clear }

        public static func wash(_ tint: Color, strong: Bool = false) -> Color {
            tint.opacity(strong ? 0.06 : 0.03)
        }

        public static func iconWell(_ tint: Color) -> Color {
            tint.opacity(0.12)
        }

        public static func badgeFill(_ tint: Color) -> Color {
            tint.opacity(0.12)
        }

        public static func headerWash(_ accent: Color) -> LinearGradient {
            LinearGradient(
                colors: [accent.opacity(0.05), Color.clear],
                startPoint: .top,
                endPoint: .bottom
            )
        }

        public static func accentHairline(_ accent: Color, opacity: Double = 0.35) -> LinearGradient {
            LinearGradient(
                colors: [
                    Color.primary.opacity(0.06),
                    accent.opacity(opacity * 0.35),
                    Color.primary.opacity(0.08),
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
        }
    }

    // MARK: Closed menubar strip — dark capsule + light glyphs (see MenuBarStripRenderer)
    // SwiftUI canvas kept for previews; live NSStatusItem uses AppKit chip renderer.

    public enum Strip {
        public static let rowHeight: CGFloat = 22
        public static let valueInk = Color.white
        public static let iconInk = Color.white
        public static let separator = Color.white.opacity(0.55)
        public static let guestLabel = Color.white

        public static func chipIcon(accent _: Color) -> Color { iconInk }

        public static func chipValue() -> Color { valueInk }
    }
}

/// Flat SF Symbol — solid tint, no shadow bloom.
public struct TrackerThemeIcon: View {
    public let systemImage: String
    public let tint: Color
    public var glowing: Bool
    public var well: Bool
    public var size: CGFloat

    public init(
        _ systemImage: String,
        tint: Color,
        glowing: Bool = false,
        well: Bool = false,
        size: CGFloat = 11
    ) {
        self.systemImage = systemImage
        self.tint = tint
        self.glowing = glowing
        self.well = well
        self.size = size
    }

    public var body: some View {
        Image(systemName: systemImage)
            .font(.system(size: size, weight: .semibold))
            .foregroundStyle(tint)
            .frame(
                width: well ? TrackerTheme.Chrome.iconWellSize : nil,
                height: well ? TrackerTheme.Chrome.iconWellSize : nil
            )
            .background {
                if well {
                    Circle().fill(TrackerTheme.Chrome.iconWell(tint))
                }
            }
    }
}

/// Flat accent hairline.
public struct TrackerAccentHairline: View {
    public var accent: Color
    public var opacity: Double

    public init(accent: Color = TrackerTheme.userAccent, opacity: Double = 0.35) {
        self.accent = accent
        self.opacity = opacity
    }

    public var body: some View {
        Rectangle()
            .fill(TrackerTheme.Chrome.accentHairline(accent, opacity: opacity))
            .frame(height: 1)
            .padding(.horizontal, TrackerTheme.Chrome.sectionPadding)
    }
}

/// System widget glass plate (Desktop / NC widgets).
public struct TrackerWidgetGlassBackground: View {
    public init() {}

    public var body: some View {
        ZStack {
            ContainerRelativeShape()
                .fill(.ultraThinMaterial)
            ContainerRelativeShape()
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.22),
                            TrackerTheme.userAccent.opacity(0.16),
                            Color.white.opacity(0.06),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 0.8
                )
        }
    }
}

public struct TrackerScopeChip: View {
    public let title: String
    public let emphasized: Bool
    public let tint: Color?

    public init(_ title: String, emphasized: Bool = false, tint: Color? = nil) {
        self.title = title
        self.emphasized = emphasized
        self.tint = tint
    }

    public var body: some View {
        let fill = tint ?? (emphasized ? TrackerTheme.userAccent : Color.primary)
        Text(title)
            .font(.caption2.weight(.medium))
            .foregroundStyle(emphasized ? fill : Color.secondary)
            .lineLimit(1)
            .truncationMode(.tail)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background {
                Capsule(style: .continuous)
                    .fill(emphasized ? TrackerTheme.Chrome.badgeFill(fill) : Color.primary.opacity(0.06))
            }
            .overlay {
                Capsule(style: .continuous)
                    .strokeBorder(fill.opacity(emphasized ? 0.22 : 0.08), lineWidth: 0.5)
            }
    }
}

public struct TrackerSectionDivider: View {
    public init() {}

    public var body: some View {
        Rectangle()
            .fill(Color.primary.opacity(0.08))
            .frame(height: 1)
    }
}

public struct TrackerMetricPair: View {
    public let label: String
    public let value: String
    public let tint: Color

    public init(_ label: String, value: String, tint: Color = TrackerTheme.userAccent) {
        self.label = label
        self.value = value
        self.tint = tint
    }

    public var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(label)
                .font(.caption.weight(.medium))
                .foregroundStyle(TrackerTheme.readableSecondary)
            Spacer(minLength: 4)
            Text(value)
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(tint)
        }
    }
}

public struct TrackerMetricStack: View {
    public let value: String
    public let label: String
    public let tint: Color

    public init(value: String, label: String, tint: Color = TrackerTheme.userAccent) {
        self.value = value
        self.label = label
        self.tint = tint
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(value)
                .font(.title3.bold().monospacedDigit())
                .foregroundStyle(tint)
            Text(label)
                .font(.caption2.weight(.medium))
                .foregroundStyle(TrackerTheme.readableSecondary)
        }
    }
}

public struct TrackerSoftCard<Content: View>: View {
    private let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        content
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(.thinMaterial)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.primary.opacity(0.12), lineWidth: 0.6)
            }
    }
}

public struct TrackerAccentSwatchPicker: View {
    @Binding public var selection: TrackerAccentPreset
    public var compact: Bool

    public init(selection: Binding<TrackerAccentPreset>, compact: Bool = false) {
        _selection = selection
        self.compact = compact
    }

    public var body: some View {
        HStack(spacing: compact ? 6 : 8) {
            ForEach(TrackerAccentPreset.allCases) { preset in
                Button {
                    selection = preset
                } label: {
                    Circle()
                        .fill(preset.color)
                        .frame(width: compact ? 14 : 18, height: compact ? 14 : 18)
                        .overlay {
                            Circle()
                                .strokeBorder(Color.white.opacity(0.45), lineWidth: 0.6)
                        }
                        .overlay {
                            if selection == preset {
                                Circle()
                                    .strokeBorder(Color.primary.opacity(0.85), lineWidth: 1.6)
                                    .padding(-2)
                            }
                        }
                }
                .buttonStyle(.plain)
                .help(preset.displayName)
                .accessibilityLabel(preset.displayName)
            }
        }
    }
}

public struct TrackerTaskRow: View {
    public let title: String
    public let scopeBadge: String
    public let scope: TrackerTaskScope
    public let dueAt: Date?
    public var compact: Bool

    public init(
        title: String,
        scopeBadge: String,
        scope: TrackerTaskScope,
        dueAt: Date? = nil,
        compact: Bool = false
    ) {
        self.title = title
        self.scopeBadge = scopeBadge
        self.scope = scope
        self.dueAt = dueAt
        self.compact = compact
    }

    public var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Circle()
                .fill(TrackerTheme.scopeTint(scope))
                .frame(width: compact ? 5 : 6, height: compact ? 5 : 6)
                .padding(.top, compact ? 4 : 5)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(compact ? .caption : .subheadline)
                    .lineLimit(compact ? 1 : 2)
                HStack(spacing: 6) {
                    TrackerScopeChip(
                        scopeBadge,
                        emphasized: scope == .project,
                        tint: TrackerTheme.scopeTint(scope)
                    )
                    if let dueAt {
                        Text(dueAt, style: .date)
                            .font(.caption2)
                            .foregroundStyle(dueAt < Date() ? TrackerTheme.overdue : Color.secondary)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, compact ? 2 : 4)
    }
}

public struct GlassButton: View {
    public let title: String
    public let role: ButtonRole?
    public let action: () -> Void

    public init(_ title: String, role: ButtonRole? = nil, action: @escaping () -> Void) {
        self.title = title
        self.role = role
        self.action = action
    }

    @Environment(\.isEnabled) private var isEnabled

    public var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(.medium))
                .foregroundStyle(foregroundColor)
        }
        .buttonStyle(.plain)
        .opacity(isEnabled ? 1 : 0.4)
    }

    private var foregroundColor: Color {
        role == .destructive ? TrackerTheme.danger : TrackerTheme.userAccent
    }
}

public struct TrackerGlassPanelBackground: View {
    public init() {}

    public var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(.regularMaterial)
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.28),
                            TrackerTheme.userAccent.opacity(0.16),
                            Color.white.opacity(0.06),
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 0.8
                )
        }
    }
}
