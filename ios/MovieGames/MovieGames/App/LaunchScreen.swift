import SwiftUI

/// Launch screen matching the app's cinematic theme.
/// Used as a static launch screen via Info.plist configuration.
struct LaunchScreen: View {
    var body: some View {
        ZStack {
            // Match cinematic background
            RadialGradient(
                gradient: Gradient(colors: [
                    Color(hex: "1a1510"),
                    Color(hex: "09090b")
                ]),
                center: .center,
                startRadius: 0,
                endRadius: 400
            )
            .ignoresSafeArea()

            VStack(spacing: 12) {
                Text("\u{1F3AC}")
                    .font(.system(size: 48))

                Text("MovieGames")
                    .font(.custom("PlayfairDisplay-Bold", size: 36))
                    .foregroundStyle(Color(hex: "f59e0b")) // amber-500
            }
        }
        .preferredColorScheme(.dark)
    }
}
