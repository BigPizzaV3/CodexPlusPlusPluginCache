import AppKit
import SwiftUI

@main
@MainActor
struct PreviewRenderer {
    static func main() throws {
        let arguments = CommandLine.arguments
        let mode = arguments.dropFirst().first ?? "main"
        let output = arguments.dropFirst(2).first ?? "/tmp/career-command-center-\(mode).png"
        let workspace = URL(fileURLWithPath: "/tmp/career-command-center-preview", isDirectory: true)
        let store = AppStore(workspaceOverride: workspace, preview: true)

        if mode == "onboarding" {
            store.config.onboardingCompleted = false
            try render(
                OnboardingView(store: store)
                    .frame(width: 1280, height: 800),
                width: 1280,
                height: 800,
                output: output
            )
        } else {
            store.config.onboardingCompleted = true
            if mode == "questions" {
                store.selectedSection = .questions
                store.selectedQuestionID = store.questionsNeedingAnswer.first?.id
            }
            try render(
                MainView(store: store)
                    .frame(width: 1440, height: 900),
                width: 1440,
                height: 900,
                output: output
            )
        }
    }

    private static func render<Content: View>(
        _ content: Content,
        width: CGFloat,
        height: CGFloat,
        output: String
    ) throws {
        let renderer = ImageRenderer(content: content)
        renderer.proposedSize = ProposedViewSize(width: width, height: height)
        renderer.scale = 1
        guard let image = renderer.nsImage,
              let tiff = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiff),
              let png = bitmap.representation(using: .png, properties: [:]) else {
            throw PreviewError.renderFailed
        }
        try png.write(to: URL(fileURLWithPath: output), options: .atomic)
        print(output)
    }

    private enum PreviewError: Error {
        case renderFailed
    }
}
