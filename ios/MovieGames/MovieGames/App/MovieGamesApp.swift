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
                // Flush any queued offline results when app becomes active
                GameResultService.shared.flushOfflineQueue()
            }
        }
        .onChange(of: authManager.session) { _, newSession in
            if newSession != nil {
                // User just signed in — migrate local stats and flush queue
                GameResultService.shared.migrateLocalStats()
                GameResultService.shared.flushOfflineQueue()
            }
        }
    }
}
