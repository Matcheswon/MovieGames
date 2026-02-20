import XCTest
@testable import MovieGames

final class DailyPuzzleEngineTests: XCTestCase {

    // MARK: - stableHash parity tests

    func testStableHashKnownValues() {
        // Verified against JS: stableHash("2026-02-17") => 1161695558
        XCTAssertEqual(stableHash("2026-02-17"), 1161695558)
        XCTAssertEqual(stableHash("2026-02-18"), 1161695559)
        XCTAssertEqual(stableHash("2026-02-19"), 1161695560)
        XCTAssertEqual(stableHash("2026-02-20"), 1161695582)
        XCTAssertEqual(stableHash("2026-03-01"), 1161725312)
    }

    // MARK: - SeededRandom parity tests

    func testSeededRandomKnownValues() {
        // Verified against JS: seededRandom(1161695558) first value => 0.16915463962805333
        var rng = SeededRandom(seed: 1161695558)
        XCTAssertEqual(rng.next(), 0.16915463962805333, accuracy: 1e-12)
        XCTAssertEqual(rng.next(), 0.36252930210030854, accuracy: 1e-12)
        XCTAssertEqual(rng.next(), 0.32250598988554113, accuracy: 1e-12)
        XCTAssertEqual(rng.next(), 0.5187572153561649, accuracy: 1e-12)
        XCTAssertEqual(rng.next(), 0.5897576477354759, accuracy: 1e-12)
    }

    func testSeededRandomDifferentSeeds() {
        var rng1 = SeededRandom(seed: 1161695559)
        XCTAssertEqual(rng1.next(), 0.16954219205527152, accuracy: 1e-12)

        var rng2 = SeededRandom(seed: 1161725312)
        XCTAssertEqual(rng2.next(), 0.7003895565169839, accuracy: 1e-12)
    }

    // MARK: - RolesRNG parity tests

    func testRolesRNGKnownValues() {
        // Verified against JS: rng(1) first 5 values
        var r = RolesRNG(seed: 1)
        XCTAssertEqual(r.next(), 0.000007826369259425611, accuracy: 1e-15)
        XCTAssertEqual(r.next(), 0.13153778814316625, accuracy: 1e-12)
        XCTAssertEqual(r.next(), 0.7556053221950332, accuracy: 1e-12)
        XCTAssertEqual(r.next(), 0.4586501319234493, accuracy: 1e-12)
        XCTAssertEqual(r.next(), 0.5327672374121692, accuracy: 1e-12)

        var r3 = RolesRNG(seed: 3)
        XCTAssertEqual(r3.next(), 0.000023479107778276833, accuracy: 1e-15)
        XCTAssertEqual(r3.next(), 0.39461336442949874, accuracy: 1e-12)
    }

    // MARK: - getNyDateKey tests

    func testGetNyDateKeyFormatsCorrectly() {
        // Create a known date: 2026-02-20 15:00 UTC = 2026-02-20 10:00 ET
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let components = DateComponents(year: 2026, month: 2, day: 20, hour: 15, minute: 0)
        let date = calendar.date(from: components)!
        XCTAssertEqual(getNyDateKey(date), "2026-02-20")
    }

    func testGetNyDateKeyMidnightEdge() {
        // 2026-02-21 04:30 UTC = 2026-02-20 23:30 ET (still Feb 20 in NY)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let components = DateComponents(year: 2026, month: 2, day: 21, hour: 4, minute: 30)
        let date = calendar.date(from: components)!
        XCTAssertEqual(getNyDateKey(date), "2026-02-20")
    }

    func testGetNyDateKeyAfterMidnightET() {
        // 2026-02-21 05:30 UTC = 2026-02-21 00:30 ET (now Feb 21 in NY)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let components = DateComponents(year: 2026, month: 2, day: 21, hour: 5, minute: 30)
        let date = calendar.date(from: components)!
        XCTAssertEqual(getNyDateKey(date), "2026-02-21")
    }

    // MARK: - getDailyMovies parity tests

    func testGetDailyMoviesKnownDates() {
        let ratings = DataLoader.loadRatings()
        guard !ratings.isEmpty else {
            // Data not bundled in test target — skip gracefully
            XCTExpectFailure("ratings.json not available in test bundle")
            XCTFail("ratings.json not found")
            return
        }

        // Test 5 dates against known JS outputs
        let testCases: [(dateKey: String, expectedFirstIDs: [String])] = [
            ("2026-02-17", ["danton-1983", "nothing-to-lose-1997", "lassie-1994"]),
            ("2026-02-18", ["jane-eyre-1996", "sacco-and-vanzetti-1971", "nice-dreams-1981"]),
            ("2026-02-19", ["diary-of-a-mad-housewife-1970", "emma-1996", "the-morning-after-1986"]),
            ("2026-02-20", ["4-little-girls-1997", "hard-choices-1985", "the-journey-of-august-king-1995"]),
            ("2026-03-01", ["the-house-of-the-spirits-1993", "kika-1993", "ben-1972"]),
        ]

        for tc in testCases {
            let date = makeTestDate(tc.dateKey)
            let result = getDailyMovies(entries: ratings, count: 10, now: date)
            XCTAssertEqual(result.dateKey, tc.dateKey)
            let actualIDs = result.movies.prefix(3).map(\.id)
            XCTAssertEqual(Array(actualIDs), tc.expectedFirstIDs, "Mismatch for \(tc.dateKey)")
        }
    }

    func testGetDailyMoviesPuzzleNumbers() {
        let ratings = DataLoader.loadRatings()
        guard !ratings.isEmpty else { return }

        // 2026-02-17 is epoch day 0 → puzzleNumber = max(1, 0+1) = 1
        let r1 = getDailyMovies(entries: ratings, count: 10, now: makeTestDate("2026-02-17"))
        XCTAssertEqual(r1.puzzleNumber, 1)

        // 2026-02-20 is day 3 → puzzleNumber = 4
        let r2 = getDailyMovies(entries: ratings, count: 10, now: makeTestDate("2026-02-20"))
        XCTAssertEqual(r2.puzzleNumber, 4)

        // 2026-03-01 is day 12 → puzzleNumber = 13
        let r3 = getDailyMovies(entries: ratings, count: 10, now: makeTestDate("2026-03-01"))
        XCTAssertEqual(r3.puzzleNumber, 13)
    }

    // MARK: - getDailyRolesPuzzle parity tests

    func testGetDailyRolesPuzzleKnownDates() {
        let puzzles = DataLoader.loadRolesPuzzles()
        guard !puzzles.isEmpty else {
            XCTExpectFailure("roles.json not available in test bundle")
            XCTFail("roles.json not found")
            return
        }

        let testCases: [(dateKey: String, expectedActor: String, expectedCharacter: String, expectedNumber: Int)] = [
            ("2026-02-17", "JODIE FOSTER", "CLARICE STARLING", 1),
            ("2026-02-18", "TOM HANKS", "FORREST GUMP", 2),
            ("2026-02-19", "HEATH LEDGER", "THE JOKER", 3),
            ("2026-02-20", "BRAD PITT", "TYLER DURDEN", 4),
            ("2026-03-01", "SYLVESTER STALLONE", "ROCKY BALBOA", 13),
        ]

        for tc in testCases {
            let date = makeTestDate(tc.dateKey)
            let result = getDailyRolesPuzzle(puzzles: puzzles, now: date)
            XCTAssertEqual(result.dateKey, tc.dateKey)
            XCTAssertEqual(result.puzzle?.actor, tc.expectedActor, "Actor mismatch for \(tc.dateKey)")
            XCTAssertEqual(result.puzzle?.character, tc.expectedCharacter, "Character mismatch for \(tc.dateKey)")
            XCTAssertEqual(result.puzzleNumber, tc.expectedNumber, "Puzzle number mismatch for \(tc.dateKey)")
        }
    }

    func testGetDailyRolesPuzzleCyclesCorrectly() {
        let puzzles = DataLoader.loadRolesPuzzles()
        guard !puzzles.isEmpty else { return }

        // Day 71 (puzzles.count) should cycle back to index 0
        // 2026-02-17 + 71 days = 2026-04-29
        let date = makeTestDate("2026-04-29")
        let result = getDailyRolesPuzzle(puzzles: puzzles, now: date)
        XCTAssertEqual(result.puzzle?.actor, puzzles[0].actor,
                       "Should cycle back to first puzzle after \(puzzles.count) days")
    }

    // MARK: - Helpers

    private func makeTestDate(_ dateKey: String) -> Date {
        // Create a date that will produce the given dateKey when formatted in NY timezone.
        // Use noon ET (17:00 UTC during EST) to avoid edge cases.
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        let parts = dateKey.split(separator: "-").map { Int($0)! }
        let components = DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12)
        return calendar.date(from: components)!
    }
}
