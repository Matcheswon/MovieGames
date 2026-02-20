import SwiftUI
import Supabase

@main
struct MovieGamesApp: App {
    @StateObject private var authManager = AuthManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .preferredColorScheme(.dark)
                .onOpenURL { url in
                    // Handle OAuth callback deep links
                    Task {
                        await authManager.handleDeepLink(url)
                    }
                }
        }
    }
}
