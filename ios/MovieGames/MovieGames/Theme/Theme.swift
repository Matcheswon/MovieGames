import SwiftUI

// MARK: - Theme Colors

/// Central theme matching the web app's dark cinematic design.
/// Web uses Tailwind's zinc scale + amber accents.
enum Theme {
    enum Colors {
        // Zinc scale (Tailwind equivalents)
        static let zinc950 = Color(hex: "09090b")  // bg-zinc-950 — primary background
        static let zinc900 = Color(hex: "18181b")  // bg-zinc-900 — card/input backgrounds
        static let zinc800 = Color(hex: "27272a")  // bg-zinc-800 — elevated surfaces
        static let zinc700 = Color(hex: "3f3f46")  // border-zinc-700 — borders
        static let zinc600 = Color(hex: "52525b")  // text-zinc-600
        static let zinc500 = Color(hex: "71717a")  // text-zinc-500 — muted text
        static let zinc400 = Color(hex: "a1a1aa")  // text-zinc-400
        static let zinc300 = Color(hex: "d4d4d8")  // text-zinc-300 — secondary text
        static let zinc200 = Color(hex: "e4e4e7")  // text-zinc-200
        static let zinc100 = Color(hex: "f4f4f5")  // text-zinc-100 — primary text

        // Amber accents (Tailwind amber)
        static let amber = Color(hex: "f59e0b")    // amber-500 — primary accent
        static let amber400 = Color(hex: "fbbf24")  // amber-400 — lighter accent
        static let amber600 = Color(hex: "d97706")  // amber-600 — darker accent

        // Game feedback colors
        static let green = Color(hex: "22c55e")     // green-500 — correct
        static let red = Color(hex: "ef4444")       // red-500 — wrong/strikes

        // Cinematic background gradient
        // Web: radial-gradient from #1a1510 (warm brown center) to #09090b (zinc-950 edges)
        static let cinematicCenter = Color(hex: "1a1510")
        static let cinematicEdge = Color(hex: "09090b")
    }

    // MARK: - Background

    /// Cinematic radial gradient background matching the web's `bg-cinematic` class.
    static var cinematicBackground: some View {
        RadialGradient(
            gradient: Gradient(colors: [Colors.cinematicCenter, Colors.cinematicEdge]),
            center: .center,
            startRadius: 0,
            endRadius: UIScreen.main.bounds.height * 0.6
        )
        .ignoresSafeArea()
    }

    /// Film grain overlay — subtle noise texture matching the web's `.film-grain` CSS.
    static var filmGrain: some View {
        // On iOS, use a subtle noise pattern overlay
        // The web uses SVG fractal noise at 0.03 opacity
        Rectangle()
            .fill(.ultraThinMaterial)
            .opacity(0.015)
            .ignoresSafeArea()
            .allowsHitTesting(false)
    }
}

// MARK: - Color Hex Initializer

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6: // RGB
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Font Extensions

/// Custom fonts matching the web app's typography.
/// Web: DM Sans (body), Playfair Display (headings)
///
/// These fonts must be bundled with the app:
/// 1. Add DMSans-VariableFont.ttf to the Xcode project
/// 2. Add PlayfairDisplay-Bold.ttf and PlayfairDisplay-ExtraBold.ttf
/// 3. Register them in Info.plist under "Fonts provided by application"
extension Font {
    static func body(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        // DM Sans — clean geometric sans-serif
        // Falls back to system font if DM Sans not bundled yet
        .custom("DMSans-Regular", size: size)
    }

    static func display(size: CGFloat, weight: Font.Weight = .bold) -> Font {
        // Playfair Display — elegant serif for headings
        let name = weight == .heavy ? "PlayfairDisplay-ExtraBold" : "PlayfairDisplay-Bold"
        return .custom(name, size: size)
    }
}
