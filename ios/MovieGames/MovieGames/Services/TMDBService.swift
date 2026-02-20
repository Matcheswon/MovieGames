import Foundation

/// Fetches movie posters and overviews from TMDB.
/// Uses URLCache for aggressive caching (24h+).
/// Falls back gracefully if no API key or network failure.
@MainActor
final class TMDBService: ObservableObject {
    static let shared = TMDBService()

    private let baseURL = "https://api.themoviedb.org/3"
    private let imageBaseURL = "https://image.tmdb.org/t/p/w500"

    // In-memory cache for fetched movie data
    private var cache: [String: TMDBMovieData] = [:]

    struct TMDBMovieData {
        let posterURL: String?
        let overview: String?
    }

    /// Fetches poster URL and overview for a movie.
    /// Tries by TMDB ID first, then falls back to title+year search.
    func fetchMovieData(tmdbId: Int?, title: String, year: Int) async -> TMDBMovieData {
        let cacheKey = tmdbId.map { "id:\($0)" } ?? "search:\(title):\(year)"
        if let cached = cache[cacheKey] {
            return cached
        }

        var result: TMDBMovieData?

        // Try by TMDB ID first
        if let tmdbId = tmdbId, tmdbId > 0 {
            result = await fetchById(tmdbId)
        }

        // Fallback to search
        if result == nil || result?.posterURL == nil {
            let searchResult = await searchMovie(title: title, year: year)
            if let searchResult = searchResult {
                result = TMDBMovieData(
                    posterURL: searchResult.posterURL ?? result?.posterURL,
                    overview: searchResult.overview ?? result?.overview
                )
            }
        }

        let data = result ?? TMDBMovieData(posterURL: nil, overview: nil)
        cache[cacheKey] = data
        return data
    }

    private var apiKey: String? {
        // Look for TMDB API key in the app bundle's Info.plist or environment
        Bundle.main.object(forInfoDictionaryKey: "TMDB_API_KEY") as? String
    }

    private var accessToken: String? {
        Bundle.main.object(forInfoDictionaryKey: "TMDB_ACCESS_TOKEN") as? String
    }

    private func makeRequest(url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.cachePolicy = .returnCacheDataElseLoad
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    private func buildURL(_ path: String, queryItems: [URLQueryItem] = []) -> URL? {
        var components = URLComponents(string: baseURL + path)
        var items = queryItems + [URLQueryItem(name: "language", value: "en-US")]
        if accessToken == nil, let key = apiKey {
            items.append(URLQueryItem(name: "api_key", value: key))
        }
        components?.queryItems = items
        return components?.url
    }

    private func fetchById(_ tmdbId: Int) async -> TMDBMovieData? {
        guard let url = buildURL("/movie/\(tmdbId)") else { return nil }
        let request = makeRequest(url: url)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                return nil
            }
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            let posterPath = json?["poster_path"] as? String
            let overview = json?["overview"] as? String
            return TMDBMovieData(
                posterURL: posterPath.map { imageBaseURL + $0 },
                overview: overview?.isEmpty == true ? nil : overview
            )
        } catch {
            return nil
        }
    }

    private func searchMovie(title: String, year: Int) async -> TMDBMovieData? {
        guard let url = buildURL("/search/movie", queryItems: [
            URLQueryItem(name: "query", value: title),
            URLQueryItem(name: "year", value: String(year))
        ]) else { return nil }
        let request = makeRequest(url: url)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                return nil
            }
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            let results = json?["results"] as? [[String: Any]]
            guard let first = results?.first else { return nil }
            let posterPath = first["poster_path"] as? String
            let overview = first["overview"] as? String
            return TMDBMovieData(
                posterURL: posterPath.map { imageBaseURL + $0 },
                overview: overview?.isEmpty == true ? nil : overview
            )
        } catch {
            return nil
        }
    }
}
