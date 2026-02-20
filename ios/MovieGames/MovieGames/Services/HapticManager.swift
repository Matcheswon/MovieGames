import UIKit

/// Centralized haptic feedback for game interactions.
enum HapticManager {
    private static let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private static let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private static let notification = UINotificationFeedbackGenerator()
    private static let selection = UISelectionFeedbackGenerator()

    /// Light tap — keyboard key press, thumb button tap
    static func lightTap() {
        lightImpact.impactOccurred()
    }

    /// Medium tap — wheel spin, solve submit
    static func mediumTap() {
        mediumImpact.impactOccurred()
    }

    /// Selection changed — picker / letter pick
    static func selectionChanged() {
        selection.selectionChanged()
    }

    /// Success — correct guess, solve, game win
    static func success() {
        notification.notificationOccurred(.success)
    }

    /// Error — wrong guess, strike, game over
    static func error() {
        notification.notificationOccurred(.error)
    }

    /// Warning — timer running low, last round
    static func warning() {
        notification.notificationOccurred(.warning)
    }
}
