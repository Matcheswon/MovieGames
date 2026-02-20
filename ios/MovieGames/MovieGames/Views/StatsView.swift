import SwiftUI

// MARK: - Stats View

/// Stats screen with THUMBS and ROLES tabs.
/// Requires authentication to show Supabase stats; falls back to local stats when offline.
/// Matches the spec's §4.4 Stats Screen.
struct StatsView: View {
    @EnvironmentObject private var authManager: AuthManager
    @StateObject private var statsService = StatsService.shared
    @State private var selectedGame: GameTab = .thumbs

    enum GameTab: String, CaseIterable {
        case thumbs = "THUMBS"
        case roles = "ROLES"
    }

    var body: some View {
        ZStack {
            Theme.cinematicBackground

            if !authManager.isAuthenticated {
                signInPrompt
            } else if statsService.isLoading {
                loadingView
            } else {
                statsContent
            }
        }
        .onAppear {
            if authManager.isAuthenticated {
                Task { await statsService.fetchStats() }
            }
        }
    }

    // MARK: - Sign-In Prompt

    private var signInPrompt: some View {
        VStack(spacing: 20) {
            Image(systemName: "chart.bar.fill")
                .font(.system(size: 48))
                .foregroundStyle(Theme.Colors.zinc600)

            Text("Sign In to View Stats")
                .font(.display(size: 24))
                .foregroundStyle(Theme.Colors.zinc200)

            Text("Track your progress, streaks, and performance across games.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.Colors.zinc500)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
    }

    // MARK: - Loading

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .tint(Theme.Colors.amber)
            Text("Loading stats...")
                .font(.system(size: 14))
                .foregroundStyle(Theme.Colors.zinc500)
        }
    }

    // MARK: - Stats Content

    private var statsContent: some View {
        ScrollView {
            VStack(spacing: 0) {
                Spacer().frame(height: 20)

                // Header
                Text("Stats")
                    .font(.display(size: 32))
                    .foregroundStyle(Theme.Colors.zinc100)
                    .padding(.bottom, 4)

                // Segment picker
                Picker("Game", selection: $selectedGame) {
                    ForEach(GameTab.allCases, id: \.self) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 24)
                .padding(.bottom, 24)

                // Game stats
                switch selectedGame {
                case .thumbs:
                    if let thumbs = statsService.stats?.thumbs {
                        thumbsStatsView(thumbs)
                    } else {
                        emptyState(game: "THUMBS")
                    }
                case .roles:
                    if let roles = statsService.stats?.roles {
                        rolesStatsView(roles)
                    } else {
                        emptyState(game: "ROLES")
                    }
                }

                Spacer().frame(height: 40)
            }
        }
    }

    // MARK: - Empty State

    private func emptyState(game: String) -> some View {
        VStack(spacing: 16) {
            Spacer().frame(height: 40)

            Image(systemName: game == "THUMBS" ? "hand.thumbsup" : "theatermasks")
                .font(.system(size: 40))
                .foregroundStyle(Theme.Colors.zinc700)

            Text("Play your first game to see stats here")
                .font(.system(size: 14))
                .foregroundStyle(Theme.Colors.zinc500)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - THUMBS Stats

    private func thumbsStatsView(_ stats: ThumbsStats) -> some View {
        VStack(spacing: 16) {
            // Primary stats row
            HStack(spacing: 12) {
                statCard(
                    value: "\(stats.gamesPlayed)",
                    label: "PLAYED"
                )
                statCard(
                    value: "\(stats.averageScore)%",
                    label: "AVG SCORE",
                    valueColor: Theme.Colors.amber
                )
                statCard(
                    value: "\(stats.bestScore)",
                    label: "BEST SCORE",
                    valueColor: Theme.Colors.green
                )
            }
            .padding(.horizontal, 24)

            // Secondary stats row
            HStack(spacing: 12) {
                statCard(
                    value: formatTime(stats.averageTimeSecs),
                    label: "AVG TIME"
                )
                statCard(
                    value: "\(stats.currentStreak)",
                    label: "STREAK",
                    icon: "\u{1F525}",
                    valueColor: Theme.Colors.amber
                )
                statCard(
                    value: "\(stats.bestStreak)",
                    label: "BEST STREAK",
                    icon: "\u{1F525}"
                )
            }
            .padding(.horizontal, 24)
        }
    }

    // MARK: - ROLES Stats

    private func rolesStatsView(_ stats: RolesStats) -> some View {
        VStack(spacing: 16) {
            // Primary stats row
            HStack(spacing: 12) {
                statCard(
                    value: "\(stats.gamesPlayed)",
                    label: "PLAYED"
                )
                statCard(
                    value: "\(stats.solveRate)%",
                    label: "SOLVE RATE",
                    valueColor: Theme.Colors.green
                )
                statCard(
                    value: String(format: "%.1f", stats.averageStrikes),
                    label: "AVG STRIKES",
                    valueColor: Theme.Colors.red
                )
            }
            .padding(.horizontal, 24)

            // Secondary stats row
            HStack(spacing: 12) {
                statCard(
                    value: formatTime(stats.averageTimeSecs),
                    label: "AVG TIME"
                )
                statCard(
                    value: "\(stats.currentStreak)",
                    label: "STREAK",
                    icon: "\u{1F525}",
                    valueColor: Theme.Colors.amber
                )
                statCard(
                    value: "\(stats.bestStreak)",
                    label: "BEST STREAK",
                    icon: "\u{1F525}"
                )
            }
            .padding(.horizontal, 24)
        }
    }

    // MARK: - Stat Card

    private func statCard(
        value: String,
        label: String,
        icon: String = "",
        valueColor: Color = Theme.Colors.zinc100
    ) -> some View {
        VStack(spacing: 6) {
            Text("\(value)\(icon)")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(valueColor)
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .tracking(2)
                .foregroundStyle(Theme.Colors.zinc500)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Theme.Colors.zinc900.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Theme.Colors.zinc800.opacity(0.5), lineWidth: 1)
        )
    }

    // MARK: - Helpers

    private func formatTime(_ seconds: Int) -> String {
        "\(seconds / 60):\(String(format: "%02d", seconds % 60))"
    }
}
