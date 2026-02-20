import Foundation
import Supabase
import AuthenticationServices

@MainActor
final class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var session: Session?
    @Published var isLoading = true

    var isAuthenticated: Bool { session != nil }
    var userId: UUID? { session?.user.id }

    private init() {
        Task {
            await restoreSession()
        }
    }

    // MARK: - Session Management

    /// Restore session from Keychain on app launch.
    /// supabase-swift stores tokens in Keychain automatically.
    func restoreSession() async {
        isLoading = true
        defer { isLoading = false }

        do {
            session = try await supabase.auth.session
        } catch {
            session = nil
        }
    }

    /// Listen for auth state changes (sign in, sign out, token refresh).
    func startListening() {
        Task {
            for await (event, session) in supabase.auth.authStateChanges {
                switch event {
                case .signedIn, .tokenRefreshed:
                    self.session = session
                case .signedOut:
                    self.session = nil
                default:
                    break
                }
            }
        }
    }

    // MARK: - Email/Password Auth

    func signIn(email: String, password: String) async throws {
        let response = try await supabase.auth.signIn(
            email: email,
            password: password
        )
        session = response
    }

    func signUp(email: String, password: String) async throws {
        // After sign up, user receives confirmation email.
        // Session is nil until email is confirmed.
        _ = try await supabase.auth.signUp(
            email: email,
            password: password
        )
    }

    // MARK: - Google OAuth

    func signInWithGoogle() async throws {
        let url = try await supabase.auth.getOAuthSignInURL(
            provider: .google,
            redirectTo: SupabaseConfig.redirectURL
        )

        // Open URL in ASWebAuthenticationSession for OAuth flow
        let callbackURL = try await withCheckedThrowingContinuation { continuation in
            let authSession = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: SupabaseConfig.redirectScheme
            ) { callbackURL, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: AuthError.oauthCallbackMissing)
                }
            }
            authSession.presentationContextProvider = ASWebAuthContextProvider.shared
            authSession.prefersEphemeralWebBrowserSession = false
            authSession.start()
        }

        // Exchange the callback URL for a session
        try await handleDeepLink(callbackURL)
    }

    // MARK: - Deep Link Handling

    func handleDeepLink(_ url: URL) async {
        do {
            session = try await supabase.auth.session(from: url)
        } catch {
            print("Deep link auth error: \(error)")
        }
    }

    // MARK: - Sign Out

    func signOut() async {
        do {
            try await supabase.auth.signOut()
            session = nil
        } catch {
            print("Sign out error: \(error)")
        }
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case oauthCallbackMissing

    var errorDescription: String? {
        switch self {
        case .oauthCallbackMissing:
            return "OAuth callback URL was not received."
        }
    }
}

// MARK: - ASWebAuthenticationSession Context

final class ASWebAuthContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = ASWebAuthContextProvider()

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        guard let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = scene.windows.first else {
            return ASPresentationAnchor()
        }
        return window
    }
}
