import SwiftUI

@main
@MainActor
struct CareerCommandCenterApp: App {
    @StateObject private var store: AppStore

    init() {
        let appStore = AppStore()
        if CommandLine.arguments.contains("--reset-onboarding") {
            appStore.restartOnboarding()
        }
        _store = StateObject(wrappedValue: appStore)
    }

    var body: some Scene {
        WindowGroup("Career Command Center") {
            Group {
                if store.config.onboardingCompleted {
                    MainView(store: store)
                } else {
                    OnboardingView(store: store)
                }
            }
            .preferredColorScheme(nil)
        }
        .defaultSize(width: 1280, height: 800)
        .commands {
            CommandGroup(after: .newItem) {
                Button("Refresh Workspace") { store.reload() }
                    .keyboardShortcut("r", modifiers: [.command])
                Button("Run Search in Codex") {
                    store.copyCodexRequest(store.runSearchRequest())
                }
                .keyboardShortcut("r", modifiers: [.command, .shift])
            }
        }
    }
}
