import Foundation

enum DataLoader {
    static func loadRatings() -> [RatingEntry] {
        guard let url = Bundle.main.url(forResource: "ratings", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let entries = try? JSONDecoder().decode([RatingEntry].self, from: data) else {
            return []
        }
        // Filter to entries with valid thumb values (0 or 1)
        return entries.filter { $0.ebert_thumb == 0 || $0.ebert_thumb == 1 }
            .filter { $0.siskel_thumb == 0 || $0.siskel_thumb == 1 }
    }

    static func loadRolesPuzzles() -> [RolesPuzzle] {
        guard let url = Bundle.main.url(forResource: "roles", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let puzzles = try? JSONDecoder().decode([RolesPuzzle].self, from: data) else {
            return []
        }
        return puzzles
    }
}
