import SwiftUI

// MARK: - Types

enum RolesScreen {
    case start
    case playing
    case solved
    case failed
}

enum RolesPhase: Equatable {
    case idle
    case pickLetters
    case revealingPicks
    case preRoll
    case rolling
    case revealFlash
    case guessing
    case pickDouble
    case roundEnding
}

struct RolesHistoryEntry: Codable {
    let dateKey: String
    let puzzleNumber: Int
    let solved: Bool
    let strikes: Int
    let timeSecs: Int
    let roundsUsed: Int
}

struct RolesDailyStreakData: Codable {
    var lastPlayedDate: String?
    var dailyStreak: Int
    var bestDailyStreak: Int
    var history: [RolesHistoryEntry]

    static let empty = RolesDailyStreakData(lastPlayedDate: nil, dailyStreak: 0, bestDailyStreak: 0, history: [])
}

// MARK: - Wheel Effect

struct WheelEffect: Equatable {
    let label: String
    let desc: String
    let icon: String
    let type: String
    let good: Bool
}

let CALL_SHEET: [WheelEffect] = [
    WheelEffect(label: "Letter Spin", desc: "A random letter is guessed", icon: "\u{1F524}", type: "random_letter", good: true),
    WheelEffect(label: "Letter Spin", desc: "A random letter is guessed", icon: "\u{1F524}", type: "random_letter", good: true),
    WheelEffect(label: "Double Spin", desc: "Two random letters guessed", icon: "\u{2728}", type: "double_letter", good: true),
    WheelEffect(label: "Vowel Spin", desc: "A random vowel is guessed", icon: "\u{1F170}\u{FE0F}", type: "vowel", good: true),
    WheelEffect(label: "Double Guess", desc: "Guess 2 letters next!", icon: "\u{1F3AF}", type: "double_guess", good: true),
    WheelEffect(label: "+4 Seconds", desc: "Extra time this round", icon: "\u{23F1}\u{FE0F}", type: "bonus_time", good: true),
    WheelEffect(label: "Lose a Turn", desc: "Skip to next round", icon: "\u{23ED}\u{FE0F}", type: "lose_turn", good: false),
    WheelEffect(label: "Half Time", desc: "Only 4 seconds", icon: "\u{23F3}", type: "half_time", good: false),
    WheelEffect(label: "Keyboard Lock", desc: "Solve only this round", icon: "\u{1F512}", type: "kb_lock", good: false),
]

// MARK: - Constants

private let BASE_TIME = 8
private let MAX_STRIKES = 3
private let MAX_ROUNDS = 8

// MARK: - Local Storage

private let rolesStorageKey = "moviegames:roles:daily"

private func readRolesDailyStreak() -> RolesDailyStreakData {
    guard let data = UserDefaults.standard.data(forKey: rolesStorageKey),
          let decoded = try? JSONDecoder().decode(RolesDailyStreakData.self, from: data) else {
        return .empty
    }
    return decoded
}

private func writeRolesDailyStreak(_ data: RolesDailyStreakData) {
    if let encoded = try? JSONEncoder().encode(data) {
        UserDefaults.standard.set(encoded, forKey: rolesStorageKey)
    }
}

private func isYesterdayRoles(_ dateStr: String, relativeTo todayStr: String) -> Bool {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.timeZone = TimeZone(identifier: "UTC")
    guard let d = formatter.date(from: dateStr) else { return false }
    let next = Calendar.current.date(byAdding: .day, value: 1, to: d)!
    return formatter.string(from: next) == todayStr
}

// MARK: - Letter Helpers

private func normalizeLetter(_ ch: Character) -> Character {
    let str = String(ch)
    let decomposed = str.decomposedStringWithCanonicalMapping
    let stripped = decomposed.unicodeScalars.filter { !("\u{0300}"..."\u{036f}").contains($0) }
    let result = String(stripped.map { Character($0) })
    return result.uppercased().first ?? ch
}

private func isGuessableChar(_ ch: Character) -> Bool {
    let n = normalizeLetter(ch)
    return n.isLetter && n.isASCII
}

private func normalizePhrase(_ phrase: String) -> String {
    phrase.map { ch in
        isGuessableChar(ch) ? String(normalizeLetter(ch)) : String(ch)
    }.joined()
}

private func getAllLetters(actor: String, character: String) -> Set<Character> {
    var s = Set<Character>()
    for ch in actor {
        if isGuessableChar(ch) { s.insert(normalizeLetter(ch)) }
    }
    for ch in character {
        if isGuessableChar(ch) { s.insert(normalizeLetter(ch)) }
    }
    return s
}

struct BlankPosition: Equatable {
    let word: String // "actor" or "character"
    let index: Int
    let ch: Character
}

private func getBlankPositions(actor: String, character: String, revealed: Set<Character>) -> [BlankPosition] {
    var positions: [BlankPosition] = []
    for (i, ch) in actor.enumerated() {
        let n = normalizeLetter(ch)
        if isGuessableChar(ch) && !revealed.contains(n) {
            positions.append(BlankPosition(word: "actor", index: i, ch: n))
        }
    }
    for (i, ch) in character.enumerated() {
        let n = normalizeLetter(ch)
        if isGuessableChar(ch) && !revealed.contains(n) {
            positions.append(BlankPosition(word: "character", index: i, ch: n))
        }
    }
    return positions
}

private func tileKey(_ word: String, _ index: Int) -> String {
    "\(word)-\(index)"
}

// MARK: - RolesGameView

struct RolesGameView: View {
    @EnvironmentObject private var puzzleManager: PuzzleManager

    // Screen state
    @State private var screen: RolesScreen = .start
    @State private var phase: RolesPhase = .idle

    // Core game state
    @State private var revealed = Set<Character>()
    @State private var round = 0
    @State private var strikes = 0
    @State private var totalTime = 0
    @State private var guessTime = BASE_TIME
    @State private var guessTimer = BASE_TIME
    @State private var guessedLetters = Set<Character>()
    @State private var wrongGuesses: [Character] = []

    // Wheel
    @State private var rollResult: WheelEffect? = nil
    @State private var rollAnimIdx = -1
    @State private var rollSequence: [WheelEffect] = []
    @State private var isWindUp = false

    // Pick letters
    @State private var pickedLetters: [Character] = []
    @State private var revealingIdx = -1

    // Guessing
    @State private var guessesThisRound = 1
    @State private var guessesRemaining = 1
    @State private var guessResolving = false
    @State private var roundKbLock = false
    @State private var lostTurn = false
    @State private var lostRounds = Set<Int>()

    // Solve
    @State private var solveMode = false
    @State private var solveCursor = 0
    @State private var solveInputs: [String: Character] = [:]
    @State private var solveAttempts = 2
    @State private var finalSolveMode = false
    @State private var shakeBoard = false

    // Animation
    @State private var tileBlinking: String? = nil
    @State private var tilesLit = Set<String>()
    @State private var tilesPopping = Set<String>()
    @State private var fanfareLetter: String? = nil
    @State private var fanfareCount = 0
    @State private var fanfareEasterEgg: String? = nil
    @State private var lastGuess: (letter: Character, correct: Bool, fromSpin: Bool)? = nil
    @State private var turnWarning: String? = nil

    // Streak & daily
    @State private var dailyStreak = 0
    @State private var bestDailyStreak = 0
    @State private var alreadyPlayed: RolesHistoryEntry? = nil
    @State private var showAlreadyPlayedPopup = false
    @State private var dailyRecorded = false

    // Timers
    @State private var totalTimerTask: Task<Void, Never>?
    @State private var guessTimerTask: Task<Void, Never>?

    // RNG for wheel effects
    @State private var rand: RolesRNG = RolesRNG(seed: 1)

    private var dateKey: String { puzzleManager.currentDateKey }
    private var puzzleNumber: Int { puzzleManager.rolesResult?.puzzleNumber ?? 0 }
    private var puzzle: RolesPuzzle? { puzzleManager.rolesResult?.puzzle }

    private var allLetters: Set<Character> {
        guard let p = puzzle else { return [] }
        return getAllLetters(actor: p.actor, character: p.character)
    }

    private var allDone: Bool {
        allLetters.allSatisfy { revealed.contains($0) }
    }

    private var blankPositions: [BlankPosition] {
        guard let p = puzzle else { return [] }
        return getBlankPositions(actor: p.actor, character: p.character, revealed: revealed)
    }

    private var kbLocked: Bool {
        strikes >= MAX_STRIKES || roundKbLock
    }

    private var isOver: Bool {
        screen == .solved || screen == .failed
    }

    var body: some View {
        ZStack {
            Theme.cinematicBackground

            switch screen {
            case .start:
                startScreen
            case .playing:
                playingScreen
            case .solved:
                resultsScreen(won: true)
            case .failed:
                resultsScreen(won: false)
            }

            if showAlreadyPlayedPopup, let entry = alreadyPlayed {
                alreadyPlayedPopup(entry: entry)
            }

            // Turn warning overlay
            if let warning = turnWarning {
                turnWarningOverlay(warning)
            }
        }
        .onAppear(perform: loadDailyData)
    }

    // MARK: - Load Daily Data

    private func loadDailyData() {
        let data = readRolesDailyStreak()
        if let last = data.lastPlayedDate {
            if last == dateKey || isYesterdayRoles(last, relativeTo: dateKey) {
                dailyStreak = data.dailyStreak
            }
        }
        bestDailyStreak = data.bestDailyStreak

        if let todayEntry = data.history.first(where: { $0.dateKey == dateKey }) {
            alreadyPlayed = todayEntry
            showAlreadyPlayedPopup = true
        }
    }

    // MARK: - Start Game

    private func startGame() {
        guard let p = puzzle else { return }

        // Generate wheel effect sequence using seeded RNG
        rand = RolesRNG(seed: puzzleNumber + Int(Date().timeIntervalSince1970.truncatingRemainder(dividingBy: 1_000_000)))
        var seq: [WheelEffect] = []
        for _ in 0..<MAX_ROUNDS {
            var counts: [String: Int] = [:]
            for e in seq { counts[e.type, default: 0] += 1 }
            let prev = seq.last?.type

            let isRejected: (String) -> Bool = { t in
                (t == "lose_turn" && (prev == "lose_turn" || (counts["lose_turn"] ?? 0) >= 2)) ||
                (t == "kb_lock"   && (prev == "kb_lock"   || (counts["kb_lock"]   ?? 0) >= 1)) ||
                (t == "half_time" && (prev == "half_time" || (counts["half_time"] ?? 0) >= 2))
            }

            var eff: WheelEffect
            var tries = 0
            repeat {
                let idx = Int(floor(rand.next() * Double(CALL_SHEET.count)))
                eff = CALL_SHEET[idx]
                tries += 1
            } while isRejected(eff.type) && tries < 20
            seq.append(eff)
        }
        rollSequence = seq

        // Reset all state
        revealed = Set<Character>()
        round = 0
        phase = .pickLetters
        strikes = 0
        totalTime = 0
        guessTime = BASE_TIME
        guessTimer = BASE_TIME
        guessedLetters = Set<Character>()
        wrongGuesses = []
        rollResult = nil
        rollAnimIdx = -1
        isWindUp = false
        pickedLetters = []
        revealingIdx = -1
        guessesThisRound = 1
        guessesRemaining = 1
        guessResolving = false
        roundKbLock = false
        lostTurn = false
        lostRounds = Set<Int>()
        solveMode = false
        solveCursor = 0
        solveInputs = [:]
        solveAttempts = 2
        finalSolveMode = false
        shakeBoard = false
        tileBlinking = nil
        tilesLit = Set<String>()
        tilesPopping = Set<String>()
        fanfareLetter = nil
        fanfareCount = 0
        fanfareEasterEgg = nil
        lastGuess = nil
        turnWarning = nil
        dailyRecorded = false
        showAlreadyPlayedPopup = false

        screen = .playing
    }

    // MARK: - Total Timer

    private func startTotalTimer() {
        totalTimerTask?.cancel()
        totalTimerTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if !Task.isCancelled {
                    totalTime += 1
                }
            }
        }
    }

    private func stopTotalTimer() {
        totalTimerTask?.cancel()
    }

    // MARK: - Guess Timer

    private func startGuessTimer() {
        guessTimerTask?.cancel()
        guessTimer = guessTime
        guessTimerTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if Task.isCancelled { break }
                guessTimer -= 1
                if guessTimer <= 0 {
                    guessResolving = true
                    phase = .roundEnding
                    advance()
                    break
                }
            }
        }
    }

    private func stopGuessTimer() {
        guessTimerTask?.cancel()
    }

    // MARK: - Advance Round

    private func advance() {
        solveMode = false
        solveCursor = 0
        solveInputs = [:]
        guessResolving = false
        roundKbLock = false
        guessTime = BASE_TIME
        lostTurn = false
        lastGuess = nil
        tileBlinking = nil
        tilesPopping = Set<String>()
        tilesLit = Set<String>()

        let next = round + 1
        if next >= MAX_ROUNDS {
            stopTotalTimer()
            stopGuessTimer()
            finalSolveMode = true
            solveAttempts = 1
            guessesRemaining = 0
            phase = .guessing
            solveMode = true
            return
        }

        round = next
        rollResult = nil
        guessesThisRound = 1
        guessesRemaining = 1

        Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            await MainActor.run {
                phase = .preRoll
                showTurnWarning()
            }
        }
    }

    // MARK: - Turn Warning

    private func showTurnWarning() {
        let turnsLeft = MAX_ROUNDS - round
        let msg: String
        if turnsLeft == 1 {
            msg = "Last round!"
        } else if turnsLeft <= 3 {
            msg = "\(turnsLeft) rounds left!"
        } else {
            msg = "Round \(round + 1)"
        }
        turnWarning = msg
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            await MainActor.run {
                if turnWarning == msg { turnWarning = nil }
            }
        }
    }

    // MARK: - Pick Letters

    private func handlePickLetter(_ letter: Character) {
        let isPicking = phase == .pickLetters || phase == .pickDouble
        let pickMax = phase == .pickDouble ? 2 : 3
        guard isPicking, pickedLetters.count < pickMax else { return }

        let u = Character(letter.uppercased())
        guard !pickedLetters.contains(u) else { return }

        // During double guess, can't pick already guessed/revealed letters
        if phase == .pickDouble && (guessedLetters.contains(u) || revealed.contains(u)) { return }

        pickedLetters.append(u)
        if pickedLetters.count >= pickMax {
            let letters = pickedLetters
            if phase == .pickDouble {
                Task {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    await MainActor.run { revealDoubleGuess(letters) }
                }
            } else {
                Task {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    await MainActor.run { revealPicked(letters) }
                }
            }
        }
    }

    private func handlePickBackspace() {
        let isPicking = phase == .pickLetters || phase == .pickDouble
        guard isPicking, !pickedLetters.isEmpty else { return }
        pickedLetters.removeLast()
    }

    // MARK: - Reveal Picked Letters (Initial 3)

    private func revealPicked(_ letters: [Character]) {
        guard let p = puzzle else { return }
        phase = .revealingPicks

        // Mark all as guessed
        for l in letters { guessedLetters.insert(l) }

        // Collect hit positions
        var allPositions: [(word: String, index: Int, letter: Character)] = []
        for letter in letters {
            guard allLetters.contains(letter) else { continue }
            for (i, ch) in p.actor.enumerated() {
                if normalizeLetter(ch) == letter {
                    allPositions.append(("actor", i, letter))
                }
            }
            for (i, ch) in p.character.enumerated() {
                if normalizeLetter(ch) == letter {
                    allPositions.append(("character", i, letter))
                }
            }
        }

        // Mark misses
        for l in letters where !allLetters.contains(l) {
            wrongGuesses.append(l)
        }

        // Two-pass reveal animation
        twoPassReveal(
            positions: allPositions,
            letters: letters,
            isPickReveal: true,
            onComplete: {
                revealingIdx = -1
                Task {
                    try? await Task.sleep(nanoseconds: 600_000_000)
                    await MainActor.run {
                        phase = .preRoll
                        startTotalTimer()
                        showTurnWarning()
                    }
                }
            }
        )
    }

    // MARK: - Two-Pass Tile Reveal Animation

    private func twoPassReveal(
        positions: [(word: String, index: Int, letter: Character)],
        letters: [Character],
        isPickReveal: Bool,
        addStrikes: Bool = false,
        onComplete: @escaping () -> Void
    ) {
        guard !positions.isEmpty else {
            onComplete()
            return
        }

        // Pass 1: Light up each position
        var lightIdx = 0
        var currentLetter: Character? = nil

        func lightUp() {
            guard lightIdx < positions.count else {
                tileBlinking = nil
                Task {
                    try? await Task.sleep(nanoseconds: isPickReveal ? 600_000_000 : 500_000_000)
                    await MainActor.run { revealAll() }
                }
                return
            }

            let pos = positions[lightIdx]
            let key = tileKey(pos.word, pos.index)

            if pos.letter != currentLetter {
                currentLetter = pos.letter
                if isPickReveal, let idx = letters.firstIndex(of: pos.letter) {
                    revealingIdx = idx
                }
            }

            tileBlinking = key
            lightIdx += 1

            Task {
                try? await Task.sleep(nanoseconds: 350_000_000)
                await MainActor.run {
                    tileBlinking = nil
                    tilesLit.insert(key)
                    Task {
                        try? await Task.sleep(nanoseconds: 200_000_000)
                        await MainActor.run { lightUp() }
                    }
                }
            }
        }

        // Pass 2: Reveal each position (sorted: actor first, then character, left to right)
        let revealOrder = positions.sorted { a, b in
            if a.word != b.word { return a.word == "actor" }
            return a.index < b.index
        }
        var revIdx = 0

        func revealAll() {
            guard revIdx < revealOrder.count else {
                // Add letters to revealed set
                for l in letters where allLetters.contains(l) {
                    revealed.insert(l)
                }
                Task {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    await MainActor.run {
                        tilesPopping = Set<String>()
                        tilesLit = Set<String>()
                        checkAllDone()
                        onComplete()
                    }
                }
                return
            }

            let pos = revealOrder[revIdx]
            let key = tileKey(pos.word, pos.index)
            tilesLit.remove(key)
            tilesPopping.insert(key)
            revIdx += 1

            Task {
                try? await Task.sleep(nanoseconds: 250_000_000)
                await MainActor.run { revealAll() }
            }
        }

        Task {
            try? await Task.sleep(nanoseconds: 400_000_000)
            await MainActor.run { lightUp() }
        }
    }

    // MARK: - Check All Done

    private func checkAllDone() {
        guard screen == .playing, allDone,
              phase != .pickLetters, phase != .revealingPicks, phase != .pickDouble else { return }

        stopTotalTimer()
        stopGuessTimer()

        if let p = puzzle, let egg = p.easter_egg {
            fanfareEasterEgg = egg
            fanfareLetter = "_ee"
            Task {
                try? await Task.sleep(nanoseconds: 2_800_000_000)
                await MainActor.run {
                    fanfareEasterEgg = nil
                    fanfareLetter = nil
                }
            }
            Task {
                try? await Task.sleep(nanoseconds: 3_200_000_000)
                await MainActor.run {
                    screen = .solved
                    recordDailyResult()
                }
            }
        } else {
            Task {
                try? await Task.sleep(nanoseconds: 500_000_000)
                await MainActor.run {
                    screen = .solved
                    recordDailyResult()
                }
            }
        }
    }

    // MARK: - Wheel Spin (Role Call)

    private func handleSpin() {
        guard phase == .preRoll else { return }
        autoRoll(round)
    }

    private func autoRoll(_ roundIdx: Int) {
        phase = .rolling
        lastGuess = nil
        rollResult = nil

        let eff = rollSequence[roundIdx]
        let n = CALL_SHEET.count
        let total = 24 + Int(floor(rand.next() * 8.0))
        let effIdx = CALL_SHEET.firstIndex(where: { $0 == eff }) ?? 0

        // Calculate start so wind-up(-1) + spin(+total) lands on effIdx
        let startIdx = ((effIdx + 1 - total) % n + n) % n

        // Phase 1: Show resting position
        isWindUp = true
        rollAnimIdx = startIdx

        // Phase 2: Pull wheel UP one notch
        Task {
            try? await Task.sleep(nanoseconds: 200_000_000)
            await MainActor.run {
                let upIdx = ((startIdx - 1) + n) % n
                rollAnimIdx = upIdx

                // Phase 3: Pause, then release into fast spin
                Task {
                    try? await Task.sleep(nanoseconds: 220_000_000)
                    await MainActor.run {
                        isWindUp = false
                        spinTick(from: upIdx, step: 0, total: total, n: n, eff: eff)
                    }
                }
            }
        }
    }

    private func spinTick(from currentIdx: Int, step: Int, total: Int, n: Int, eff: WheelEffect) {
        let nextIdx = (currentIdx + 1) % n
        rollAnimIdx = nextIdx
        let newStep = step + 1

        if newStep >= total {
            // Landed — hold briefly, then reveal
            Task {
                try? await Task.sleep(nanoseconds: 350_000_000)
                await MainActor.run {
                    rollAnimIdx = -1
                    rollResult = eff
                    phase = .revealFlash
                    Task {
                        try? await Task.sleep(nanoseconds: 900_000_000)
                        await MainActor.run { applyRollEffect(eff) }
                    }
                }
            }
            return
        }

        // Cubic ease: delay ramps from 50ms (fast) -> 420ms (crawl)
        let progress = Double(newStep) / Double(total)
        let eased = progress * progress * progress
        let delayMs = 50.0 + eased * 370.0
        let delayNs = UInt64(delayMs * 1_000_000)

        Task {
            try? await Task.sleep(nanoseconds: delayNs)
            await MainActor.run {
                spinTick(from: nextIdx, step: newStep, total: total, n: n, eff: eff)
            }
        }
    }

    // MARK: - Apply Wheel Effect

    private func applyRollEffect(_ roll: WheelEffect) {
        guard let p = puzzle else { return }
        let t = roll.type

        if t == "lose_turn" {
            guessResolving = false
            lostTurn = true
            lostRounds.insert(round)
            Task {
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                await MainActor.run { advance() }
            }
            return
        }
        if t == "half_time" {
            guessResolving = false
            guessTime = 4
            Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                await MainActor.run {
                    phase = .guessing
                    startGuessTimer()
                }
            }
            return
        }
        if t == "kb_lock" {
            guessResolving = false
            roundKbLock = true
            guessTime = 4
            Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                await MainActor.run {
                    phase = .guessing
                    startGuessTimer()
                }
            }
            return
        }
        if t == "bonus_time" {
            guessResolving = false
            guessTime = BASE_TIME + 4
            Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                await MainActor.run {
                    phase = .guessing
                    startGuessTimer()
                }
            }
            return
        }
        if t == "double_guess" {
            guessResolving = false
            pickedLetters = []
            Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                await MainActor.run { phase = .pickDouble }
            }
            return
        }

        // random_letter, double_letter, vowel
        let isVowel = t == "vowel"
        let count = t == "double_letter" ? 2 : 1

        var spunLetters = Set<Character>()

        func doSpin(remaining: Int) {
            guard remaining > 0 else {
                Task {
                    try? await Task.sleep(nanoseconds: 600_000_000)
                    await MainActor.run {
                        phase = .guessing
                        startGuessTimer()
                    }
                }
                return
            }

            let alphabet: [Character] = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
            var pool = alphabet.filter { !guessedLetters.contains($0) && !spunLetters.contains($0) }
            if isVowel { pool = pool.filter { "AEIOU".contains($0) } }

            guard !pool.isEmpty else {
                Task {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    await MainActor.run {
                        phase = .guessing
                        startGuessTimer()
                    }
                }
                return
            }

            let letter = pool[Int(floor(rand.next() * Double(pool.count)))]
            spunLetters.insert(letter)
            let isHit = allLetters.contains(letter)

            guessedLetters.insert(letter)

            if isHit {
                let hitCount = (p.actor + p.character).filter { normalizeLetter($0) == letter }.count
                lastGuess = (letter: letter, correct: true, fromSpin: true)

                Task {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    await MainActor.run {
                        staggerRevealLetter(letter) {
                            fanfareLetter = String(letter)
                            fanfareCount = hitCount
                            Task {
                                try? await Task.sleep(nanoseconds: 2_400_000_000)
                                await MainActor.run {
                                    fanfareLetter = nil
                                    fanfareCount = 0
                                }
                            }
                            lastGuess = nil
                            Task {
                                try? await Task.sleep(nanoseconds: 800_000_000)
                                await MainActor.run { doSpin(remaining: remaining - 1) }
                            }
                        }
                    }
                }
            } else {
                wrongGuesses.append(letter)
                lastGuess = (letter: letter, correct: false, fromSpin: true)
                Task {
                    try? await Task.sleep(nanoseconds: 1_200_000_000)
                    await MainActor.run {
                        lastGuess = nil
                        doSpin(remaining: remaining - 1)
                    }
                }
            }
        }

        Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            await MainActor.run { doSpin(remaining: count) }
        }
    }

    // MARK: - Stagger Reveal Single Letter

    private func staggerRevealLetter(_ letter: Character, onDone: @escaping () -> Void) {
        guard let p = puzzle else { onDone(); return }

        var positions: [(word: String, index: Int)] = []
        for (i, ch) in p.actor.enumerated() {
            if normalizeLetter(ch) == letter { positions.append(("actor", i)) }
        }
        for (i, ch) in p.character.enumerated() {
            if normalizeLetter(ch) == letter { positions.append(("character", i)) }
        }

        guard !positions.isEmpty else { onDone(); return }

        twoPassReveal(
            positions: positions.map { ($0.word, $0.index, letter) },
            letters: [letter],
            isPickReveal: false,
            onComplete: onDone
        )
    }

    // MARK: - Reveal Double Guess

    private func revealDoubleGuess(_ letters: [Character]) {
        guard let p = puzzle else { return }
        phase = .roundEnding

        for l in letters { guessedLetters.insert(l) }

        var allPositions: [(word: String, index: Int, letter: Character)] = []
        for letter in letters {
            guard allLetters.contains(letter) else { continue }
            for (i, ch) in p.actor.enumerated() {
                if normalizeLetter(ch) == letter { allPositions.append(("actor", i, letter)) }
            }
            for (i, ch) in p.character.enumerated() {
                if normalizeLetter(ch) == letter { allPositions.append(("character", i, letter)) }
            }
        }

        // Mark misses and add strikes
        let misses = letters.filter { !allLetters.contains($0) }
        for l in misses { wrongGuesses.append(l) }
        if !misses.isEmpty { strikes += misses.count }

        guard !allPositions.isEmpty else {
            Task {
                try? await Task.sleep(nanoseconds: 800_000_000)
                await MainActor.run { advance() }
            }
            return
        }

        twoPassReveal(
            positions: allPositions,
            letters: letters,
            isPickReveal: true,
            onComplete: {
                revealingIdx = -1
                let hitCount = allPositions.count
                if hitCount > 0 {
                    let hitLetters = letters.filter { allLetters.contains($0) }.map { String($0) }.joined(separator: "+")
                    fanfareLetter = hitLetters
                    fanfareCount = hitCount
                    Task {
                        try? await Task.sleep(nanoseconds: 2_400_000_000)
                        await MainActor.run {
                            fanfareLetter = nil
                            fanfareCount = 0
                        }
                    }
                }
                Task {
                    try? await Task.sleep(nanoseconds: 800_000_000)
                    await MainActor.run { advance() }
                }
            }
        )
    }

    // MARK: - Guess Letter

    private func handleLetter(_ letter: Character) {
        guard let p = puzzle else { return }
        if solveMode { handleSolveType(letter); return }
        guard phase == .guessing, !kbLocked, !guessResolving, guessTimer > 0 else { return }

        let u = Character(letter.uppercased())
        guard !guessedLetters.contains(u), !revealed.contains(u) else { return }
        guessResolving = true

        guessedLetters.insert(u)
        let isCorrect = allLetters.contains(u)
        let newStrikes = isCorrect ? strikes : strikes + 1

        if isCorrect {
            // Pause timer, reveal tiles
            stopGuessTimer()
            let count = (p.actor + p.character).filter { normalizeLetter($0) == u }.count
            lastGuess = (letter: u, correct: true, fromSpin: false)

            Task {
                try? await Task.sleep(nanoseconds: 600_000_000)
                await MainActor.run {
                    staggerRevealLetter(u) {
                        fanfareLetter = String(u)
                        fanfareCount = count
                        Task {
                            try? await Task.sleep(nanoseconds: 2_400_000_000)
                            await MainActor.run {
                                fanfareLetter = nil
                                fanfareCount = 0
                            }
                        }

                        if newStrikes >= MAX_STRIKES {
                            lostRounds.insert(round)
                            turnWarning = "3 strikes \u{2014} locked out!"
                            phase = .roundEnding
                            Task {
                                try? await Task.sleep(nanoseconds: 2_500_000_000)
                                await MainActor.run {
                                    turnWarning = nil
                                    advance()
                                }
                            }
                            return
                        }

                        consumeGuess()
                        guessResolving = false
                    }
                }
            }
            return
        } else {
            strikes = newStrikes
            wrongGuesses.append(u)
            lastGuess = (letter: u, correct: false, fromSpin: false)
        }

        // Check lockout from strikes
        if newStrikes >= MAX_STRIKES {
            stopGuessTimer()
            lostRounds.insert(round)
            Task {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                await MainActor.run {
                    turnWarning = "3 strikes \u{2014} locked out!"
                    phase = .roundEnding
                    Task {
                        try? await Task.sleep(nanoseconds: 2_500_000_000)
                        await MainActor.run {
                            turnWarning = nil
                            advance()
                        }
                    }
                }
            }
            return
        }

        consumeGuess()
        guessResolving = false
    }

    private func consumeGuess() {
        let nextRemaining = max(0, guessesRemaining - 1)
        guessesRemaining = nextRemaining

        if nextRemaining > 0 {
            startGuessTimer()
        } else {
            stopGuessTimer()
            phase = .roundEnding
            Task {
                try? await Task.sleep(nanoseconds: 800_000_000)
                await MainActor.run { advance() }
            }
        }
    }

    // MARK: - Solve Mode

    private func enterSolveMode() {
        let mustUseLetterGuesses = guessesThisRound > 1 && guessesRemaining > 0
        guard !mustUseLetterGuesses, !guessResolving, guessTimer > 0 else { return }
        guard solveAttempts > 0 else { return }
        stopGuessTimer()
        solveMode = true
        solveCursor = 0
        solveInputs = [:]
    }

    private func handleSolveType(_ letter: Character) {
        guard solveMode else { return }
        let blanks = blankPositions
        guard solveCursor < blanks.count else { return }
        let pos = blanks[solveCursor]
        let key = tileKey(pos.word, pos.index)
        solveInputs[key] = Character(letter.uppercased())
        solveCursor = min(solveCursor + 1, blanks.count)
    }

    private func handleSolveBackspace() {
        guard solveMode, solveCursor > 0 else { return }
        let prev = solveCursor - 1
        let pos = blankPositions[prev]
        let key = tileKey(pos.word, pos.index)
        solveInputs.removeValue(forKey: key)
        solveCursor = prev
    }

    private func handleSolveSubmit() {
        guard solveMode, let p = puzzle else { return }
        let allFilled = blankPositions.allSatisfy { solveInputs[tileKey($0.word, $0.index)] != nil }
        guard allFilled else { return }

        // Build guesses
        let actorGuess = p.actor.enumerated().map { (i, ch) -> String in
            if !isGuessableChar(ch) { return String(ch) }
            if revealed.contains(normalizeLetter(ch)) { return String(normalizeLetter(ch)) }
            if let input = solveInputs[tileKey("actor", i)] { return String(input) }
            return "?"
        }.joined()

        let charGuess = p.character.enumerated().map { (i, ch) -> String in
            if !isGuessableChar(ch) { return String(ch) }
            if revealed.contains(normalizeLetter(ch)) { return String(normalizeLetter(ch)) }
            if let input = solveInputs[tileKey("character", i)] { return String(input) }
            return "?"
        }.joined()

        if actorGuess == normalizePhrase(p.actor) && charGuess == normalizePhrase(p.character) {
            // Correct solve!
            stopTotalTimer()
            if let egg = p.easter_egg {
                fanfareEasterEgg = egg
                fanfareLetter = "_ee"
                solveMode = false
                Task {
                    try? await Task.sleep(nanoseconds: 2_800_000_000)
                    await MainActor.run {
                        fanfareEasterEgg = nil
                        fanfareLetter = nil
                    }
                }
                Task {
                    try? await Task.sleep(nanoseconds: 3_200_000_000)
                    await MainActor.run {
                        screen = .solved
                        recordDailyResult()
                    }
                }
            } else {
                screen = .solved
                recordDailyResult()
            }
        } else {
            // Wrong solve
            if finalSolveMode {
                let nextStrikes = strikes + 1
                strikes = nextStrikes
                shakeBoard = true
                Task {
                    try? await Task.sleep(nanoseconds: 500_000_000)
                    await MainActor.run { shakeBoard = false }
                }
                solveInputs = [:]
                solveCursor = 0
                if nextStrikes >= MAX_STRIKES {
                    stopTotalTimer()
                    screen = .failed
                    recordDailyResult()
                }
                return
            }

            let na = solveAttempts - 1
            solveAttempts = na
            shakeBoard = true
            Task {
                try? await Task.sleep(nanoseconds: 500_000_000)
                await MainActor.run { shakeBoard = false }
            }
            solveInputs = [:]
            solveCursor = 0
            if na <= 0 {
                stopTotalTimer()
                screen = .failed
                recordDailyResult()
            }
        }
    }

    private func cancelSolve() {
        guard !finalSolveMode else { return }
        solveMode = false
        solveCursor = 0
        solveInputs = [:]
        if phase == .guessing {
            startGuessTimer()
        }
    }

    // MARK: - Record Daily Result

    private func recordDailyResult() {
        guard !dailyRecorded else { return }
        dailyRecorded = true

        let roundsUsed = min(MAX_ROUNDS, round + 1)
        var data = readRolesDailyStreak()

        if data.lastPlayedDate == dateKey {
            dailyStreak = data.dailyStreak
            bestDailyStreak = data.bestDailyStreak
            return
        }

        let newStreak: Int
        if let last = data.lastPlayedDate, isYesterdayRoles(last, relativeTo: dateKey) {
            newStreak = data.dailyStreak + 1
        } else {
            newStreak = 1
        }
        let newBest = max(newStreak, data.bestDailyStreak)

        let entry = RolesHistoryEntry(
            dateKey: dateKey,
            puzzleNumber: puzzleNumber,
            solved: screen == .solved,
            strikes: strikes,
            timeSecs: totalTime,
            roundsUsed: roundsUsed
        )
        let alreadyLogged = data.history.contains(where: { $0.dateKey == dateKey })
        data.lastPlayedDate = dateKey
        data.dailyStreak = newStreak
        data.bestDailyStreak = newBest
        if !alreadyLogged {
            data.history.append(entry)
        }
        writeRolesDailyStreak(data)
        dailyStreak = newStreak
        bestDailyStreak = newBest

        // Dual-save: also save to Supabase if authenticated
        GameResultService.shared.saveRolesResult(
            dateKey: dateKey,
            solved: screen == .solved,
            strikes: strikes,
            roundsUsed: roundsUsed,
            timeSecs: totalTime
        )
    }

    // MARK: - Formatting

    private func formatTime(_ seconds: Int) -> String {
        "\(seconds / 60):\(String(format: "%02d", seconds % 60))"
    }

    private func shareText() -> String {
        let won = screen == .solved
        let roundsUsed = min(MAX_ROUNDS, round + 1)
        var text = "\u{1F3AD} ROLES #\(puzzleNumber)\n"
        text += "\(won ? "\u{2705} Solved" : "\u{274C}") \u{00B7} Round \(roundsUsed)/\(MAX_ROUNDS)\n"
        text += "\u{23F1} \(formatTime(totalTime)) \u{00B7} \(strikes)/\(MAX_STRIKES) strikes"
        if dailyStreak > 1 {
            text += " \u{00B7} \u{1F525}\(dailyStreak)"
        }
        return text
    }
}

// MARK: - Start Screen

extension RolesGameView {
    private var startScreen: some View {
        ScrollView {
            VStack(spacing: 0) {
                Spacer().frame(height: 60)

                // Decorative dots
                HStack(spacing: 6) {
                    Circle().fill(Theme.Colors.amber).frame(width: 6, height: 6)
                    Circle().fill(Theme.Colors.amber.opacity(0.6)).frame(width: 6, height: 6)
                    Circle().fill(Theme.Colors.amber.opacity(0.3)).frame(width: 6, height: 6)
                }
                .padding(.bottom, 8)

                // MovieGames label
                HStack(spacing: 0) {
                    Text("Movie")
                        .foregroundStyle(Theme.Colors.amber.opacity(0.7))
                    Text("Games")
                        .foregroundStyle(Theme.Colors.zinc500)
                }
                .font(.system(size: 10, weight: .semibold))
                .tracking(3)
                .textCase(.uppercase)
                .padding(.bottom, 6)

                // Title
                Text("ROLES")
                    .font(.display(size: 48, weight: .heavy))
                    .foregroundStyle(Theme.Colors.zinc100)
                    .padding(.bottom, 2)

                // Subtitle
                Text("Daily Puzzle \u{00B7} #\(puzzleNumber)")
                    .font(.system(size: 10, weight: .medium))
                    .tracking(3)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.zinc600)
                    .padding(.bottom, 4)

                // Streak
                if dailyStreak > 0 {
                    Text("\u{1F525} \(dailyStreak) day streak")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Colors.amber)
                        .padding(.bottom, 20)
                } else {
                    Spacer().frame(height: 20)
                }

                // Instructions card
                VStack(alignment: .leading, spacing: 12) {
                    instructionText("Uncover the ", highlight: "Actor", suffix: " and ")
                    + Text("Character").foregroundColor(Theme.Colors.amber).bold()
                    + Text(" they played.").foregroundColor(Theme.Colors.zinc300)

                    HStack(spacing: 10) {
                        instructionIcon("\u{1F3AC}", bg: Theme.Colors.amber.opacity(0.15), border: Theme.Colors.amber.opacity(0.3))
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Role Call").font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.Colors.zinc200)
                            Text("effects auto-spin each round").font(.system(size: 12)).foregroundStyle(Theme.Colors.zinc500)
                        }
                    }

                    HStack(spacing: 10) {
                        instructionIcon("\u{2328}\u{FE0F}", bg: Theme.Colors.zinc800, border: Theme.Colors.zinc700.opacity(0.4))
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Guess or Solve").font(.system(size: 14, weight: .medium)).foregroundStyle(Theme.Colors.zinc200)
                            Text("before time runs out").font(.system(size: 12)).foregroundStyle(Theme.Colors.zinc500)
                        }
                    }

                    // Effects grid
                    VStack(alignment: .leading, spacing: 8) {
                        Text("ROLE CALL EFFECTS")
                            .font(.system(size: 9, weight: .medium))
                            .tracking(3)
                            .foregroundStyle(Theme.Colors.zinc500)

                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                effectLabel("\u{1F524} Letter Spin", good: true)
                                effectLabel("\u{2728} Double Spin", good: true)
                                effectLabel("\u{1F170}\u{FE0F} Vowel Spin", good: true)
                                effectLabel("\u{1F3AF} Double Guess", good: true)
                                effectLabel("\u{23F1}\u{FE0F} +4 Seconds", good: true)
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                effectLabel("\u{23ED}\u{FE0F} Lose a Turn", good: false)
                                effectLabel("\u{23F3} Half Time", good: false)
                                effectLabel("\u{1F512} Keyboard Lock", good: false)
                            }
                        }
                    }
                    .padding(12)
                    .background(Theme.Colors.zinc800.opacity(0.3))
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    // Game rules summary
                    HStack(spacing: 8) {
                        Text("\(MAX_ROUNDS) rounds").foregroundStyle(Theme.Colors.zinc400).bold()
                        Text("\u{00B7}").foregroundStyle(Theme.Colors.zinc600)
                        Text("\(BASE_TIME)s to guess").foregroundStyle(Theme.Colors.zinc400)
                        Text("\u{00B7}").foregroundStyle(Theme.Colors.zinc600)
                        Text("\(MAX_STRIKES) wrong = lock").foregroundStyle(Theme.Colors.zinc400)
                    }
                    .font(.system(size: 11))
                    .padding(.top, 4)
                }
                .padding(20)
                .background(Theme.Colors.zinc900.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Theme.Colors.zinc800.opacity(0.6), lineWidth: 1)
                )
                .padding(.horizontal, 24)
                .padding(.bottom, 24)

                // Start button
                Button(action: startGame) {
                    Text("START PUZZLE")
                        .font(.system(size: 14, weight: .bold))
                        .tracking(2)
                        .frame(maxWidth: 280)
                        .padding(.vertical, 16)
                        .background(Theme.Colors.amber)
                        .foregroundStyle(Theme.Colors.zinc950)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .shadow(color: Theme.Colors.amber.opacity(0.2), radius: 12, y: 4)

                Spacer().frame(height: 40)
            }
        }
    }

    @ViewBuilder
    private func instructionText(_ prefix: String, highlight: String = "", suffix: String = "") -> Text {
        if highlight.isEmpty {
            Text(prefix).foregroundColor(Theme.Colors.zinc300)
        } else {
            Text(prefix).foregroundColor(Theme.Colors.zinc300)
            + Text(highlight).foregroundColor(Theme.Colors.amber).bold()
            + Text(suffix).foregroundColor(Theme.Colors.zinc300)
        }
    }

    private func instructionIcon(_ icon: String, bg: Color, border: Color) -> some View {
        Text(icon)
            .font(.system(size: 12))
            .frame(width: 28, height: 28)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(border, lineWidth: 1))
    }

    private func effectLabel(_ text: String, good: Bool) -> some View {
        Text(text)
            .font(.system(size: 11))
            .foregroundStyle(good ? Theme.Colors.green.opacity(0.8) : Theme.Colors.red.opacity(0.8))
    }
}

// MARK: - Playing Screen

extension RolesGameView {
    private var playingScreen: some View {
        VStack(spacing: 0) {
            // Header
            headerBar
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 4)

            // Round progress bar
            roundProgressBar
                .padding(.horizontal, 16)

            // Round info text
            roundInfoText
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 4)

            // Letter board
            letterBoard
                .padding(.horizontal, 16)
                .padding(.bottom, 4)

            // Action zone (wheel, timer, solve prompt)
            actionZone
                .frame(maxHeight: .infinity)

            // Fanfare toast
            fanfareToast

            // Keyboard
            keyboardView
                .padding(.bottom, 4)
        }
    }

    private var headerBar: some View {
        HStack {
            HStack(spacing: 8) {
                Text("\u{1F3AD}")
                    .font(.system(size: 18))
                Text("ROLES")
                    .font(.display(size: 16))
                    .foregroundStyle(Theme.Colors.zinc100)
                Text("#\(puzzleNumber)")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Colors.zinc500)
            }
            Spacer()
            // Strikes
            HStack(spacing: 4) {
                ForEach(0..<MAX_STRIKES, id: \.self) { i in
                    Text("\u{2715}")
                        .font(.system(size: 14))
                        .foregroundStyle(i < strikes ? Theme.Colors.red : Theme.Colors.zinc800)
                }
            }
            if phase != .pickLetters && phase != .revealingPicks {
                Text(formatTime(totalTime))
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(Theme.Colors.zinc400)
                    .padding(.leading, 8)
            }
        }
    }

    private var roundProgressBar: some View {
        HStack(spacing: 3) {
            ForEach(0..<MAX_ROUNDS, id: \.self) { i in
                let isCounting = i == round && phase == .guessing && !solveMode && !lostTurn
                if isCounting {
                    // Animated countdown bar
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Theme.Colors.zinc800)
                            RoundedRectangle(cornerRadius: 2)
                                .fill(guessTimer <= 3 ? Theme.Colors.red : Theme.Colors.amber400)
                                .frame(width: geo.size.width * CGFloat(guessTimer) / CGFloat(guessTime))
                                .animation(.linear(duration: 1), value: guessTimer)
                        }
                    }
                    .frame(height: 6)
                } else {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(roundPipColor(i))
                        .frame(height: 6)
                }
            }
        }
    }

    private func roundPipColor(_ i: Int) -> Color {
        if lostRounds.contains(i) { return Theme.Colors.red.opacity(0.7) }
        if i < round { return Theme.Colors.amber400 }
        if i == round { return Theme.Colors.amber.opacity(0.5) }
        return Theme.Colors.zinc800
    }

    private var roundInfoText: some View {
        let turnsLeft = MAX_ROUNDS - round - 1
        return Group {
            if turnsLeft <= 0 {
                Text("Last round!")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Theme.Colors.red)
            } else if turnsLeft <= 2 {
                Text("\(turnsLeft + 1) rounds left")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Colors.amber.opacity(0.8))
            } else {
                Text("Round \(round + 1) of \(MAX_ROUNDS)")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Colors.zinc500)
            }
        }
    }

    // MARK: - Letter Board

    private var letterBoard: some View {
        VStack(spacing: 8) {
            // Actor row
            VStack(alignment: .leading, spacing: 4) {
                Text("ACTOR")
                    .font(.system(size: 9, weight: .medium))
                    .tracking(2)
                    .foregroundStyle(Theme.Colors.zinc400)
                if let p = puzzle {
                    tileRow(word: p.actor, wordKey: "actor")
                }
            }

            Rectangle()
                .fill(Theme.Colors.zinc700.opacity(0.3))
                .frame(height: 1)

            // Character row
            VStack(alignment: .leading, spacing: 4) {
                Text("CHARACTER")
                    .font(.system(size: 9, weight: .medium))
                    .tracking(2)
                    .foregroundStyle(Theme.Colors.zinc400)
                if let p = puzzle {
                    tileRow(word: p.character, wordKey: "character")
                }
            }
        }
        .padding(12)
        .background(Theme.Colors.zinc900.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Theme.Colors.zinc700.opacity(0.5), lineWidth: 1)
        )
        .offset(x: shakeBoard ? -8 : 0)
        .animation(shakeBoard ? .interpolatingSpring(stiffness: 600, damping: 8) : .default, value: shakeBoard)
    }

    private func tileRow(word: String, wordKey: String) -> some View {
        // Split into segments by spaces
        let segments = buildSegments(word)
        let blanks = blankPositions
        let cursorBlank: BlankPosition? = solveMode && solveCursor < blanks.count ? blanks[solveCursor] : nil

        return FlowLayout(spacing: 4) {
            ForEach(Array(segments.enumerated()), id: \.offset) { segIdx, segment in
                HStack(spacing: 3) {
                    ForEach(segment, id: \.index) { tile in
                        tileView(
                            ch: tile.ch,
                            index: tile.index,
                            wordKey: wordKey,
                            cursorBlank: cursorBlank
                        )
                    }
                }
            }
        }
    }

    private struct TileItem: Identifiable {
        let ch: Character
        let index: Int
        var id: Int { index }
    }

    private func buildSegments(_ word: String) -> [[TileItem]] {
        var segments: [[TileItem]] = []
        var current: [TileItem] = []
        for (i, ch) in word.enumerated() {
            if ch == " " {
                if !current.isEmpty { segments.append(current) }
                current = []
            } else {
                current.append(TileItem(ch: ch, index: i))
            }
        }
        if !current.isEmpty { segments.append(current) }
        return segments
    }

    @ViewBuilder
    private func tileView(ch: Character, index: Int, wordKey: String, cursorBlank: BlankPosition?) -> some View {
        let posKey = tileKey(wordKey, index)
        let normalizedCh = normalizeLetter(ch)
        let guessable = isGuessableChar(ch)
        let isBlink = tileBlinking == posKey
        let isPop = tilesPopping.contains(posKey)
        let isLit = tilesLit.contains(posKey)
        let show = !guessable || revealed.contains(normalizedCh) || isOver || isPop

        let solveVal = solveInputs[posKey]
        let isCursor = solveMode && cursorBlank?.word == wordKey && cursorBlank?.index == index
        let isSolveTyped = solveMode && solveVal != nil && !show

        let bgColor: Color
        let borderColor: Color
        let textColor: Color

        if isBlink {
            bgColor = Theme.Colors.amber.opacity(0.2)
            borderColor = Theme.Colors.amber400.opacity(0.6)
            textColor = Theme.Colors.amber400
        } else if isLit && !isPop {
            bgColor = Theme.Colors.amber.opacity(0.15)
            borderColor = Theme.Colors.amber400.opacity(0.4)
            textColor = Theme.Colors.amber400
        } else if isPop && !revealed.contains(normalizedCh) {
            bgColor = Theme.Colors.amber.opacity(0.3)
            borderColor = Theme.Colors.amber400.opacity(0.6)
            textColor = Color(hex: "fef3c7") // amber-100
        } else if show && screen == .solved {
            bgColor = Theme.Colors.green.opacity(0.15)
            borderColor = Theme.Colors.green.opacity(0.3)
            textColor = Color(hex: "a7f3d0") // emerald-200
        } else if show && screen == .failed {
            bgColor = Theme.Colors.red.opacity(0.1)
            borderColor = Theme.Colors.red.opacity(0.2)
            textColor = Theme.Colors.red.opacity(0.8)
        } else if show {
            bgColor = Theme.Colors.zinc800
            borderColor = Theme.Colors.zinc600.opacity(0.4)
            textColor = Theme.Colors.zinc100
        } else if isCursor {
            bgColor = Theme.Colors.amber.opacity(0.1)
            borderColor = Theme.Colors.amber400.opacity(0.6)
            textColor = Theme.Colors.zinc200
        } else if isSolveTyped {
            bgColor = Theme.Colors.zinc800.opacity(0.5)
            borderColor = Theme.Colors.zinc500.opacity(0.4)
            textColor = Theme.Colors.zinc200
        } else {
            bgColor = Theme.Colors.zinc800.opacity(0.5)
            borderColor = Theme.Colors.zinc600.opacity(0.3)
            textColor = .clear
        }

        let displayChar: String
        if show {
            displayChar = String(ch)
        } else if isSolveTyped, let val = solveVal {
            displayChar = String(val)
        } else {
            displayChar = ""
        }

        Text(displayChar)
            .font(.system(size: 15, weight: .bold, design: .monospaced))
            .foregroundStyle(textColor)
            .frame(width: 32, height: 38)
            .background(bgColor)
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(borderColor, lineWidth: isBlink || isCursor ? 2 : 1)
            )
            .scaleEffect(isPop ? 1.15 : 1.0)
            .animation(.easeOut(duration: 0.3), value: isPop)
            .onTapGesture {
                if solveMode && !show {
                    // Set cursor to this blank
                    if let idx = blankPositions.firstIndex(where: { $0.word == wordKey && $0.index == index }) {
                        solveCursor = idx
                    }
                }
            }
    }

    // MARK: - Action Zone

    private var actionZone: some View {
        VStack(spacing: 8) {
            if phase == .pickLetters || phase == .revealingPicks {
                pickLettersView
            } else if phase == .pickDouble {
                pickDoubleView
            } else if phase == .preRoll {
                preRollView
            } else if phase == .rolling || phase == .revealFlash || lostTurn {
                wheelView
            } else if solveMode {
                solvePanelView
            } else if phase == .guessing {
                guessingView
            }
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Pick Letters View

    private var pickLettersView: some View {
        VStack(spacing: 12) {
            Text(phase == .revealingPicks ? "Revealing..." : "Pick 3 Starting Letters")
                .font(.system(size: 14, weight: .bold))
                .tracking(2)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.amber)

            HStack(spacing: 12) {
                ForEach(0..<3, id: \.self) { i in
                    let letter = i < pickedLetters.count ? pickedLetters[i] : nil
                    let isHighlighted = phase == .revealingPicks && revealingIdx >= i

                    ZStack {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(isHighlighted ? Theme.Colors.amber.opacity(0.3) :
                                    (letter != nil ? Theme.Colors.zinc800 : Theme.Colors.zinc800.opacity(0.3)))
                            .frame(width: 48, height: 56)
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(
                                isHighlighted ? Theme.Colors.amber400.opacity(0.5) :
                                    (letter != nil ? Theme.Colors.zinc500.opacity(0.6) : Theme.Colors.zinc500.opacity(0.4)),
                                style: letter != nil || isHighlighted ? StrokeStyle(lineWidth: 2) : StrokeStyle(lineWidth: 2, dash: [6])
                            )
                            .frame(width: 48, height: 56)
                        if let l = letter {
                            Text(String(l))
                                .font(.system(size: 20, weight: .bold, design: .monospaced))
                                .foregroundStyle(isHighlighted ? Color(hex: "fde68a") : Theme.Colors.zinc200)
                        }
                    }
                    .scaleEffect(isHighlighted ? 1.1 : 1.0)
                    .animation(.easeInOut(duration: 0.3), value: isHighlighted)
                }
            }
        }
    }

    private var pickDoubleView: some View {
        VStack(spacing: 8) {
            Text("Pick \(2 - pickedLetters.count) Letter\(2 - pickedLetters.count != 1 ? "s" : "")")
                .font(.system(size: 16, weight: .bold))
                .tracking(2)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.amber)

            if !pickedLetters.isEmpty {
                Text("\(pickedLetters.map { String($0) }.joined(separator: ", ")) selected")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Colors.zinc400)
            }
        }
    }

    // MARK: - Pre-Roll View

    private var preRollView: some View {
        VStack(spacing: 12) {
            Button(action: handleSpin) {
                Text("Spin the Wheel")
                    .font(.system(size: 16, weight: .bold))
                    .tracking(1)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 14)
                    .background(Theme.Colors.amber)
                    .foregroundStyle(Theme.Colors.zinc950)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .shadow(color: Theme.Colors.amber.opacity(0.2), radius: 8, y: 2)
            .disabled(turnWarning != nil)
            .opacity(turnWarning != nil ? 0.45 : 1.0)
        }
    }

    // MARK: - Wheel View

    private var wheelView: some View {
        let isSpinning = phase == .rolling
        let n = CALL_SHEET.count
        let spinIdx = rollAnimIdx

        let topEff: WheelEffect? = isSpinning ? CALL_SHEET[(spinIdx + 1) % n] : nil
        let centerEff: WheelEffect? = isSpinning ? (spinIdx >= 0 ? CALL_SHEET[spinIdx] : nil) : rollResult
        let bottomEff: WheelEffect? = isSpinning ? CALL_SHEET[((spinIdx - 1) + n) % n] : nil
        let settled = !isSpinning && rollResult != nil

        let centerColor: Color = isSpinning ? Color(hex: "fde68a") :
            (settled ? (rollResult!.good ? Theme.Colors.green : Theme.Colors.red) : Theme.Colors.zinc300)

        let centerBgColor: Color = isSpinning ? Theme.Colors.amber.opacity(0.15) :
            (settled ? (rollResult!.good ? Theme.Colors.green.opacity(0.05) : Theme.Colors.red.opacity(0.05)) : .clear)

        let centerBorderColor: Color = isSpinning ? Theme.Colors.amber400.opacity(0.3) :
            (settled ? (rollResult!.good ? Theme.Colors.green.opacity(0.2) : Theme.Colors.red.opacity(0.2)) : .clear)

        return VStack(spacing: 8) {
            VStack(spacing: 0) {
                // Top row
                wheelRow(eff: topEff, isSpinning: isSpinning, dimmed: !isSpinning)

                Rectangle().fill(Theme.Colors.zinc800.opacity(0.5)).frame(height: 1)

                // Center row (highlighted)
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(centerEff?.label ?? "\u{00B7}  \u{00B7}  \u{00B7}")
                            .font(.system(size: 16, weight: .bold, design: .monospaced))
                            .tracking(2)
                            .textCase(.uppercase)
                            .foregroundStyle(centerColor)
                        if settled, let result = rollResult {
                            Text(result.desc)
                                .font(.system(size: 13))
                                .foregroundStyle(result.good ? Theme.Colors.green : Theme.Colors.red)
                        }
                    }
                    Spacer()
                    Text(centerEff?.icon ?? "")
                        .font(.system(size: 16))
                        .opacity(isSpinning ? 0.95 : (settled ? 0.9 : 0.35))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(centerBgColor)
                .overlay(
                    Rectangle().fill(centerBorderColor).frame(height: 1), alignment: .top
                )
                .overlay(
                    Rectangle().fill(centerBorderColor).frame(height: 1), alignment: .bottom
                )

                Rectangle().fill(Theme.Colors.zinc800.opacity(0.5)).frame(height: 1)

                // Bottom row
                wheelRow(eff: bottomEff, isSpinning: isSpinning, dimmed: !isSpinning)
            }
            .background(isSpinning ? Theme.Colors.zinc900.opacity(0.7) : Theme.Colors.zinc900.opacity(0.4))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSpinning ? Theme.Colors.zinc600.opacity(0.7) : Theme.Colors.zinc700.opacity(0.5), lineWidth: 1)
            )
            .frame(maxWidth: 280)

            if lostTurn {
                Text("\u{23ED}\u{FE0F} Turn lost \u{2014} moving on...")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Colors.red)
            }
        }
    }

    private func wheelRow(eff: WheelEffect?, isSpinning: Bool, dimmed: Bool) -> some View {
        HStack {
            Text(eff?.label ?? "\u{2014}")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .tracking(2)
                .textCase(.uppercase)
                .foregroundStyle(isSpinning ? Theme.Colors.zinc300 : Theme.Colors.zinc500)
            Spacer()
            Text(eff?.icon ?? "")
                .font(.system(size: 12))
                .opacity(isSpinning ? 0.85 : 0.6)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .opacity(dimmed ? 0.55 : (isSpinning ? 0.8 : 1.0))
    }

    // MARK: - Guessing View

    private var guessingView: some View {
        let urgent = guessTimer <= 3
        let mustUseLetterGuesses = guessesThisRound > 1 && guessesRemaining > 0
        let canPressSolve = solveAttempts > 0 && !mustUseLetterGuesses && !guessResolving && guessTimer > 0

        return VStack(spacing: 6) {
            Text("\(guessTimer)s")
                .font(.system(size: 16, weight: .bold, design: .monospaced))
                .foregroundStyle(urgent ? Theme.Colors.red : Theme.Colors.zinc500)

            HStack(spacing: 8) {
                if !kbLocked {
                    Text(mustUseLetterGuesses
                         ? "Guess \(guessesRemaining > 1 ? "\(guessesRemaining) letters" : "a letter")"
                         : "Guess \(guessesRemaining > 1 ? "\(guessesRemaining) letters" : "a letter") or")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Colors.zinc300)
                } else {
                    Text("Keyboard locked \u{2014}")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Colors.zinc400)
                }

                Button(action: enterSolveMode) {
                    Text("Solve\(solveAttempts < 2 ? " (\(solveAttempts))" : "")")
                        .font(.system(size: 12, weight: .bold))
                        .tracking(1)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 6)
                        .background(canPressSolve
                                    ? Theme.Colors.green.opacity(0.1)
                                    : Theme.Colors.zinc800.opacity(0.3))
                        .foregroundStyle(canPressSolve
                                         ? Theme.Colors.green
                                         : Theme.Colors.zinc700)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(canPressSolve
                                        ? Theme.Colors.green.opacity(0.3)
                                        : Theme.Colors.zinc800.opacity(0.3), lineWidth: 1)
                        )
                }
                .disabled(!canPressSolve)
            }
        }
    }

    // MARK: - Solve Panel

    private var solvePanelView: some View {
        let strikesLeft = max(0, MAX_STRIKES - strikes)

        return VStack(spacing: 8) {
            if finalSolveMode {
                Text("SOLVE OR LOSE")
                    .font(.system(size: 14, weight: .bold))
                    .tracking(2)
                    .foregroundStyle(Theme.Colors.red.opacity(0.9))
                Text("Rounds over. Fill in blanks and submit. \(strikesLeft) strike\(strikesLeft == 1 ? "" : "s") left")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Colors.zinc300)
                    .multilineTextAlignment(.center)
            } else {
                HStack(spacing: 12) {
                    Button(action: cancelSolve) {
                        Text("\u{2190} Back")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.Colors.zinc500)
                    }
                    Text("Tap blanks to fill, then submit \u{00B7} \(solveAttempts) left")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Colors.zinc400)
                }
            }
        }
    }

    // MARK: - Fanfare Toast

    @ViewBuilder
    private var fanfareToast: some View {
        if let egg = fanfareEasterEgg {
            Text(egg)
                .font(.system(size: 18, weight: .bold).italic())
                .foregroundStyle(Theme.Colors.red)
                .shadow(color: Theme.Colors.red.opacity(0.7), radius: 12)
                .padding(.bottom, 4)
                .transition(.move(edge: .bottom).combined(with: .opacity))
        } else if let letter = fanfareLetter {
            let countText = fanfareCount == 1 ? "is" : "are"
            Text("There \(countText) \(fanfareCount) \(letter)\(fanfareCount > 1 ? "\u{2019}s" : "")!")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Colors.green)
                .shadow(color: .black.opacity(0.5), radius: 4)
                .padding(.bottom, 4)
                .transition(.move(edge: .bottom).combined(with: .opacity))
        } else if let guess = lastGuess, !guess.correct {
            Text(guess.fromSpin
                 ? "No \u{201C}\(String(guess.letter))\u{201D} in puzzle"
                 : "\u{201C}\(String(guess.letter))\u{201D} \u{2014} strike!")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Colors.red)
                .shadow(color: .black.opacity(0.5), radius: 4)
                .padding(.bottom, 4)
                .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    // MARK: - Keyboard

    private var keyboardView: some View {
        let kbRows: [[Character]] = [
            ["Q","W","E","R","T","Y","U","I","O","P"],
            ["A","S","D","F","G","H","J","K","L"],
            ["Z","X","C","V","B","N","M"],
        ]

        let allSolveFilled = blankPositions.allSatisfy { solveInputs[tileKey($0.word, $0.index)] != nil }

        let keyboardActive = phase == .guessing || solveMode || phase == .pickLetters || phase == .pickDouble
        let keyboardDimmed = phase == .rolling || phase == .revealFlash || phase == .preRoll || phase == .roundEnding || lostTurn || guessResolving || (fanfareLetter != nil && phase != .guessing) || (kbLocked && !solveMode)

        return VStack(spacing: 4) {
            ForEach(0..<kbRows.count, id: \.self) { ri in
                HStack(spacing: 3) {
                    // ENTER key on left of bottom row
                    if ri == 2 {
                        Button(action: {
                            if solveMode { handleSolveSubmit() }
                        }) {
                            Text("ENTER")
                                .font(.system(size: 9, weight: .bold))
                                .tracking(1)
                                .frame(maxWidth: .infinity)
                                .frame(height: 48)
                                .background(solveMode && allSolveFilled
                                            ? Theme.Colors.green.opacity(0.2)
                                            : Theme.Colors.zinc800.opacity(0.3))
                                .foregroundStyle(solveMode && allSolveFilled
                                                 ? Theme.Colors.green
                                                 : Theme.Colors.zinc600)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(solveMode && allSolveFilled
                                                ? Theme.Colors.green.opacity(0.3)
                                                : Theme.Colors.zinc800.opacity(0.3), lineWidth: 1)
                                )
                        }
                        .frame(maxWidth: .infinity)
                        .disabled(!solveMode || !allSolveFilled)
                    }

                    ForEach(kbRows[ri], id: \.self) { letter in
                        keyButton(letter: letter)
                    }

                    // DELETE key on right of bottom row
                    if ri == 2 {
                        Button(action: {
                            if solveMode { handleSolveBackspace() }
                            else if phase == .pickLetters || phase == .pickDouble { handlePickBackspace() }
                        }) {
                            Text("\u{232B}")
                                .font(.system(size: 14, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .frame(height: 48)
                                .background((solveMode || ((phase == .pickLetters || phase == .pickDouble) && !pickedLetters.isEmpty))
                                            ? Theme.Colors.zinc700.opacity(0.6)
                                            : Theme.Colors.zinc800.opacity(0.3))
                                .foregroundStyle((solveMode || ((phase == .pickLetters || phase == .pickDouble) && !pickedLetters.isEmpty))
                                                 ? Theme.Colors.zinc300
                                                 : Theme.Colors.zinc600)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Theme.Colors.zinc600.opacity(0.4), lineWidth: 1)
                                )
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .padding(.horizontal, 6)
        .opacity(keyboardDimmed ? 0.2 : 1.0)
        .disabled(!keyboardActive || keyboardDimmed)
        .animation(.easeInOut(duration: 0.3), value: keyboardDimmed)
    }

    @ViewBuilder
    private func keyButton(letter: Character) -> some View {
        let isRev = revealed.contains(letter)
        let isWrong = wrongGuesses.contains(letter)
        let isPicking = phase == .pickLetters || phase == .pickDouble
        let isPicked = isPicking && pickedLetters.contains(letter)

        var canTap = false
        if isPicking {
            canTap = !isPicked && !(phase == .pickDouble && (guessedLetters.contains(letter) || revealed.contains(letter)))
        } else if solveMode {
            canTap = true
        } else if phase == .guessing && !kbLocked && !guessResolving && guessTimer > 0 {
            canTap = !isRev && !isWrong
        }

        let bgColor: Color
        let textColor: Color
        let borderColor: Color

        if isPicking {
            if isPicked {
                bgColor = Theme.Colors.amber.opacity(0.2)
                textColor = Color(hex: "fcd34d") // amber-300
                borderColor = Theme.Colors.amber.opacity(0.3)
            } else if canTap {
                bgColor = Theme.Colors.zinc700.opacity(0.6)
                textColor = Theme.Colors.zinc100
                borderColor = Theme.Colors.zinc600.opacity(0.4)
            } else {
                bgColor = Theme.Colors.zinc800.opacity(0.4)
                textColor = Theme.Colors.zinc600
                borderColor = Theme.Colors.zinc800.opacity(0.3)
            }
        } else if solveMode {
            bgColor = Theme.Colors.zinc700.opacity(0.6)
            textColor = Theme.Colors.zinc100
            borderColor = Theme.Colors.zinc600.opacity(0.4)
        } else if isRev {
            bgColor = Theme.Colors.green.opacity(0.15)
            textColor = Theme.Colors.green.opacity(0.8)
            borderColor = Theme.Colors.green.opacity(0.2)
        } else if isWrong {
            bgColor = Theme.Colors.red.opacity(0.1)
            textColor = Theme.Colors.red.opacity(0.4)
            borderColor = Theme.Colors.red.opacity(0.15)
        } else if canTap {
            bgColor = Theme.Colors.zinc700.opacity(0.6)
            textColor = Theme.Colors.zinc100
            borderColor = Theme.Colors.zinc600.opacity(0.4)
        } else {
            bgColor = Theme.Colors.zinc800.opacity(0.4)
            textColor = Theme.Colors.zinc600
            borderColor = Theme.Colors.zinc800.opacity(0.3)
        }

        Button(action: {
            guard canTap else { return }
            if isPicking { handlePickLetter(letter) }
            else { handleLetter(letter) }
        }) {
            Text(String(letter))
                .font(.system(size: 14, weight: .bold))
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(bgColor)
                .foregroundStyle(textColor)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(borderColor, lineWidth: 1)
                )
        }
        .disabled(!canTap)
    }
}

// MARK: - Results Screen

extension RolesGameView {
    private func resultsScreen(won: Bool) -> some View {
        ScrollView {
            VStack(spacing: 0) {
                Spacer().frame(height: 40)

                // Header
                HStack {
                    HStack(spacing: 8) {
                        Text("\u{1F3AD}")
                            .font(.system(size: 20))
                        Text("ROLES")
                            .font(.display(size: 20))
                            .foregroundStyle(Theme.Colors.zinc100)
                    }
                    Spacer()
                    HStack(spacing: 8) {
                        Text(won ? "Solved" : "Not this time")
                            .font(.display(size: 18))
                            .foregroundStyle(won ? Theme.Colors.green : Theme.Colors.zinc400)
                        Text("#\(puzzleNumber)")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.Colors.zinc500)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 16)

                // Letter board (final state)
                if let p = puzzle {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("ACTOR")
                            .font(.system(size: 9, weight: .medium))
                            .tracking(2)
                            .foregroundStyle(Theme.Colors.zinc500)
                        resultsTileRow(word: p.actor, wordKey: "actor")

                        Rectangle()
                            .fill(Theme.Colors.zinc800.opacity(0.3))
                            .frame(height: 1)

                        Text("CHARACTER")
                            .font(.system(size: 9, weight: .medium))
                            .tracking(2)
                            .foregroundStyle(Theme.Colors.zinc500)
                        resultsTileRow(word: p.character, wordKey: "character")

                        Rectangle()
                            .fill(Theme.Colors.zinc800.opacity(0.4))
                            .frame(height: 1)
                            .padding(.top, 4)

                        Text("\(p.movie) (\(p.year))")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.Colors.zinc500)
                    }
                    .padding(12)
                    .background(Theme.Colors.zinc900.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Theme.Colors.zinc800.opacity(0.5), lineWidth: 1)
                    )
                    .padding(.horizontal, 24)
                    .padding(.bottom, 16)
                }

                // Stats grid
                let roundsUsed = min(MAX_ROUNDS, round + 1)
                HStack(spacing: 12) {
                    statCard(value: formatTime(totalTime), label: "TIME")
                    statCard(value: "\(roundsUsed)/\(MAX_ROUNDS)", label: "ROUNDS")
                    statCard(value: "\(strikes)/\(MAX_STRIKES)", label: "STRIKES")
                    statCard(value: "\(dailyStreak)\u{1F525}", label: "STREAK", valueColor: Theme.Colors.amber)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 20)

                // Buttons
                HStack(spacing: 12) {
                    Button(action: startGame) {
                        Text("Play Again")
                            .font(.system(size: 14, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Theme.Colors.amber)
                            .foregroundStyle(Theme.Colors.zinc950)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .shadow(color: Theme.Colors.amber.opacity(0.2), radius: 8, y: 2)

                    ShareLink(item: shareText()) {
                        Text("Share")
                            .font(.system(size: 14, weight: .medium))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Theme.Colors.zinc800.opacity(0.6))
                            .foregroundStyle(Theme.Colors.zinc300)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Theme.Colors.zinc700.opacity(0.4), lineWidth: 1)
                            )
                    }
                }
                .padding(.horizontal, 24)

                Spacer().frame(height: 40)
            }
        }
    }

    private func resultsTileRow(word: String, wordKey: String) -> some View {
        let segments = buildSegments(word)
        return FlowLayout(spacing: 4) {
            ForEach(Array(segments.enumerated()), id: \.offset) { _, segment in
                HStack(spacing: 3) {
                    ForEach(segment, id: \.index) { tile in
                        let ch = tile.ch
                        let guessable = isGuessableChar(ch)
                        let bgColor = screen == .solved
                            ? Theme.Colors.green.opacity(0.15)
                            : Theme.Colors.red.opacity(0.1)
                        let textColor: Color = screen == .solved
                            ? Color(hex: "a7f3d0")
                            : Theme.Colors.red.opacity(0.8)
                        let borderColor = screen == .solved
                            ? Theme.Colors.green.opacity(0.3)
                            : Theme.Colors.red.opacity(0.2)

                        Text(guessable ? String(ch) : String(ch))
                            .font(.system(size: 15, weight: .bold, design: .monospaced))
                            .foregroundStyle(guessable ? textColor : Theme.Colors.zinc100)
                            .frame(width: 32, height: 38)
                            .background(guessable ? bgColor : Theme.Colors.zinc800)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                            .overlay(
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(guessable ? borderColor : Theme.Colors.zinc600.opacity(0.4), lineWidth: 1)
                            )
                    }
                }
            }
        }
    }

    private func statCard(value: String, label: String, valueColor: Color = Theme.Colors.zinc100) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(valueColor)
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .tracking(2)
                .foregroundStyle(Theme.Colors.zinc500)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Theme.Colors.zinc900.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Theme.Colors.zinc800.opacity(0.5), lineWidth: 1)
        )
    }
}

// MARK: - Popups

extension RolesGameView {
    private func alreadyPlayedPopup(entry: RolesHistoryEntry) -> some View {
        ZStack {
            Color.black.opacity(0.8)
                .ignoresSafeArea()
                .onTapGesture { showAlreadyPlayedPopup = false }

            VStack(spacing: 0) {
                VStack(spacing: 12) {
                    HStack(spacing: 8) {
                        Text("\u{1F3AD}")
                            .font(.system(size: 20))
                        Text("ROLES")
                            .font(.display(size: 20))
                            .foregroundStyle(Theme.Colors.zinc100)
                        Text("#\(puzzleNumber)")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.Colors.zinc600)
                    }

                    Text("\(entry.solved ? "Solved" : "Not this time") \u{00B7} Today\u{2019}s puzzle complete")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(entry.solved ? Theme.Colors.green : Theme.Colors.red.opacity(0.8))

                    HStack(spacing: 8) {
                        miniStat(value: formatTime(entry.timeSecs), label: "Time")
                        miniStat(value: "\(entry.strikes)/\(MAX_STRIKES)", label: "Strikes")
                        miniStat(value: "\(dailyStreak)", label: "Streak", icon: "\u{1F525}", valueColor: Theme.Colors.amber)
                    }
                    .padding(.vertical, 4)

                    HStack(spacing: 12) {
                        Button {
                            showAlreadyPlayedPopup = false
                            startGame()
                        } label: {
                            Text("Play Again")
                                .font(.system(size: 14, weight: .bold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(Theme.Colors.amber)
                                .foregroundStyle(Theme.Colors.zinc950)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .shadow(color: Theme.Colors.amber.opacity(0.2), radius: 8, y: 2)

                        Button {
                            showAlreadyPlayedPopup = false
                        } label: {
                            Text("Dismiss")
                                .font(.system(size: 14, weight: .medium))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(Theme.Colors.zinc800.opacity(0.6))
                                .foregroundStyle(Theme.Colors.zinc300)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(Theme.Colors.zinc700.opacity(0.4), lineWidth: 1)
                                )
                        }
                    }
                }
                .padding(24)
            }
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(
                        RadialGradient(
                            colors: [Color(hex: "1c1917"), Color(hex: "0a0a0b")],
                            center: .top,
                            startRadius: 0,
                            endRadius: 300
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Theme.Colors.zinc800.opacity(0.6), lineWidth: 1)
            )
            .padding(.horizontal, 32)
        }
    }

    private func miniStat(value: String, label: String, icon: String = "", valueColor: Color = Theme.Colors.zinc100) -> some View {
        VStack(spacing: 2) {
            Text("\(value)\(icon)")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(valueColor)
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .tracking(2)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.zinc500)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(Theme.Colors.zinc900.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Theme.Colors.zinc800.opacity(0.5), lineWidth: 1)
        )
    }

    private func turnWarningOverlay(_ warning: String) -> some View {
        ZStack {
            let isLockout = warning.lowercased().contains("locked")
            VStack(spacing: 4) {
                Text(warning)
                    .font(.display(size: 20))
                    .foregroundStyle(isLockout ? Theme.Colors.red : Theme.Colors.amber)
                Text(isLockout ? "moving on..." : "keep going!")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Colors.zinc500)
            }
            .padding(.horizontal, 32)
            .padding(.vertical, 16)
            .background(Theme.Colors.zinc900.opacity(0.95))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isLockout ? Theme.Colors.red.opacity(0.4) : Theme.Colors.amber.opacity(0.4), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.5), radius: 20)
        }
        .allowsHitTesting(false)
    }
}

// MARK: - FlowLayout (for wrapping tile segments)

struct FlowLayout: Layout {
    var spacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > width && x > 0 {
                y += rowHeight + spacing
                x = 0
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }

        return CGSize(width: width, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX {
                y += rowHeight + spacing
                x = bounds.minX
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
