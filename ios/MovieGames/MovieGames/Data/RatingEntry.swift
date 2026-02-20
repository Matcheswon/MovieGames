import Foundation

struct RatingEntry: Codable, Identifiable, Equatable {
    let id: String
    let title: String
    let year: Int
    let director: String
    let show: String
    let airdate: String
    let ebert_thumb: Int
    let siskel_thumb: Int
    let video_link: String?
    let ebert_link: String?
    let siskel_link: String?
    let tmdb_id: Int?
}
