import Charts
import SwiftUI

/// Shared Canvas / Shape / Charts graphics — each widget picks a distinct style.
public enum WidgetGraphics {
    // MARK: - Dashboard: stacked / grouped vertical bars

    public struct StackedMetricBars: View {
        public let personal: Int
        public let project: Int
        public let done: Int
        public var accent: Color
        public var height: CGFloat

        public init(personal: Int, project: Int, done: Int, accent: Color = TrackerTheme.userAccent, height: CGFloat = 56) {
            self.personal = personal
            self.project = project
            self.done = done
            self.accent = accent
            self.height = height
        }

        private struct Row: Identifiable {
            let id: String
            let label: String
            let value: Int
            let tint: Color
        }

        public var body: some View {
            let rows = [
                Row(id: "p", label: "Me", value: personal, tint: TrackerTheme.personal),
                Row(id: "j", label: "Proj", value: project, tint: accent),
                Row(id: "d", label: "Done", value: done, tint: accent.opacity(0.55)),
            ]
            let maxV = max(1, rows.map(\.value).max() ?? 1)
            Chart(rows) { row in
                BarMark(
                    x: .value("Kind", row.label),
                    y: .value("Count", row.value)
                )
                .foregroundStyle(row.tint.gradient)
                .cornerRadius(4)
            }
            .chartYScale(domain: 0...maxV)
            .chartXAxis {
                AxisMarks { _ in
                    AxisValueLabel()
                        .font(.system(size: 8, weight: .medium))
                        .foregroundStyle(.secondary)
                }
            }
            .chartYAxis(.hidden)
            .frame(height: height)
            .accessibilityHidden(true)
        }
    }

    /// Mini sparkline (area) for open vs done trend feel.
    public struct OpenDoneSparkline: View {
        public let open: Int
        public let done: Int
        public var accent: Color
        public var height: CGFloat

        public init(open: Int, done: Int, accent: Color = TrackerTheme.userAccent, height: CGFloat = 28) {
            self.open = open
            self.done = done
            self.accent = accent
            self.height = height
        }

        private struct Pt: Identifiable {
            let id: Int
            let x: Int
            let y: Double
        }

        public var body: some View {
            let total = max(1.0, Double(open + done))
            let openR = Double(open) / total
            let pts: [Pt] = (0..<8).map { i in
                let t = Double(i) / 7.0
                let wave = 0.25 + 0.75 * (0.55 + 0.45 * sin((t + openR) * .pi * 1.6))
                let y = (t < openR ? openR : (1 - openR) * 0.6) * wave * 10
                return Pt(id: i, x: i, y: max(0.4, y))
            }
            Chart(pts) { p in
                AreaMark(
                    x: .value("t", p.x),
                    y: .value("v", p.y)
                )
                .foregroundStyle(accent.opacity(0.22).gradient)
                LineMark(
                    x: .value("t", p.x),
                    y: .value("v", p.y)
                )
                .foregroundStyle(accent)
                .lineStyle(StrokeStyle(lineWidth: 1.5, lineCap: .round))
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .frame(height: height)
            .accessibilityHidden(true)
        }
    }

    // MARK: - Tasks: due distribution pills + horizontal bars

    public struct DueDistributionBars: View {
        public let overdue: Int
        public let today: Int
        public let later: Int
        public let undated: Int
        public var accent: Color
        public var height: CGFloat

        public init(overdue: Int, today: Int, later: Int, undated: Int, accent: Color = TrackerTheme.userAccent, height: CGFloat = 36) {
            self.overdue = overdue
            self.today = today
            self.later = later
            self.undated = undated
            self.accent = accent
            self.height = height
        }

        private struct Row: Identifiable {
            let id: String
            let label: String
            let value: Int
            let tint: Color
        }

        public var body: some View {
            // Short Y labels so axis never truncates in Medium (Late/Day/Soon/—).
            let rows = [
                Row(id: "o", label: "Late", value: overdue, tint: TrackerTheme.danger),
                Row(id: "t", label: "Day", value: today, tint: accent),
                Row(id: "l", label: "Soon", value: later, tint: accent),
                Row(id: "u", label: "—", value: undated, tint: Color.secondary),
            ]
            let maxV = max(1, rows.map(\.value).max() ?? 1)
            Chart(rows) { row in
                BarMark(
                    x: .value("Count", max(row.value, 0)),
                    y: .value("Bucket", row.label)
                )
                .foregroundStyle(row.tint.gradient)
                .cornerRadius(3)
            }
            .chartXScale(domain: 0...maxV)
            .chartXAxis(.hidden)
            .chartYAxis {
                AxisMarks { _ in
                    AxisValueLabel()
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
            }
            .frame(height: height)
            .accessibilityHidden(true)
        }
    }

    // MARK: - Shared shapes

    public struct SegmentedTrack: View {
        public let open: Int
        public let done: Int
        public var accent: Color
        public var height: CGFloat

        public init(open: Int, done: Int, accent: Color = TrackerTheme.userAccent, height: CGFloat = 6) {
            self.open = open
            self.done = done
            self.accent = accent
            self.height = height
        }

        public var body: some View {
            let total = max(1, open + done)
            GeometryReader { geo in
                let openW = geo.size.width * CGFloat(open) / CGFloat(total)
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.primary.opacity(0.08))
                    Capsule()
                        .fill(accent.opacity(0.8))
                        .frame(width: max(open > 0 ? 4 : 0, openW))
                    HStack {
                        Spacer(minLength: 0)
                        Capsule()
                            .fill(accent.opacity(0.28))
                            .frame(width: max(done > 0 ? 4 : 0, geo.size.width - openW))
                    }
                }
            }
            .frame(height: height)
            .accessibilityHidden(true)
        }
    }

    public struct ProgressRing: View {
        public let progress: Double
        public var lineWidth: CGFloat
        public var accent: Color
        public var trackOpacity: Double

        public init(
            progress: Double,
            lineWidth: CGFloat = 8,
            accent: Color = TrackerTheme.userAccent,
            trackOpacity: Double = 0.12
        ) {
            self.progress = min(1, max(0, progress))
            self.lineWidth = lineWidth
            self.accent = accent
            self.trackOpacity = trackOpacity
        }

        public var body: some View {
            ZStack {
                Circle()
                    .stroke(Color.primary.opacity(trackOpacity), lineWidth: lineWidth)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(
                        AngularGradient(
                            colors: [accent.opacity(0.45), accent],
                            center: .center
                        ),
                        style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
            }
            .accessibilityHidden(true)
        }
    }

    public struct DualRing: View {
        public let openProgress: Double
        public let doneProgress: Double
        public var accent: Color

        public init(open: Int, done: Int, accent: Color = TrackerTheme.userAccent) {
            let total = max(1.0, Double(open + done))
            self.openProgress = Double(open) / total
            self.doneProgress = Double(done) / total
            self.accent = accent
        }

        public var body: some View {
            ZStack {
                ProgressRing(progress: doneProgress, lineWidth: 10, accent: accent)
                ProgressRing(progress: openProgress, lineWidth: 5, accent: accent.opacity(0.55), trackOpacity: 0)
                    .padding(8)
            }
        }
    }

    public struct CardStackBackdrop: View {
        public var tint: Color
        public var cornerRadius: CGFloat

        public init(tint: Color = TrackerTheme.chat, cornerRadius: CGFloat = 10) {
            self.tint = tint
            self.cornerRadius = cornerRadius
        }

        public var body: some View {
            ZStack {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(tint.opacity(0.1))
                    .offset(y: 7)
                    .scaleEffect(x: 0.9, y: 0.9, anchor: .bottom)
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(tint.opacity(0.18))
                    .offset(y: 3.5)
                    .scaleEffect(x: 0.95, y: 0.95, anchor: .bottom)
            }
            .accessibilityHidden(true)
        }
    }

    public struct ChecklistMark: View {
        public var filled: Bool
        public var tint: Color

        public init(filled: Bool = false, tint: Color = TrackerTheme.userAccent) {
            self.filled = filled
            self.tint = tint
        }

        public var body: some View {
            Image(systemName: filled ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(filled ? tint : Color.secondary.opacity(0.7))
                .accessibilityHidden(true)
        }
    }

    /// Fake field chrome for widgets — never use system TextField / white fills (breaks glass).
    public struct InputFieldChrome: View {
        public var accent: Color
        public var placeholder: String

        public init(accent: Color = TrackerTheme.userAccent, placeholder: String = "New task…") {
            self.accent = accent
            self.placeholder = placeholder
        }

        public var body: some View {
            HStack(spacing: 8) {
                Image(systemName: "plus.circle.fill")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(accent)
                Text(placeholder)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color.white.opacity(0.55))
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .background {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.black.opacity(0.32))
            }
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(accent.opacity(0.5), lineWidth: 1)
            }
        }
    }

    public struct EmptyGlyph: View {
        public let systemImage: String
        public let title: String
        public var subtitle: String?
        public var tint: Color
        public var compact: Bool

        public init(
            systemImage: String,
            title: String,
            subtitle: String? = nil,
            tint: Color = TrackerTheme.userAccent,
            compact: Bool = false
        ) {
            self.systemImage = systemImage
            self.title = title
            self.subtitle = subtitle
            self.tint = tint
            self.compact = compact
        }

        public var body: some View {
            Group {
                if compact {
                    HStack(spacing: 8) {
                        Image(systemName: systemImage)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(tint.opacity(0.9))
                        Text(title)
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                        Spacer(minLength: 0)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            Image(systemName: systemImage)
                                .font(.title2.weight(.semibold))
                                .foregroundStyle(tint.opacity(0.9))
                            Text(title)
                                .font(.subheadline.weight(.semibold))
                            Spacer(minLength: 0)
                        }
                        if let subtitle, !subtitle.isEmpty {
                            Text(subtitle)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Signed-out empty state — never show zeros / "Inbox clear" when not authenticated.
    public struct SignInEmptyState: View {
        public var tint: Color
        public var compact: Bool

        public init(tint: Color = TrackerTheme.userAccent, compact: Bool = false) {
            self.tint = tint
            self.compact = compact
        }

        public var body: some View {
            VStack(spacing: compact ? 6 : 10) {
                Spacer(minLength: 0)
                Image(systemName: "person.crop.circle.badge.questionmark")
                    .font(.system(size: compact ? 26 : 34, weight: .semibold))
                    .foregroundStyle(tint.opacity(0.9))
                Text("Sign in")
                    .font((compact ? Font.caption : Font.subheadline).weight(.bold))
                Text("Open menu bar to continue")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Sign in required. Open Project Tracker menu bar.")
        }
    }

    /// Glance metric — short labels only (Me / Proj / Done / Chat). Never "Personal…".
    public struct GlanceNumber: View {
        public let value: String
        public let label: String
        public var tint: Color
        public var icon: String?
        public var compact: Bool

        public init(
            value: String,
            label: String,
            tint: Color = TrackerTheme.userAccent,
            icon: String? = nil,
            compact: Bool = false
        ) {
            self.value = value
            self.label = label
            self.tint = tint
            self.icon = icon
            self.compact = compact
        }

        public var body: some View {
            VStack(alignment: compact ? .center : .leading, spacing: 2) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: compact ? 9 : 10, weight: .bold))
                        .foregroundStyle(tint)
                        .accessibilityHidden(true)
                }
                Text(value)
                    .font((compact ? Font.title3 : Font.title2).bold().monospacedDigit())
                    .foregroundStyle(tint)
                    .minimumScaleFactor(0.65)
                    .lineLimit(1)
                Text(label)
                    .font(.system(size: compact ? 9 : 10, weight: .medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, alignment: compact ? .center : .leading)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(label) \(value)")
        }
    }

    /// Icon + number only (Small tiles) — label via accessibility.
    public struct IconCount: View {
        public let systemImage: String
        public let value: Int
        public var tint: Color
        public var accessibilityName: String

        public init(
            systemImage: String,
            value: Int,
            tint: Color = TrackerTheme.userAccent,
            accessibilityName: String
        ) {
            self.systemImage = systemImage
            self.value = value
            self.tint = tint
            self.accessibilityName = accessibilityName
        }

        public var body: some View {
            VStack(spacing: 3) {
                Image(systemName: systemImage)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(tint)
                Text("\(value)")
                    .font(.title3.bold().monospacedDigit())
                    .foregroundStyle(tint)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(accessibilityName) \(value)")
        }
    }

    public struct IconHeader: View {
        public let systemImage: String
        public let title: String
        public var tint: Color
        public var trailing: String?

        public init(systemImage: String, title: String, tint: Color = TrackerTheme.userAccent, trailing: String? = nil) {
            self.systemImage = systemImage
            self.title = title
            self.tint = tint
            self.trailing = trailing
        }

        public var body: some View {
            HStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(tint)
                Text(title)
                    .font(.headline.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer(minLength: 0)
                if let trailing {
                    Text(trailing)
                        .font(.caption.weight(.bold).monospacedDigit())
                        .foregroundStyle(tint)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background { Capsule().fill(tint.opacity(0.16)) }
                }
            }
        }
    }
}
