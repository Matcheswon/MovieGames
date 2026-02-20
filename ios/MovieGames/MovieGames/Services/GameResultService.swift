import Foundation
import Supabase

// MARK: - Game Result Service

/// Handles dual-save (local UserDefaults + Supabase), offline queuing,
/// and local → Supabase migration on first sign-in.
/// Matches the web app's `saveResult.ts` and `MigrateLocalStats.tsx`.
@MainActor
final class GameResultService: ObservableObject {
    static let shared = GameResultService()

    private let thumbsKey = "moviegames:thumbwars:daily"
    private let rolesKey = "moviegames:roles:daily"
    private let migratedKey = "moviegames:stats-migrated"
    private let offlineQueueKey = "moviegames:offline-queue"

    private init() {}

    // MARK: - Save THUMBS Result (dual-save)

    /// Saves a THUMBS result to both local storage and Supabase (if authenticated).
    func saveThumbsResult(dateKey: String, score: Int, outOf: Int, timeSecs: Int) {
        // Always save locally (already handled by ThumbsGameView's recordDailyResult)
        // Save to Supabase if authenticated
        saveToSupabase(
            game: "thumbs",
            dateKey: dateKey,
            score: score,
            outOf: outOf,
            timeSecs: timeSecs,
            solved: nil,
            strikes: nil,
            roundsUsed: nil
        )
    }

    // MARK: - Save ROLES Result (dual-save)

    /// Saves a ROLES result to both local storage and Supabase (if authenticated).
    func saveRolesResult(dateKey: String, solved: Bool, strikes: Int, roundsUsed: Int, timeSecs: Int) {
        // Always save locally (already handled by RolesGameView's recordDailyResult)
        // Save to Supabase if authenticated
        saveToSupabase(
            game: "roles",
            dateKey: dateKey,
            score: nil,
            outOf: nil,
            timeSecs: timeSecs,
            solved: solved,
            strikes: strikes,
            roundsUsed: roundsUsed
        )
    }

    // MARK: - Supabase Upsert

    /// Upserts a game result to Supabase `game_results` table.
    /// Matches the web app's `saveGameResult()` in `saveResult.ts`.
    private func saveToSupabase(
        game: String,
        dateKey: String,
        score: Int?,
        outOf: Int?,
        timeSecs: Int,
        solved: Bool?,
        strikes: Int?,
        roundsUsed: Int?
    ) {
        guard let userId = AuthManager.shared.userId else {
            // Not authenticated — queue for later
            queueOfflineResult(
                game: game,
                dateKey: dateKey,
                score: score,
                outOf: outOf,
                timeSecs: timeSecs,
                solved: solved,
                strikes: strikes,
                roundsUsed: roundsUsed
            )
            return
        }

        Task {
            await upsertRow(
                userId: userId,
                game: game,
                dateKey: dateKey,
                score: score,
                outOf: outOf,
                timeSecs: timeSecs,
                solved: solved,
                strikes: strikes,
                roundsUsed: roundsUsed
            )
        }
    }

    private func upsertRow(
        userId: UUID,
        game: String,
        dateKey: String,
        score: Int?,
        outOf: Int?,
        timeSecs: Int,
        solved: Bool?,
        strikes: Int?,
        roundsUsed: Int?
    ) async {
        let row: [String: AnyJSON] = [
            "user_id": .string(userId.uuidString.lowercased()),
            "game": .string(game),
            "date_key": .string(dateKey),
            "time_secs": .integer(timeSecs),
            "score": score.map { .integer($0) } ?? .null,
            "out_of": outOf.map { .integer($0) } ?? .null,
            "solved": solved.map { .bool($0) } ?? .null,
            "strikes": strikes.map { .integer($0) } ?? .null,
            "rounds_used": roundsUsed.map { .integer($0) } ?? .null,
        ]

        do {
            try await supabase
                .from("game_results")
                .upsert(row)
                .execute()
        } catch {
            // Network failure — queue for retry
            queueOfflineResult(
                game: game,
                dateKey: dateKey,
                score: score,
                outOf: outOf,
                timeSecs: timeSecs,
                solved: solved,
                strikes: strikes,
                roundsUsed: roundsUsed
            )
        }
    }

    // MARK: - Offline Queue

    private struct QueuedResult: Codable {
        let game: String
        let dateKey: String
        let score: Int?
        let outOf: Int?
        let timeSecs: Int
        let solved: Bool?
        let strikes: Int?
        let roundsUsed: Int?
    }

    private func queueOfflineResult(
        game: String,
        dateKey: String,
        score: Int?,
        outOf: Int?,
        timeSecs: Int,
        solved: Bool?,
        strikes: Int?,
        roundsUsed: Int?
    ) {
        var queue = readOfflineQueue()
        // Deduplicate by game + dateKey
        queue.removeAll { $0.game == game && $0.dateKey == dateKey }
        queue.append(QueuedResult(
            game: game,
            dateKey: dateKey,
            score: score,
            outOf: outOf,
            timeSecs: timeSecs,
            solved: solved,
            strikes: strikes,
            roundsUsed: roundsUsed
        ))
        writeOfflineQueue(queue)
    }

    private func readOfflineQueue() -> [QueuedResult] {
        guard let data = UserDefaults.standard.data(forKey: offlineQueueKey),
              let decoded = try? JSONDecoder().decode([QueuedResult].self, from: data) else {
            return []
        }
        return decoded
    }

    private func writeOfflineQueue(_ queue: [QueuedResult]) {
        if let encoded = try? JSONEncoder().encode(queue) {
            UserDefaults.standard.set(encoded, forKey: offlineQueueKey)
        }
    }

    /// Flushes queued offline results to Supabase. Call on app foreground or after sign-in.
    func flushOfflineQueue() {
        guard let userId = AuthManager.shared.userId else { return }
        let queue = readOfflineQueue()
        guard !queue.isEmpty else { return }

        // Clear queue immediately to prevent duplicate flushes
        writeOfflineQueue([])

        Task {
            var failedResults: [QueuedResult] = []
            for result in queue {
                do {
                    let row: [String: AnyJSON] = [
                        "user_id": .string(userId.uuidString.lowercased()),
                        "game": .string(result.game),
                        "date_key": .string(result.dateKey),
                        "time_secs": .integer(result.timeSecs),
                        "score": result.score.map { .integer($0) } ?? .null,
                        "out_of": result.outOf.map { .integer($0) } ?? .null,
                        "solved": result.solved.map { .bool($0) } ?? .null,
                        "strikes": result.strikes.map { .integer($0) } ?? .null,
                        "rounds_used": result.roundsUsed.map { .integer($0) } ?? .null,
                    ]
                    try await supabase
                        .from("game_results")
                        .upsert(row)
                        .execute()
                } catch {
                    failedResults.append(result)
                }
            }
            // Re-queue any failures
            if !failedResults.isEmpty {
                var current = readOfflineQueue()
                current.append(contentsOf: failedResults)
                writeOfflineQueue(current)
            }
        }
    }

    // MARK: - Local → Supabase Migration

    /// Migrates local UserDefaults history to Supabase on first sign-in.
    /// Matches the web app's `MigrateLocalStats` component.
    func migrateLocalStats() {
        guard let userId = AuthManager.shared.userId else { return }
        guard !UserDefaults.standard.bool(forKey: migratedKey) else { return }

        Task {
            var rows: [[String: AnyJSON]] = []

            // Migrate THUMBS history
            if let data = UserDefaults.standard.data(forKey: thumbsKey),
               let thumbs = try? JSONDecoder().decode(DailyStreakData.self, from: data) {
                for h in thumbs.history {
                    rows.append([
                        "user_id": .string(userId.uuidString.lowercased()),
                        "game": .string("thumbs"),
                        "date_key": .string(h.dateKey),
                        "score": .integer(h.score),
                        "out_of": .integer(h.outOf),
                        "time_secs": .integer(h.timeSecs),
                        "solved": .null,
                        "strikes": .null,
                        "rounds_used": .null,
                    ])
                }
            }

            // Migrate ROLES history
            if let data = UserDefaults.standard.data(forKey: rolesKey),
               let roles = try? JSONDecoder().decode(RolesDailyStreakData.self, from: data) {
                for h in roles.history {
                    rows.append([
                        "user_id": .string(userId.uuidString.lowercased()),
                        "game": .string("roles"),
                        "date_key": .string(h.dateKey),
                        "solved": .bool(h.solved),
                        "strikes": .integer(h.strikes),
                        "rounds_used": .integer(h.roundsUsed),
                        "time_secs": .integer(h.timeSecs),
                        "score": .null,
                        "out_of": .null,
                    ])
                }
            }

            // Upsert each row individually (matching web behavior)
            for row in rows {
                try? await supabase
                    .from("game_results")
                    .upsert(row)
                    .execute()
            }

            UserDefaults.standard.set(true, forKey: migratedKey)
        }
    }
}
