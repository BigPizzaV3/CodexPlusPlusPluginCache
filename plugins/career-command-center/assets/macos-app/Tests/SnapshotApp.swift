import AppKit
import SwiftUI

@main
@MainActor
struct SnapshotApp {
    static func main() {
        let arguments = CommandLine.arguments
        let mode = arguments.dropFirst().first ?? "main"
        let output = arguments.dropFirst(2).first ?? "/tmp/career-command-center-window.png"
        let useDarkAppearance = mode.contains("dark")
        let isOnboarding = mode.hasPrefix("onboarding")
        let isCompact = mode.contains("compact")
        let size = isOnboarding
            ? CGSize(width: 1280, height: 800)
            : (isCompact ? CGSize(width: 1280, height: 800) : CGSize(width: 1440, height: 900))

        let store = AppStore(
            workspaceOverride: URL(fileURLWithPath: "/tmp/career-command-center-window-preview", isDirectory: true),
            preview: true
        )
        store.config.onboardingCompleted = !isOnboarding
        if isOnboarding {
            store.config = AppConfig()
            store.config.workspacePath = store.workspaceURL.path
        } else if mode.hasPrefix("questions") {
            store.selectedSection = .questions
            store.selectedQuestionID = store.questionsNeedingAnswer.first?.id
        }

        let root: AnyView
        if isOnboarding {
            let requestedStep = mode
                .split(separator: "-")
                .compactMap { Int($0) }
                .last
                ?? 0
            root = AnyView(OnboardingView(store: store, initialStep: requestedStep).frame(width: size.width, height: size.height))
        } else {
            root = AnyView(MainView(store: store).frame(width: size.width, height: size.height))
        }

        let application = NSApplication.shared
        application.setActivationPolicy(.regular)
        application.appearance = NSAppearance(named: useDarkAppearance ? .darkAqua : .aqua)
        let hostingView = NSHostingView(rootView: root)
        hostingView.frame = CGRect(origin: .zero, size: size)
        let window = NSWindow(
            contentRect: CGRect(origin: .zero, size: size),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Career Command Center Preview"
        window.appearance = application.appearance
        window.contentView = hostingView
        window.center()
        window.makeKeyAndOrderFront(nil)
        application.activate(ignoringOtherApps: true)

        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            capture(hostingView: hostingView, output: output)
            application.terminate(nil)
        }
        application.run()
    }

    private static func capture(hostingView: NSView, output: String) {
        hostingView.layoutSubtreeIfNeeded()
        hostingView.displayIfNeeded()
        let bounds = hostingView.bounds
        guard let bitmap = hostingView.bitmapImageRepForCachingDisplay(in: bounds) else {
            fputs("Could not allocate snapshot bitmap\n", stderr)
            return
        }
        hostingView.cacheDisplay(in: bounds, to: bitmap)
        guard let data = bitmap.representation(using: .png, properties: [:]) else {
            fputs("Could not encode snapshot PNG\n", stderr)
            return
        }
        do {
            try data.write(to: URL(fileURLWithPath: output), options: .atomic)
            print(output)
        } catch {
            fputs("Could not write snapshot: \(error)\n", stderr)
        }
    }
}
