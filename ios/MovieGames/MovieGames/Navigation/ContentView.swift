import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var authManager: AuthManager
    @State private var selectedTab: Tab = .home
    @State private var showAuth = false

    enum Tab: Hashable {
        case home
        case thumbs
        case roles
        case stats
        case profile
    }

    var body: some View {
        ZStack {
            // Cinematic background
            Theme.cinematicBackground

            if authManager.isLoading {
                // Splash / loading state
                VStack {
                    Text("MovieGames")
                        .font(.display(size: 40))
                        .foregroundStyle(Theme.Colors.amber)
                    ProgressView()
                        .tint(Theme.Colors.amber)
                        .padding(.top, 16)
                }
            } else {
                TabView(selection: $selectedTab) {
                    HomeView(selectedTab: $selectedTab)
                        .tabItem {
                            Label("Home", systemImage: "film")
                        }
                        .tag(Tab.home)

                    ThumbsTabView()
                        .tabItem {
                            Label("THUMBS", systemImage: "hand.thumbsup")
                        }
                        .tag(Tab.thumbs)

                    RolesTabView()
                        .tabItem {
                            Label("ROLES", systemImage: "theatermasks")
                        }
                        .tag(Tab.roles)

                    StatsView()
                        .tabItem {
                            Label("Stats", systemImage: "chart.bar")
                        }
                        .tag(Tab.stats)

                    ProfileView()
                        .tabItem {
                            Label("Profile", systemImage: "person.circle")
                        }
                        .tag(Tab.profile)
                }
                .tint(Theme.Colors.amber)
            }
        }
        .sheet(isPresented: $showAuth) {
            AuthView()
        }
        .onAppear {
            configureTabBarAppearance()
            authManager.startListening()
        }
    }

    private func configureTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(Theme.Colors.zinc950)

        // Normal state
        appearance.stackedLayoutAppearance.normal.iconColor = UIColor(Theme.Colors.zinc500)
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor(Theme.Colors.zinc500)
        ]

        // Selected state
        appearance.stackedLayoutAppearance.selected.iconColor = UIColor(Theme.Colors.amber)
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor(Theme.Colors.amber)
        ]

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}

// MARK: - Tab Content Views

struct HomeView: View {
    @Binding var selectedTab: ContentView.Tab

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("MovieGames")
                    .font(.display(size: 36))
                    .foregroundStyle(Theme.Colors.amber)

                Text("Daily movie trivia games")
                    .font(.body(size: 16))
                    .foregroundStyle(Theme.Colors.zinc400)

                VStack(spacing: 16) {
                    Button { selectedTab = .thumbs } label: {
                        GameCard(
                            title: "THUMBS",
                            subtitle: "Siskel & Ebert Lightning Round",
                            icon: "hand.thumbsup.fill",
                            description: "Guess the critics' thumbs for 10 movies"
                        )
                    }
                    .buttonStyle(.plain)

                    Button { selectedTab = .roles } label: {
                        GameCard(
                            title: "ROLES",
                            subtitle: "Actor/Character Guessing",
                            icon: "theatermasks.fill",
                            description: "Uncover actor and character names letter by letter"
                        )
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 24)

                Spacer()
            }
            .padding(.top, 40)
        }
    }
}

struct GameCard: View {
    let title: String
    let subtitle: String
    let icon: String
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(Theme.Colors.amber)
                    .font(.system(size: 20))
                Text(title)
                    .font(.display(size: 20))
                    .foregroundStyle(Theme.Colors.zinc100)
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(Theme.Colors.zinc500)
            }
            Text(subtitle)
                .font(.body(size: 14, weight: .medium))
                .foregroundStyle(Theme.Colors.amber)
            Text(description)
                .font(.body(size: 14))
                .foregroundStyle(Theme.Colors.zinc400)
        }
        .padding(20)
        .background(Theme.Colors.zinc900.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Theme.Colors.zinc700.opacity(0.4), lineWidth: 1)
        )
    }
}

struct ThumbsTabView: View {
    var body: some View {
        NavigationStack {
            ThumbsGameView()
        }
    }
}

struct RolesTabView: View {
    var body: some View {
        NavigationStack {
            RolesGameView()
        }
    }
}

struct ProfileView: View {
    @EnvironmentObject private var authManager: AuthManager

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                if authManager.isAuthenticated {
                    VStack(spacing: 8) {
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 60))
                            .foregroundStyle(Theme.Colors.amber)

                        if let email = authManager.session?.user.email {
                            Text(email)
                                .font(.body(size: 16))
                                .foregroundStyle(Theme.Colors.zinc300)
                        }
                    }
                    .padding(.top, 40)

                    Button {
                        Task { await authManager.signOut() }
                    } label: {
                        Text("Sign Out")
                            .font(.body(size: 16, weight: .medium))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Theme.Colors.zinc800)
                            .foregroundStyle(Theme.Colors.zinc300)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Theme.Colors.zinc700, lineWidth: 1)
                            )
                    }
                    .padding(.horizontal, 24)
                } else {
                    AuthView()
                }

                Spacer()
            }
        }
    }
}
