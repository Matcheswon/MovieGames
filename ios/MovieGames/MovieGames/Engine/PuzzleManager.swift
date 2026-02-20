import Foundation
import Combine

/// Manages the current daily puzzle state and handles freshness checks.
/// When the app returns to the foreground, checks if the NY date has changed
/// and reloads puzzles if needed.
@MainActor
final class PuzzleManager: ObservableObject {
    static let shared = PuzzleManager()

    @Published var currentDateKey: String
    @Published var thumbsResult: DailyMoviesResult?
    @Published var rolesResult: DailyRolesPuzzleResult?

    private let ratings: [RatingEntry]
    private let puzzles: [RolesPuzzle]

    private init() {
        self.ratings = DataLoader.loadRatings()
        self.puzzles = DataLoader.loadRolesPuzzles()
        self.currentDateKey = getNyDateKey()
        loadPuzzles()
    }

    /// Call this when the app becomes active (scenePhase → .active).
    /// If the NY date has changed since the puzzle was loaded, reloads.
    func checkFreshness() {
        let newDateKey = getNyDateKey()
        if newDateKey != currentDateKey {
            currentDateKey = newDateKey
            loadPuzzles()
        }
    }

    private func loadPuzzles() {
        thumbsResult = getDailyMovies(entries: ratings, count: 10)
        rolesResult = getDailyRolesPuzzle(puzzles: puzzles)
    }
}
