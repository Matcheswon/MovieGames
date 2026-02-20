import SwiftUI

// MARK: - Types

enum ThumbsScreen {
    case start
    case playing
    case results
}

enum ThumbResult {
    case correct
    case wrong
}

struct ScoreEntry {
    let siskelOk: Bool
    let ebertOk: Bool
}

struct ThumbsHistoryEntry: Codable {
    let dateKey: String
    let score: Int
    let outOf: Int
    let timeSecs: Int
}

struct DailyStreakData: Codable {
    var lastPlayedDate: String?
    var dailyStreak: Int
    var bestDailyStreak: Int
    var history: [ThumbsHistoryEntry]

    static let empty = DailyStreakData(lastPlayedDate: nil, dailyStreak: 0, bestDailyStreak: 0, history: [])
}

// MARK: - Local Storage

private let dailyStorageKey = "moviegames:thumbwars:daily"

private func readDailyStreak() -> DailyStreakData {
    guard let data = UserDefaults.standard.data(forKey: dailyStorageKey),
          let decoded = try? JSONDecoder().decode(DailyStreakData.self, from: data) else {
        return .empty
    }
    return decoded
}

private func writeDailyStreak(_ data: DailyStreakData) {
    if let encoded = try? JSONEncoder().encode(data) {
        UserDefaults.standard.set(encoded, forKey: dailyStorageKey)
    }
}

private func isYesterday(_ dateStr: String, relativeTo todayStr: String) -> Bool {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.timeZone = TimeZone(identifier: "UTC")
    guard let d = formatter.date(from: dateStr) else { return false }
    let next = Calendar.current.date(byAdding: .day, value: 1, to: d)!
    return formatter.string(from: next) == todayStr
}

// MARK: - Movie Data (with TMDB enrichment)

struct ThumbsMovie: Identifiable {
    let id: String
    let title: String
    let year: Int
    let director: String
    let siskel: Int  // 0 = down, 1 = up
    let ebert: Int   // 0 = down, 1 = up
    let tmdbId: Int?
    var posterURL: String?
    var overview: String?
}

// MARK: - ThumbsGameView

struct ThumbsGameView: View {
    @EnvironmentObject private var puzzleManager: PuzzleManager

    @State private var screen: ThumbsScreen = .start
    @State private var movies: [ThumbsMovie] = []
    @State private var index = 0
    @State private var siskelPick: Int? = nil  // 0 or 1
    @State private var ebertPick: Int? = nil   // 0 or 1
    @State private var revealed = false
    @State private var scores: [ScoreEntry] = []
    @State private var timer = 0
    @State private var timerTask: Task<Void, Never>?
    @State private var dailyStreak = 0
    @State private var bestDailyStreak = 0
    @State private var alreadyPlayed: ThumbsHistoryEntry? = nil
    @State private var showOverview = false
    @State private var dailyRecorded = false
    @State private var showAlreadyPlayedPopup = false

    private var dateKey: String { puzzleManager.currentDateKey }
    private var puzzleNumber: Int { puzzleManager.thumbsResult?.puzzleNumber ?? 0 }
    private var roundSize: Int { movies.count }

    private var movie: ThumbsMovie? { index < movies.count ? movies[index] : nil }
    private var totalCorrect: Int { scores.reduce(0) { $0 + ($1.siskelOk ? 1 : 0) + ($1.ebertOk ? 1 : 0) } }
    private var totalPossible: Int { scores.count * 2 }
    private var perfectRounds: Int { scores.filter { $0.siskelOk && $0.ebertOk }.count }

    var body: some View {
        ZStack {
            Theme.cinematicBackground

            switch screen {
            case .start:
                startScreen
            case .playing:
                playingScreen
            case .results:
                resultsScreen
            }

            if showAlreadyPlayedPopup, let entry = alreadyPlayed {
                alreadyPlayedPopup(entry: entry)
            }

            if showOverview, let movie = movie, let overview = movie.overview {
                overviewPopup(movie: movie, overview: overview)
            }
        }
        .onAppear(perform: loadDailyData)
    }

    // MARK: - Load Daily Data

    private func loadDailyData() {
        let data = readDailyStreak()
        if let last = data.lastPlayedDate {
            if last == dateKey || isYesterday(last, relativeTo: dateKey) {
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
        guard let result = puzzleManager.thumbsResult else { return }

        // Build movies from daily result
        movies = result.movies.map { entry in
            ThumbsMovie(
                id: entry.id,
                title: entry.title,
                year: entry.year,
                director: entry.director,
                siskel: entry.siskel_thumb,
                ebert: entry.ebert_thumb,
                tmdbId: entry.tmdb_id
            )
        }

        index = 0
        scores = []
        siskelPick = nil
        ebertPick = nil
        revealed = false
        timer = 0
        dailyRecorded = false
        showOverview = false
        showAlreadyPlayedPopup = false
        screen = .playing

        // Fetch TMDB data for all movies
        Task {
            await fetchAllPosters()
        }

        // Start timer
        startTimer()
    }

    private func fetchAllPosters() async {
        let service = TMDBService.shared
        for i in 0..<movies.count {
            let m = movies[i]
            let data = await service.fetchMovieData(tmdbId: m.tmdbId, title: m.title, year: m.year)
            movies[i].posterURL = data.posterURL
            movies[i].overview = data.overview
        }
    }

    private func startTimer() {
        timerTask?.cancel()
        timerTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if !Task.isCancelled {
                    timer += 1
                }
            }
        }
    }

    // MARK: - Reveal & Advance

    private func handleReveal() {
        guard let movie = movie else { return }
        let siskelOk = siskelPick == movie.siskel
        let ebertOk = ebertPick == movie.ebert
        scores.append(ScoreEntry(siskelOk: siskelOk, ebertOk: ebertOk))
        revealed = true

        // Advance after 1200ms
        Task {
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            await MainActor.run {
                if index + 1 >= roundSize {
                    timerTask?.cancel()
                    screen = .results
                    recordDailyResult()
                } else {
                    index += 1
                    siskelPick = nil
                    ebertPick = nil
                    revealed = false
                    showOverview = false
                }
            }
        }
    }

    private func recordDailyResult() {
        guard !dailyRecorded else { return }
        dailyRecorded = true

        var data = readDailyStreak()
        if data.lastPlayedDate == dateKey {
            dailyStreak = data.dailyStreak
            bestDailyStreak = data.bestDailyStreak
            return
        }

        let newStreak: Int
        if let last = data.lastPlayedDate, isYesterday(last, relativeTo: dateKey) {
            newStreak = data.dailyStreak + 1
        } else {
            newStreak = 1
        }
        let newBest = max(newStreak, data.bestDailyStreak)

        let entry = ThumbsHistoryEntry(
            dateKey: dateKey,
            score: totalCorrect,
            outOf: totalPossible,
            timeSecs: timer
        )
        let alreadyLogged = data.history.contains(where: { $0.dateKey == dateKey })
        data.lastPlayedDate = dateKey
        data.dailyStreak = newStreak
        data.bestDailyStreak = newBest
        if !alreadyLogged {
            data.history.append(entry)
        }
        writeDailyStreak(data)
        dailyStreak = newStreak
        bestDailyStreak = newBest
    }

    // MARK: - Formatting

    private func formatTime(_ seconds: Int) -> String {
        "\(seconds / 60):\(String(format: "%02d", seconds % 60))"
    }

    private func gradeInfo() -> (grade: String, color: Color, flavorText: String) {
        let pct = totalPossible > 0 ? Double(totalCorrect) / Double(totalPossible) * 100 : 0
        if pct >= 90 { return ("S", Theme.Colors.amber400, "You belong in the balcony.") }
        if pct >= 75 { return ("A", Theme.Colors.green, "Two thumbs up for you.") }
        if pct >= 60 { return ("B", Color(hex: "93c5fd"), "Not bad \u{2014} you know your critics.") }
        if pct >= 40 { return ("C", Theme.Colors.zinc300, "Ebert would be gentle. Siskel\u{2026} less so.") }
        return ("D", Theme.Colors.red, "Maybe stick to reading the reviews.")
    }

    private func shareText() -> String {
        let pips = scores.map { s in
            s.siskelOk && s.ebertOk ? "\u{1F7E9}" : (s.siskelOk || s.ebertOk ? "\u{1F7E8}" : "\u{1F7E5}")
        }.joined()
        var text = "\u{1F3AC} MovieGames THUMBS \u{00B7} \(dateKey)\n"
        text += pips + "\n"
        text += "\(totalCorrect)/\(totalPossible) \u{00B7} \(formatTime(timer)) \u{00B7} \(perfectRounds) perfect rounds"
        if dailyStreak > 1 {
            text += " \u{00B7} \u{1F525}\(dailyStreak)"
        }
        return text
    }

    // MARK: - Score Pip Status

    private func pipStatus(at i: Int) -> String {
        if i < scores.count {
            let s = scores[i]
            if s.siskelOk && s.ebertOk { return "perfect" }
            if s.siskelOk || s.ebertOk { return "half" }
            return "miss"
        }
        if i == index { return "current" }
        return "upcoming"
    }

    private func pipColor(status: String) -> Color {
        switch status {
        case "perfect": return Theme.Colors.green
        case "half": return Theme.Colors.amber
        case "miss": return Theme.Colors.red.opacity(0.6)
        case "current": return Theme.Colors.zinc500
        default: return Theme.Colors.zinc800
        }
    }
}

// MARK: - Start Screen

extension ThumbsGameView {
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
                Text("THUMBS")
                    .font(.display(size: 48, weight: .heavy))
                    .foregroundStyle(Theme.Colors.zinc100)
                    .padding(.bottom, 2)

                // Subtitle
                Text("Daily Challenge \u{00B7} #\(puzzleNumber)")
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
                    instructionText("You'll see ", highlight: "\(roundSize) movies", suffix: " that Siskel & Ebert reviewed.")
                    instructionText("For each movie, guess: did each critic give it a \u{1F44D} or a \u{1F44E}?")
                    Text("Pick both thumbs and the round auto-advances. Go fast \u{2014} your time is tracked.")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.Colors.zinc400)
                }
                .padding(20)
                .background(Theme.Colors.zinc900.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Theme.Colors.zinc800.opacity(0.6), lineWidth: 1)
                )
                .padding(.horizontal, 24)
                .padding(.bottom, 20)

                // Color legend
                HStack(spacing: 16) {
                    legendItem(color: Theme.Colors.green, label: "Both right")
                    legendItem(color: Theme.Colors.amber, label: "One right")
                    legendItem(color: Theme.Colors.red.opacity(0.6), label: "Both wrong")
                }
                .padding(.bottom, 24)

                // Start button
                Button(action: startGame) {
                    Text("START ROUND")
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

    private func instructionText(_ prefix: String, highlight: String = "", suffix: String = "") -> some View {
        Group {
            if highlight.isEmpty {
                Text(prefix)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Colors.zinc300)
            } else {
                (Text(prefix).foregroundColor(Theme.Colors.zinc300) +
                 Text(highlight).foregroundColor(Theme.Colors.amber).bold() +
                 Text(suffix).foregroundColor(Theme.Colors.zinc300))
                    .font(.system(size: 14))
            }
        }
    }

    private func legendItem(color: Color, label: String) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(Theme.Colors.zinc600)
        }
    }
}

// MARK: - Playing Screen

extension ThumbsGameView {
    private var playingScreen: some View {
        VStack(spacing: 0) {
            // Top bar
            topBar
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 4)

            // Progress bar
            progressBar
                .padding(.horizontal, 16)

            // Round info
            HStack {
                HStack(spacing: 0) {
                    Text("\(index + 1)")
                        .foregroundStyle(Theme.Colors.amber)
                        .fontWeight(.bold)
                    Text(" of \(roundSize)")
                        .foregroundStyle(Theme.Colors.zinc600)
                }
                Spacer()
                Text("\(totalCorrect) correct")
                    .foregroundStyle(Theme.Colors.zinc600)
            }
            .font(.system(size: 12))
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .padding(.bottom, 4)

            // Poster
            if let movie = movie {
                posterView(movie: movie)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)

                // Critic rows
                VStack(spacing: 12) {
                    criticRow(
                        name: "Siskel",
                        initials: "GS",
                        pick: siskelPick,
                        setPick: { if !revealed { siskelPick = $0; checkAutoReveal() } },
                        result: siskelResult,
                        actualThumb: movie.siskel
                    )
                    criticRow(
                        name: "Ebert",
                        initials: "RE",
                        pick: ebertPick,
                        setPick: { if !revealed { ebertPick = $0; checkAutoReveal() } },
                        result: ebertResult,
                        actualThumb: movie.ebert
                    )
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
        }
    }

    private var topBar: some View {
        HStack {
            HStack(spacing: 8) {
                Text("\u{1F44D}")
                    .font(.system(size: 18))
                Text("THUMBS")
                    .font(.display(size: 16))
                    .foregroundStyle(Theme.Colors.zinc100)
            }
            Spacer()
            Text(formatTime(timer))
                .font(.system(size: 12, design: .monospaced))
                .foregroundStyle(Theme.Colors.zinc500)
        }
    }

    private var progressBar: some View {
        HStack(spacing: 3) {
            ForEach(0..<roundSize, id: \.self) { i in
                RoundedRectangle(cornerRadius: 2)
                    .fill(pipColor(status: pipStatus(at: i)))
                    .frame(height: 4)
            }
        }
    }

    private func posterView(movie: ThumbsMovie) -> some View {
        GeometryReader { geo in
            let borderColor: Color = revealed
                ? (siskelResult == .correct && ebertResult == .correct
                    ? Theme.Colors.green.opacity(0.4)
                    : Theme.Colors.red.opacity(0.3))
                : Theme.Colors.zinc800.opacity(0.6)

            ZStack(alignment: .bottom) {
                // Poster image
                if let posterURL = movie.posterURL, let url = URL(string: posterURL) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: geo.size.width, height: geo.size.height)
                                .clipped()
                        case .failure:
                            posterPlaceholder(title: movie.title)
                        case .empty:
                            shimmerPlaceholder()
                        @unknown default:
                            shimmerPlaceholder()
                        }
                    }
                } else {
                    posterPlaceholder(title: movie.title)
                }

                // Gradient overlay with movie info
                VStack(alignment: .leading, spacing: 2) {
                    Text(movie.title)
                        .font(.display(size: 22))
                        .foregroundStyle(Theme.Colors.zinc100)
                        .lineLimit(2)

                    HStack(spacing: 6) {
                        Text("\(movie.year)")
                            .foregroundStyle(Theme.Colors.zinc400)
                        Text("\u{00B7}")
                            .foregroundStyle(Theme.Colors.zinc600)
                        Text(movie.director)
                            .foregroundStyle(Theme.Colors.zinc400)
                    }
                    .font(.system(size: 14))

                    if movie.overview != nil {
                        Button {
                            showOverview = true
                        } label: {
                            HStack(alignment: .firstTextBaseline, spacing: 4) {
                                Text(movie.overview ?? "")
                                    .font(.system(size: 14))
                                    .foregroundStyle(Theme.Colors.zinc500)
                                    .lineLimit(1)
                                Text("More")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundStyle(Theme.Colors.amber.opacity(0.7))
                            }
                        }
                        .padding(.top, 2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(
                    LinearGradient(
                        colors: [Theme.Colors.zinc950, Theme.Colors.zinc950.opacity(0.9), .clear],
                        startPoint: .bottom,
                        endPoint: .top
                    )
                )

                // Reveal overlay tint
                if revealed {
                    let bothCorrect = siskelResult == .correct && ebertResult == .correct
                    Rectangle()
                        .fill(bothCorrect ? Theme.Colors.green.opacity(0.05) : Theme.Colors.red.opacity(0.05))
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(borderColor, lineWidth: 1)
            )
        }
        .frame(maxWidth: .infinity)
        .frame(maxHeight: .infinity)
        .id("poster-\(index)")
    }

    private func posterPlaceholder(title: String) -> some View {
        ZStack {
            Theme.Colors.zinc800
            Text("\u{1F3AC}")
                .font(.system(size: 50))
        }
    }

    private func shimmerPlaceholder() -> some View {
        Theme.Colors.zinc800
            .overlay(
                LinearGradient(
                    colors: [Theme.Colors.zinc800, Theme.Colors.zinc700, Theme.Colors.zinc800],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
    }

    // MARK: - Critic Row

    private var siskelResult: ThumbResult? {
        guard revealed, let movie = movie else { return nil }
        return siskelPick == movie.siskel ? .correct : .wrong
    }

    private var ebertResult: ThumbResult? {
        guard revealed, let movie = movie else { return nil }
        return ebertPick == movie.ebert ? .correct : .wrong
    }

    private func criticRow(
        name: String,
        initials: String,
        pick: Int?,
        setPick: @escaping (Int) -> Void,
        result: ThumbResult?,
        actualThumb: Int
    ) -> some View {
        HStack {
            // Avatar + name
            HStack(spacing: 10) {
                ZStack {
                    Circle()
                        .fill(Theme.Colors.zinc800)
                        .frame(width: 44, height: 44)
                    Circle()
                        .stroke(Theme.Colors.zinc700.opacity(0.6), lineWidth: 1)
                        .frame(width: 44, height: 44)
                    Text(initials)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Theme.Colors.zinc400)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.Colors.zinc200)
                    if let result = result {
                        Text(result == .correct ? "CORRECT" : "SORRY \u{2014} \(actualThumb == 1 ? "\u{1F44D}" : "\u{1F44E}")")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1)
                            .foregroundStyle(result == .correct ? Theme.Colors.green : Theme.Colors.red)
                    }
                }
            }

            Spacer()

            // Thumb buttons
            HStack(spacing: 8) {
                thumbButton(
                    type: 1,
                    selected: pick == 1,
                    onTap: { setPick(1) },
                    result: thumbButtonResult(pick: pick, actual: actualThumb, thisValue: 1, revealed: result != nil)
                )
                thumbButton(
                    type: 0,
                    selected: pick == 0,
                    onTap: { setPick(0) },
                    result: thumbButtonResult(pick: pick, actual: actualThumb, thisValue: 0, revealed: result != nil)
                )
            }
        }
    }

    private func thumbButtonResult(pick: Int?, actual: Int, thisValue: Int, revealed: Bool) -> ThumbResult? {
        guard revealed else { return nil }
        if pick == thisValue {
            return pick == actual ? .correct : .wrong
        } else {
            return actual == thisValue ? .correct : nil
        }
    }

    private func thumbButton(type: Int, selected: Bool, onTap: @escaping () -> Void, result: ThumbResult?) -> some View {
        let emoji = type == 1 ? "\u{1F44D}" : "\u{1F44E}"

        let bgColor: Color
        let borderColor: Color
        let scale: CGFloat
        let desaturated: Bool

        if let result = result {
            switch result {
            case .correct:
                bgColor = Theme.Colors.green.opacity(0.2)
                borderColor = Theme.Colors.green.opacity(0.7)
                scale = 1.1
                desaturated = false
            case .wrong:
                bgColor = Theme.Colors.red.opacity(0.15)
                borderColor = Theme.Colors.red.opacity(0.5)
                scale = 0.95
                desaturated = false
            }
        } else if selected {
            bgColor = Theme.Colors.amber.opacity(0.2)
            borderColor = Theme.Colors.amber.opacity(0.7)
            scale = 1.05
            desaturated = false
        } else {
            bgColor = Theme.Colors.zinc800.opacity(0.4)
            borderColor = Theme.Colors.zinc700.opacity(0.5)
            scale = 1.0
            desaturated = true
        }

        return Button(action: onTap) {
            Text(emoji)
                .font(.system(size: 22))
                .saturation(desaturated ? 0 : 1)
                .frame(width: 56, height: 56)
                .background(bgColor)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(borderColor, lineWidth: 1)
                )
                .scaleEffect(scale)
                .animation(.easeInOut(duration: 0.2), value: scale)
        }
        .disabled(revealed)
    }

    // MARK: - Auto-Reveal

    private func checkAutoReveal() {
        guard siskelPick != nil && ebertPick != nil && !revealed else { return }
        Task {
            try? await Task.sleep(nanoseconds: 300_000_000) // 300ms
            await MainActor.run {
                if siskelPick != nil && ebertPick != nil && !revealed {
                    handleReveal()
                }
            }
        }
    }
}

// MARK: - Results Screen

extension ThumbsGameView {
    private var resultsScreen: some View {
        let info = gradeInfo()

        return ScrollView {
            VStack(spacing: 0) {
                Spacer().frame(height: 40)

                Text("Round Complete")
                    .font(.system(size: 10, weight: .medium))
                    .tracking(3)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.zinc600)
                    .padding(.bottom, 8)

                // Grade
                Text(info.grade)
                    .font(.display(size: 64, weight: .heavy))
                    .foregroundStyle(info.color)
                    .padding(.bottom, 2)

                Text(info.flavorText)
                    .font(.system(size: 14).italic())
                    .foregroundStyle(Theme.Colors.zinc400)
                    .padding(.bottom, 20)

                // Score pips
                HStack(spacing: 5) {
                    ForEach(0..<scores.count, id: \.self) { i in
                        let status = pipStatus(at: i)
                        Circle()
                            .fill(pipColor(status: status))
                            .frame(width: 8, height: 8)
                    }
                }
                .padding(.bottom, 20)

                // Stats grid
                HStack(spacing: 12) {
                    statCard(value: "\(totalCorrect)/\(totalPossible)", label: "CORRECT")
                    statCard(value: formatTime(timer), label: "TIME")
                    statCard(value: "\(dailyStreak)\u{1F525}", label: "DAY STREAK", valueColor: Theme.Colors.amber)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 20)

                // Movie breakdown
                VStack(spacing: 6) {
                    ForEach(0..<min(movies.count, scores.count), id: \.self) { i in
                        let m = movies[i]
                        let s = scores[i]
                        let status = s.siskelOk && s.ebertOk ? "perfect" : (s.siskelOk || s.ebertOk ? "half" : "miss")

                        HStack(spacing: 8) {
                            Circle()
                                .fill(pipColor(status: status))
                                .frame(width: 6, height: 6)
                            Text(m.title)
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.Colors.zinc400)
                                .lineLimit(1)
                            Spacer()
                            Text("S:\(m.siskel == 1 ? "\u{1F44D}" : "\u{1F44E}") E:\(m.ebert == 1 ? "\u{1F44D}" : "\u{1F44E}")")
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.Colors.zinc400)
                        }
                    }
                }
                .padding(12)
                .background(Theme.Colors.zinc900.opacity(0.4))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Theme.Colors.zinc800.opacity(0.4), lineWidth: 1)
                )
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

    private func statCard(value: String, label: String, valueColor: Color = Theme.Colors.zinc100) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(valueColor)
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .tracking(2)
                .foregroundStyle(Theme.Colors.zinc500)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Theme.Colors.zinc900.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Theme.Colors.zinc800.opacity(0.5), lineWidth: 1)
        )
    }
}

// MARK: - Popups

extension ThumbsGameView {
    private func alreadyPlayedPopup(entry: ThumbsHistoryEntry) -> some View {
        ZStack {
            // Backdrop
            Color.black.opacity(0.8)
                .ignoresSafeArea()
                .onTapGesture { showAlreadyPlayedPopup = false }

            VStack(spacing: 0) {
                VStack(spacing: 12) {
                    HStack(spacing: 8) {
                        Text("\u{1F44D}")
                            .font(.system(size: 20))
                        Text("THUMBS")
                            .font(.display(size: 20))
                            .foregroundStyle(Theme.Colors.zinc100)
                        Text("#\(puzzleNumber)")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.Colors.zinc600)
                    }

                    Text("Today's challenge complete")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.Colors.zinc400)

                    HStack(spacing: 8) {
                        miniStat(value: "\(entry.score)/\(entry.outOf)", label: "Correct")
                        miniStat(value: formatTime(entry.timeSecs), label: "Time")
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

    private func overviewPopup(movie: ThumbsMovie, overview: String) -> some View {
        ZStack {
            Color.black.opacity(0.8)
                .ignoresSafeArea()
                .onTapGesture { showOverview = false }

            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(movie.title)
                            .font(.display(size: 18))
                            .foregroundStyle(Theme.Colors.zinc100)
                        Text("\(movie.year) \u{00B7} \(movie.director)")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.Colors.zinc500)
                    }
                    Spacer()
                    Button { showOverview = false } label: {
                        Image(systemName: "xmark")
                            .foregroundStyle(Theme.Colors.zinc600)
                            .font(.system(size: 14))
                            .padding(8)
                    }
                }

                Text(overview)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Colors.zinc400)
                    .lineSpacing(4)
            }
            .padding(20)
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
            .padding(.horizontal, 24)
        }
    }
}
