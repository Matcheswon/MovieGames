import SwiftUI
import Supabase

@main
struct MovieGamesApp: App {
    @StateObject private var authManager = AuthManager.shared
    @StateObject private var puzzleManager = PuzzleManager.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(puzzleManager)
                .preferredColorScheme(.dark)
                .onOpenURL { url in
                    // Handle OAuth callback deep links
                    Task {
                        await authManager.handleDeepLink(url)
                    }
                }
        }
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                puzzleManager.checkFreshness()
            }
        }
    }
}
