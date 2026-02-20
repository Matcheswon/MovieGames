import Foundation
import Supabase

// MARK: - Stats Types

struct ThumbsStats {
    let gamesPlayed: Int
    let currentStreak: Int
    let bestStreak: Int
    let averageTimeSecs: Int
    let averageScore: Int      // percentage (0-100)
    let bestScore: Int
}

struct RolesStats {
    let gamesPlayed: Int
    let currentStreak: Int
    let bestStreak: Int
    let averageTimeSecs: Int
    let solveRate: Int         // percentage (0-100)
    let averageStrikes: Double // rounded to 1 decimal
}

struct UserStats {
    let thumbs: ThumbsStats?
    let roles: RolesStats?
}

// MARK: - Supabase Game Result Row

/// Matches the `game_results` table schema.
private struct GameResultRow: Decodable {
    let game: String
    let date_key: String
    let score: Int?
    let out_of: Int?
    let time_secs: Int
    let solved: Bool?
    let strikes: Int?
    let rounds_used: Int?
}

// MARK: - Stats Service

/// Computes stats from Supabase game_results.
/// Matches the web app's `stats.ts` — `getUserStats()` and `computeStreak()`.
@MainActor
final class StatsService: ObservableObject {
    static let shared = StatsService()

    @Published var stats: UserStats?
    @Published var isLoading = false
    @Published var error: String?

    private init() {}

    // MARK: - Fetch Stats

    /// Fetches all game results from Supabase and computes stats.
    /// Matches the web app's `getUserStats()` in `stats.ts`.
    func fetchStats() async {
        guard let userId = AuthManager.shared.userId else {
            stats = nil
            return
        }

        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let results: [GameResultRow] = try await supabase
                .from("game_results")
                .select()
                .eq("user_id", value: userId.uuidString.lowercased())
                .order("date_key", ascending: true)
                .execute()
                .value

            if results.isEmpty {
                stats = UserStats(thumbs: nil, roles: nil)
                return
            }

            let thumbsResults = results.filter { $0.game == "thumbs" }
            let rolesResults = results.filter { $0.game == "roles" }

            let thumbsStats = computeThumbsStats(thumbsResults)
            let rolesStats = computeRolesStats(rolesResults)

            stats = UserStats(thumbs: thumbsStats, roles: rolesStats)
        } catch {
            self.error = "Failed to load stats"
            // Fall back to local stats
            stats = computeLocalStats()
        }
    }

    // MARK: - THUMBS Stats Computation

    private func computeThumbsStats(_ results: [GameResultRow]) -> ThumbsStats? {
        guard !results.isEmpty else { return nil }

        let dateKeys = results.map { $0.date_key }
        let streak = computeStreak(dateKeys: dateKeys)

        let totalScore = results.reduce(0) { $0 + ($1.score ?? 0) }
        let totalOutOf = results.reduce(0) { $0 + ($1.out_of ?? 0) }
        let bestScore = results.compactMap { $0.score }.max() ?? 0
        let avgTime = results.reduce(0) { $0 + $1.time_secs } / results.count
        let avgScore = totalOutOf > 0 ? Int(round(Double(totalScore) / Double(totalOutOf) * 100)) : 0

        return ThumbsStats(
            gamesPlayed: results.count,
            currentStreak: streak.current,
            bestStreak: streak.best,
            averageTimeSecs: avgTime,
            averageScore: avgScore,
            bestScore: bestScore
        )
    }

    // MARK: - ROLES Stats Computation

    private func computeRolesStats(_ results: [GameResultRow]) -> RolesStats? {
        guard !results.isEmpty else { return nil }

        let dateKeys = results.map { $0.date_key }
        let streak = computeStreak(dateKeys: dateKeys)

        let solved = results.filter { $0.solved == true }.count
        let avgTime = results.reduce(0) { $0 + $1.time_secs } / results.count
        let solveRate = Int(round(Double(solved) / Double(results.count) * 100))
        let totalStrikes = results.reduce(0) { $0 + ($1.strikes ?? 0) }
        let avgStrikes = Double(round(Double(totalStrikes) / Double(results.count) * 10)) / 10

        return RolesStats(
            gamesPlayed: results.count,
            currentStreak: streak.current,
            bestStreak: streak.best,
            averageTimeSecs: avgTime,
            solveRate: solveRate,
            averageStrikes: avgStrikes
        )
    }

    // MARK: - Streak Computation

    /// Computes current and best streaks from an array of date key strings.
    /// Matches the web app's `computeStreak()` in `stats.ts` exactly.
    private func computeStreak(dateKeys: [String]) -> (current: Int, best: Int) {
        guard !dateKeys.isEmpty else { return (0, 0) }

        // Sort descending (newest first)
        let sorted = dateKeys.sorted { $0 > $1 }

        // Get today and yesterday in NY timezone
        let today = getNyDateKey()
        let yesterday = getNyDateKey(Date(timeIntervalSinceNow: -86400))

        let mostRecent = sorted[0]

        var current = 0
        var best = 0
        var streak = 1

        // Current streak: count consecutive days from most recent
        if mostRecent == today || mostRecent == yesterday {
            current = 1
            for i in 1..<sorted.count {
                let expected = dayBefore(sorted[i - 1])
                if sorted[i] == expected {
                    current += 1
                } else {
                    break
                }
            }
        }

        // Best streak: find longest consecutive run
        for i in 1..<sorted.count {
            let expected = dayBefore(sorted[i - 1])
            if sorted[i] == expected {
                streak += 1
            } else {
                best = max(best, streak)
                streak = 1
            }
        }
        best = max(best, streak, current)

        return (current, best)
    }

    /// Returns the date string for the day before the given YYYY-MM-DD string.
    /// Matches the web app's `prev.setDate(prev.getDate() - 1)` + `.toISOString().slice(0, 10)`.
    private func dayBefore(_ dateStr: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        formatter.timeZone = TimeZone(identifier: "UTC")
        guard let date = formatter.date(from: dateStr + "T12:00:00") else { return "" }
        let prev = Calendar(identifier: .gregorian).date(byAdding: .day, value: -1, to: date)!
        let isoFormatter = DateFormatter()
        isoFormatter.dateFormat = "yyyy-MM-dd"
        isoFormatter.timeZone = TimeZone(identifier: "UTC")
        return isoFormatter.string(from: prev)
    }

    // MARK: - Local Stats Fallback

    /// Computes stats from local UserDefaults when offline.
    func computeLocalStats() -> UserStats {
        let thumbs = computeLocalThumbsStats()
        let roles = computeLocalRolesStats()
        return UserStats(thumbs: thumbs, roles: roles)
    }

    private func computeLocalThumbsStats() -> ThumbsStats? {
        let key = "moviegames:thumbwars:daily"
        guard let data = UserDefaults.standard.data(forKey: key),
              let streakData = try? JSONDecoder().decode(DailyStreakData.self, from: data),
              !streakData.history.isEmpty else {
            return nil
        }

        let history = streakData.history
        let dateKeys = history.map { $0.dateKey }
        let streak = computeStreak(dateKeys: dateKeys)

        let totalScore = history.reduce(0) { $0 + $1.score }
        let totalOutOf = history.reduce(0) { $0 + $1.outOf }
        let bestScore = history.map { $0.score }.max() ?? 0
        let avgTime = history.reduce(0) { $0 + $1.timeSecs } / history.count
        let avgScore = totalOutOf > 0 ? Int(round(Double(totalScore) / Double(totalOutOf) * 100)) : 0

        return ThumbsStats(
            gamesPlayed: history.count,
            currentStreak: streak.current,
            bestStreak: streak.best,
            averageTimeSecs: avgTime,
            averageScore: avgScore,
            bestScore: bestScore
        )
    }

    private func computeLocalRolesStats() -> RolesStats? {
        let key = "moviegames:roles:daily"
        guard let data = UserDefaults.standard.data(forKey: key),
              let streakData = try? JSONDecoder().decode(RolesDailyStreakData.self, from: data),
              !streakData.history.isEmpty else {
            return nil
        }

        let history = streakData.history
        let dateKeys = history.map { $0.dateKey }
        let streak = computeStreak(dateKeys: dateKeys)

        let solved = history.filter { $0.solved }.count
        let avgTime = history.reduce(0) { $0 + $1.timeSecs } / history.count
        let solveRate = Int(round(Double(solved) / Double(history.count) * 100))
        let totalStrikes = history.reduce(0) { $0 + $1.strikes }
        let avgStrikes = Double(round(Double(totalStrikes) / Double(history.count) * 10)) / 10

        return RolesStats(
            gamesPlayed: history.count,
            currentStreak: streak.current,
            bestStreak: streak.best,
            averageTimeSecs: avgTime,
            solveRate: solveRate,
            averageStrikes: avgStrikes
        )
    }
}
