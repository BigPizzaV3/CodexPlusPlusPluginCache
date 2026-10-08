import AppKit
import SwiftUI

enum AppTheme {
    private static func adaptive(light: NSColor, dark: NSColor) -> Color {
        Color(nsColor: NSColor(name: nil) { appearance in
            appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light
        })
    }

    static let teal = adaptive(
        light: NSColor(srgbRed: 0.04, green: 0.39, blue: 0.38, alpha: 1),
        dark: NSColor(srgbRed: 0.20, green: 0.73, blue: 0.69, alpha: 1)
    )
    static let tealSoft = adaptive(
        light: NSColor(srgbRed: 0.88, green: 0.95, blue: 0.94, alpha: 1),
        dark: NSColor(srgbRed: 0.10, green: 0.22, blue: 0.22, alpha: 1)
    )
    static let coral = adaptive(
        light: NSColor(srgbRed: 0.78, green: 0.20, blue: 0.22, alpha: 1),
        dark: NSColor(srgbRed: 0.96, green: 0.43, blue: 0.44, alpha: 1)
    )
    static let amber = adaptive(
        light: NSColor(srgbRed: 0.72, green: 0.42, blue: 0.04, alpha: 1),
        dark: NSColor(srgbRed: 0.96, green: 0.68, blue: 0.23, alpha: 1)
    )
    static let infoBlue = adaptive(
        light: NSColor(srgbRed: 0.10, green: 0.36, blue: 0.66, alpha: 1),
        dark: NSColor(srgbRed: 0.40, green: 0.68, blue: 0.96, alpha: 1)
    )
    static let ink = adaptive(
        light: NSColor(srgbRed: 0.10, green: 0.12, blue: 0.14, alpha: 1),
        dark: NSColor(srgbRed: 0.92, green: 0.94, blue: 0.95, alpha: 1)
    )
    static let muted = adaptive(
        light: NSColor(srgbRed: 0.38, green: 0.41, blue: 0.44, alpha: 1),
        dark: NSColor(srgbRed: 0.65, green: 0.69, blue: 0.72, alpha: 1)
    )
    static let line = Color.primary.opacity(0.10)
    static let canvas = Color(nsColor: .windowBackgroundColor)
    static let panel = Color(nsColor: .controlBackgroundColor)
    static let sidebar = adaptive(
        light: NSColor(srgbRed: 0.95, green: 0.96, blue: 0.965, alpha: 1),
        dark: NSColor(srgbRed: 0.105, green: 0.125, blue: 0.135, alpha: 1)
    )
}

struct AppLogo: View {
    var size: CGFloat = 34

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.22, style: .continuous)
                .fill(AppTheme.coral)
            Image(systemName: "doc.text.fill")
                .font(.system(size: size * 0.46, weight: .semibold))
                .foregroundStyle(.white)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct SectionTitle: View {
    let title: String
    var subtitle: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(AppTheme.ink)
            if !subtitle.isEmpty {
                Text(subtitle)
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct StatusPill: View {
    let status: LeadStatus

    var tint: Color {
        switch status {
        case .toApply: return AppTheme.teal
        case .monitor: return AppTheme.amber
        case .applied: return Color.green
        case .archived: return Color.secondary
        case .deleted: return AppTheme.coral
        }
    }

    var body: some View {
        Text(status.label)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 8)
            .frame(height: 23)
            .background(tint.opacity(0.11), in: Capsule())
    }
}

struct ScoreBadge: View {
    let score: Int?

    var color: Color {
        guard let score else { return Color.secondary }
        if score >= 90 { return AppTheme.teal }
        if score >= 82 { return AppTheme.amber }
        return Color.secondary
    }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "scope")
                .font(.system(size: 10, weight: .semibold))
            Text(score.map(String.init) ?? "N/A")
                .font(.system(size: 11, weight: .bold, design: .rounded))
        }
        .foregroundStyle(color)
        .padding(.horizontal, 7)
        .frame(height: 23)
        .background(color.opacity(0.10), in: RoundedRectangle(cornerRadius: 5))
        .help("Evidence-fit score. Upload documents and application logistics do not reduce it.")
    }
}

struct MetadataLabel: View {
    let icon: String
    let text: String

    var body: some View {
        Label(text, systemImage: icon)
            .font(.system(size: 12))
            .foregroundStyle(.secondary)
            .lineLimit(1)
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .frame(height: 34)
            .background(
                AppTheme.teal.opacity(configuration.isPressed ? 0.78 : 1),
                in: RoundedRectangle(cornerRadius: 6)
            )
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(.primary)
            .padding(.horizontal, 12)
            .frame(height: 34)
            .background(
                Color.primary.opacity(configuration.isPressed ? 0.09 : 0.055),
                in: RoundedRectangle(cornerRadius: 6)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(AppTheme.line, lineWidth: 1)
            )
    }
}

struct DangerButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(AppTheme.coral)
            .padding(.horizontal, 12)
            .frame(height: 34)
            .background(
                AppTheme.coral.opacity(configuration.isPressed ? 0.15 : 0.08),
                in: RoundedRectangle(cornerRadius: 6)
            )
    }
}

struct IconButton: View {
    let icon: String
    let help: String
    var tint: Color = .primary
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 32, height: 30)
                .background(Color.primary.opacity(0.055), in: RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
        .help(help)
        .accessibilityLabel(help)
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 30, weight: .regular))
                .foregroundStyle(AppTheme.teal)
            Text(title)
                .font(.system(size: 16, weight: .semibold))
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 330)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(PrimaryButtonStyle())
                    .padding(.top, 4)
            }
        }
        .padding(28)
    }
}

struct InlineBanner: View {
    enum Kind { case info, warning, success }
    let kind: Kind
    let title: String
    let message: String

    private var color: Color {
        switch kind {
        case .info: return AppTheme.teal
        case .warning: return AppTheme.amber
        case .success: return Color.green
        }
    }

    private var icon: String {
        switch kind {
        case .info: return "info.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .success: return "checkmark.circle.fill"
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                Text(message)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(color.opacity(0.08), in: RoundedRectangle(cornerRadius: 6))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(color.opacity(0.18)))
    }
}

struct ChoiceChip: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                Text(title)
                    .lineLimit(1)
            }
            .font(.system(size: 12, weight: selected ? .semibold : .regular))
            .foregroundStyle(selected ? AppTheme.teal : Color.primary)
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(
                selected ? AppTheme.teal.opacity(0.10) : Color.primary.opacity(0.045),
                in: RoundedRectangle(cornerRadius: 6)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(selected ? AppTheme.teal.opacity(0.38) : AppTheme.line)
            )
        }
        .buttonStyle(.plain)
    }
}

struct LabeledField<Content: View>: View {
    let label: String
    var hint: String = ""
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
                if !hint.isEmpty {
                    Text(hint)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            }
            content
        }
    }
}

struct AppTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .textFieldStyle(.plain)
            .font(.system(size: 13))
            .padding(.horizontal, 10)
            .frame(height: 34)
            .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 5))
            .overlay(RoundedRectangle(cornerRadius: 5).stroke(AppTheme.line))
    }
}

struct PanelSection<Content: View>: View {
    let title: String
    var subtitle: String = ""
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
            }
            content
        }
        .padding(16)
        .background(AppTheme.panel, in: RoundedRectangle(cornerRadius: 7))
        .overlay(RoundedRectangle(cornerRadius: 7).stroke(AppTheme.line))
    }
}

struct FlowLayout: Layout {
    var spacing: CGFloat = 7

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        let width = proposal.width ?? 600
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: width, height: y + rowHeight)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
