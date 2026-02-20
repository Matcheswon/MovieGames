# MovieGames iOS App

SwiftUI iOS app for **movienight.games** — companion to the Next.js web app.

## Setup

### 1. Create Xcode Project

Open Xcode and create a new project:
- **Template:** App (iOS)
- **Product Name:** MovieGames
- **Organization Identifier:** com.moviegames
- **Interface:** SwiftUI
- **Language:** Swift
- **Minimum Deployment Target:** iOS 17.0

### 2. Add Swift Package Dependencies

In Xcode: File → Add Package Dependencies → Enter URL:

| Package | URL | Version |
|---------|-----|---------|
| supabase-swift | `https://github.com/supabase/supabase-swift.git` | 2.0.0+ |

This provides: `Supabase`, `Auth`, `PostgREST`, `Realtime`, `Storage`.

### 3. Bundle Fonts

Download and add to the Xcode project:
- **DM Sans** — `DMSans-VariableFont_opsz,wght.ttf` (body text)
- **Playfair Display** — `PlayfairDisplay-Bold.ttf`, `PlayfairDisplay-ExtraBold.ttf` (headings)

Register in Info.plist under `UIAppFonts` (already configured in the template).

### 4. Configure URL Scheme

The OAuth callback requires a custom URL scheme. This is already configured in Info.plist:
- **Scheme:** `com.moviegames.ios`
- **Callback URL:** `com.moviegames.ios://auth/callback`

Add this redirect URL to the Supabase dashboard:
**Authentication → URL Configuration → Redirect URLs** → add `com.moviegames.ios://auth/callback`

### 5. Bundle Data Files

Copy from the web app's `src/data/` directory:
- `ratings.json` (~1.3MB) — Siskel & Ebert reviews for THUMBS
- `roles.json` (~10KB) — Actor/character puzzles for ROLES

Add both to the Xcode project as bundle resources.

## Project Structure

```
MovieGames/
├── App/
│   ├── MovieGamesApp.swift     — App entry point, deep link handling
│   └── Info.plist              — URL schemes, fonts
├── Auth/
│   ├── AuthManager.swift       — Session management, Google OAuth, email auth
│   └── AuthView.swift          — Sign in / sign up / guest UI
├── Navigation/
│   └── ContentView.swift       — Tab bar shell, placeholder game views
├── Theme/
│   └── Theme.swift             — Colors, fonts, cinematic background
└── Services/
    └── SupabaseClient.swift    — Supabase client singleton
```

## Architecture

- **Auth:** Supabase Auth via `supabase-swift`. Google OAuth uses `ASWebAuthenticationSession`. Session stored in Keychain automatically by the SDK.
- **Theme:** Dark cinematic design matching the web (zinc-950 bg, amber accents, DM Sans / Playfair Display fonts).
- **Navigation:** Tab bar with 5 tabs: Home, THUMBS, ROLES, Stats, Profile.
- **Shared Backend:** Same Supabase project as the web app (`tynjqtruxhjjdxleeagn.supabase.co`). Users share accounts and game history across web and iOS.

## Supabase Configuration

| Key | Value |
|-----|-------|
| Project URL | `https://tynjqtruxhjjdxleeagn.supabase.co` |
| Anon Key | `sb_publishable_P-_Oh1yb2o9pqpT_jhQNrg_kVYR12gt` |
| OAuth Redirect | `com.moviegames.ios://auth/callback` |

## Next Tasks

See `Planning/features/ios-docs/implementation-plan.md` for the full task breakdown:
- **Task 2:** Daily puzzle engine + data bundling (port hash/RNG to Swift)
- **Task 3:** THUMBS game implementation
- **Task 4:** ROLES game implementation
- **Task 5:** Persistence layer (local + Supabase) and stats
- **Task 6:** Polish, animations, and platform integration
