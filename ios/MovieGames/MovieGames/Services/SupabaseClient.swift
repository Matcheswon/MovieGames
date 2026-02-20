import Foundation
import Supabase

enum SupabaseConfig {
    static let projectURL = URL(string: "https://tynjqtruxhjjdxleeagn.supabase.co")!
    static let anonKey = "sb_publishable_P-_Oh1yb2o9pqpT_jhQNrg_kVYR12gt"

    // OAuth redirect scheme — register in Info.plist under URL Types
    // Scheme: "com.moviegames.ios" → callback URL: com.moviegames.ios://auth/callback
    static let redirectScheme = "com.moviegames.ios"
    static let redirectURL = URL(string: "\(redirectScheme)://auth/callback")!
}

let supabase = SupabaseClient(
    supabaseURL: SupabaseConfig.projectURL,
    supabaseKey: SupabaseConfig.anonKey
)
