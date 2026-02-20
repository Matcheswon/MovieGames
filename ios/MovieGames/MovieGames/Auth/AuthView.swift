import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var authManager: AuthManager
    @State private var isSignUp = false
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var successMessage: String?
    @State private var isSubmitting = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Logo / Title
            VStack(spacing: 8) {
                Text("MovieGames")
                    .font(.display(size: 36))
                    .foregroundStyle(Theme.Colors.amber)

                Text(isSignUp ? "Create an account" : "Welcome back")
                    .font(.body(size: 16))
                    .foregroundStyle(Theme.Colors.zinc300)
            }
            .padding(.bottom, 40)

            // Tab Toggle: Sign In / Sign Up
            HStack(spacing: 0) {
                tabButton("Sign In", selected: !isSignUp) { isSignUp = false }
                tabButton("Sign Up", selected: isSignUp) { isSignUp = true }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)

            // Form Fields
            VStack(spacing: 16) {
                TextField("Email", text: $email)
                    .textFieldStyle(MovieGamesTextFieldStyle())
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                    .disableAutocorrection(true)

                SecureField("Password", text: $password)
                    .textFieldStyle(MovieGamesTextFieldStyle())
                    .textContentType(isSignUp ? .newPassword : .password)
            }
            .padding(.horizontal, 24)

            // Error / Success Messages
            if let errorMessage {
                Text(errorMessage)
                    .font(.body(size: 14))
                    .foregroundStyle(.red)
                    .padding(.top, 12)
                    .padding(.horizontal, 24)
            }

            if let successMessage {
                Text(successMessage)
                    .font(.body(size: 14))
                    .foregroundStyle(.green)
                    .padding(.top, 12)
                    .padding(.horizontal, 24)
            }

            // Submit Button
            Button {
                Task { await handleSubmit() }
            } label: {
                HStack {
                    if isSubmitting {
                        ProgressView()
                            .tint(.black)
                    }
                    Text(isSignUp ? "Create Account" : "Sign In")
                        .font(.body(size: 16, weight: .semibold))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Theme.Colors.amber)
                .foregroundStyle(.black)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(isSubmitting || email.isEmpty || password.isEmpty)
            .opacity(email.isEmpty || password.isEmpty ? 0.5 : 1)
            .padding(.horizontal, 24)
            .padding(.top, 24)

            // Divider
            HStack {
                Rectangle().fill(Theme.Colors.zinc700).frame(height: 1)
                Text("or")
                    .font(.body(size: 14))
                    .foregroundStyle(Theme.Colors.zinc500)
                Rectangle().fill(Theme.Colors.zinc700).frame(height: 1)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 20)

            // Google Sign-In Button
            Button {
                Task { await handleGoogleSignIn() }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "globe")
                    Text("Continue with Google")
                        .font(.body(size: 16, weight: .medium))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Theme.Colors.zinc800)
                .foregroundStyle(Theme.Colors.zinc100)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Theme.Colors.zinc700, lineWidth: 1)
                )
            }
            .disabled(isSubmitting)
            .padding(.horizontal, 24)

            Spacer()

            // Guest Mode Dismiss
            Button {
                // Dismiss auth screen — allow guest play
            } label: {
                Text("Play without an account")
                    .font(.body(size: 14))
                    .foregroundStyle(Theme.Colors.zinc500)
                    .underline()
            }
            .padding(.bottom, 32)
        }
        .background(Theme.Colors.zinc950)
    }

    // MARK: - Actions

    private func handleSubmit() async {
        errorMessage = nil
        successMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            if isSignUp {
                try await authManager.signUp(email: email, password: password)
                successMessage = "Check your email to confirm your account"
                email = ""
                password = ""
            } else {
                try await authManager.signIn(email: email, password: password)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func handleGoogleSignIn() async {
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            try await authManager.signInWithGoogle()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func tabButton(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.body(size: 15, weight: selected ? .semibold : .regular))
                .foregroundStyle(selected ? Theme.Colors.amber : Theme.Colors.zinc500)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .overlay(alignment: .bottom) {
                    if selected {
                        Rectangle()
                            .fill(Theme.Colors.amber)
                            .frame(height: 2)
                    }
                }
        }
    }
}

// MARK: - Custom TextField Style

struct MovieGamesTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<_Label>) -> some View {
        configuration
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Theme.Colors.zinc900)
            .foregroundStyle(Theme.Colors.zinc100)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Theme.Colors.zinc700, lineWidth: 1)
            )
            .font(.body(size: 16))
    }
}
