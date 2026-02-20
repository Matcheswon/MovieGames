import Foundation

// MARK: - Constants

private let rolesEpoch = "2026-02-17"
private let thumbsEpoch = "2026-02-17"
private let nyTimeZone = TimeZone(identifier: "America/New_York")!

// MARK: - NY Date Key

/// Returns the current date as YYYY-MM-DD in America/New_York timezone.
/// Matches the web app's `getNyDateKey()`.
func getNyDateKey(_ date: Date = Date()) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = nyTimeZone
    let components = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", components.year!, components.month!, components.day!)
}

// MARK: - Stable Hash

/// Deterministic hash matching the web app's `stableHash()`.
/// Uses unsigned 32-bit arithmetic: `hash = (hash * 31 + charCode) >>> 0`
func stableHash(_ input: String) -> UInt32 {
    var hash: UInt32 = 0
    for scalar in input.unicodeScalars {
        hash = hash &* 31 &+ UInt32(scalar.value)
    }
    return hash
}

// MARK: - Seeded RNG (Linear Congruential Generator)

/// Seeded PRNG matching the web app's `seededRandom()`.
/// Uses LCG: `s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff`
struct SeededRandom {
    private var state: UInt32

    init(seed: UInt32) {
        self.state = seed
    }

    mutating func next() -> Double {
        state = state &* 1664525 &+ 1013904223
        return Double(state) / Double(UInt32.max)
    }
}

// MARK: - ROLES RNG (Park-Miller)

/// Seeded PRNG for ROLES wheel effects, matching the web app's `rng()`.
/// Uses Park-Miller: `s = (s * 16807) % 2147483647; return s / 2147483647`
struct RolesRNG {
    private var state: Int

    init(seed: Int) {
        self.state = seed
    }

    mutating func next() -> Double {
        state = (state * 16807) % 2147483647
        return Double(state) / 2147483647.0
    }
}

// MARK: - Daily THUMBS

struct DailyMoviesResult {
    let dateKey: String
    let movies: [RatingEntry]
    let puzzleNumber: Int
}

/// Selects the daily set of movies for THUMBS using seeded Fisher-Yates shuffle.
/// Matches the web app's `getDailyMovies()`.
func getDailyMovies(entries: [RatingEntry], count: Int, now: Date = Date()) -> DailyMoviesResult {
    let dateKey = getNyDateKey(now)

    let epochDate = makeDateFromKey(thumbsEpoch)
    let todayDate = makeDateFromKey(dateKey)
    let daysSinceEpoch = daysBetween(epochDate, todayDate)
    let puzzleNumber = max(1, daysSinceEpoch + 1)

    guard !entries.isEmpty else {
        return DailyMoviesResult(dateKey: dateKey, movies: [], puzzleNumber: puzzleNumber)
    }

    let hash = stableHash(dateKey)
    var rng = SeededRandom(seed: hash)

    var shuffled = entries
    for i in stride(from: shuffled.count - 1, through: 1, by: -1) {
        let j = Int(floor(rng.next() * Double(i + 1)))
        shuffled.swapAt(i, j)
    }

    return DailyMoviesResult(
        dateKey: dateKey,
        movies: Array(shuffled.prefix(count)),
        puzzleNumber: puzzleNumber
    )
}

// MARK: - Daily ROLES

struct DailyRolesPuzzleResult {
    let dateKey: String
    let puzzle: RolesPuzzle?
    let puzzleNumber: Int
}

/// Selects the daily ROLES puzzle by cycling through the puzzle array.
/// Matches the web app's `getDailyRolesPuzzle()`.
func getDailyRolesPuzzle(puzzles: [RolesPuzzle], now: Date = Date()) -> DailyRolesPuzzleResult {
    let dateKey = getNyDateKey(now)
    guard !puzzles.isEmpty else {
        return DailyRolesPuzzleResult(dateKey: dateKey, puzzle: nil, puzzleNumber: 0)
    }

    let epochDate = makeDateFromKey(rolesEpoch)
    let todayDate = makeDateFromKey(dateKey)
    let daysSinceEpoch = daysBetween(epochDate, todayDate)
    let index = ((daysSinceEpoch % puzzles.count) + puzzles.count) % puzzles.count
    return DailyRolesPuzzleResult(
        dateKey: dateKey,
        puzzle: puzzles[index],
        puzzleNumber: index + 1
    )
}

// MARK: - Helpers

/// Parses "YYYY-MM-DD" into a Date at noon UTC (matching the web app's `new Date("YYYY-MM-DDT12:00:00")`).
private func makeDateFromKey(_ key: String) -> Date {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
    formatter.timeZone = TimeZone(identifier: "UTC")
    // The web app parses "YYYY-MM-DDT12:00:00" without timezone, which JS interprets as local time.
    // However the difference calculation still yields correct whole-day counts since both dates
    // use the same format. We use UTC noon to avoid DST edge cases.
    return formatter.date(from: key + "T12:00:00")!
}

/// Returns the number of whole days between two dates, using rounding to match JS Math.round().
private func daysBetween(_ from: Date, _ to: Date) -> Int {
    let seconds = to.timeIntervalSince(from)
    return Int((seconds / 86400.0).rounded())
}
