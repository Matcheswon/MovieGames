# Action Items — iOS MovieGames

## Task 1: Project scaffold + Supabase auth
- [ ] Create the actual Xcode project in Xcode (File → New → Project → iOS App, SwiftUI, iOS 17+) and copy the Swift files from `ios/MovieGames/MovieGames/` into it — the reference files are templates, not a buildable Xcode project
- [ ] Add `supabase-swift` SPM dependency in Xcode: File → Add Package Dependencies → `https://github.com/supabase/supabase-swift.git` (version 2.0.0+)
- [ ] Download and bundle fonts: DM Sans (variable) and Playfair Display (Bold, ExtraBold) .ttf files into the Xcode project
- [ ] Add `com.moviegames.ios://auth/callback` to Supabase dashboard: Authentication → URL Configuration → Redirect URLs
- [ ] Copy `src/data/ratings.json` and `src/data/roles.json` into the Xcode project as bundle resources

## Task 2: Daily puzzle engine + data bundling
- [ ] Add the new Swift files to the Xcode project: `Data/RatingEntry.swift`, `Data/RolesPuzzle.swift`, `Data/DataLoader.swift`, `Engine/DailyPuzzleEngine.swift`, `Engine/PuzzleManager.swift` — drag them into the Xcode project navigator
- [ ] Add `Data/ratings.json` and `Data/roles.json` to the Xcode project as bundle resources (Target → Build Phases → Copy Bundle Resources)
- [ ] Add `Data/ratings.json` and `Data/roles.json` to the test target's bundle resources as well — needed for `DailyPuzzleEngineTests` parity tests
- [ ] Create a test target in Xcode (File → New → Target → Unit Testing Bundle) named `MovieGamesTests` and add `MovieGamesTests/DailyPuzzleEngineTests.swift` to it
- [ ] Run the unit tests in Xcode to verify all parity tests pass (Product → Test or Cmd+U)

## Task 3: THUMBS game implementation
- [ ] Add the new Swift files to the Xcode project: `Games/Thumbs/ThumbsGameView.swift` and `Services/TMDBService.swift` — drag them into the Xcode project navigator
- [ ] Add TMDB API credentials to Info.plist: set `TMDB_API_KEY` or `TMDB_ACCESS_TOKEN` (same values as the web app's `.env`) — needed for poster fetching
- [ ] Build and run in Xcode to verify the THUMBS tab loads and is playable (Cmd+R)

## Task 4: ROLES game implementation
- [ ] Add the new Swift file to the Xcode project: `Games/Roles/RolesGameView.swift` — drag it into the Xcode project navigator under `Games/Roles/`
- [ ] Build and run in Xcode to verify the ROLES tab loads and is playable (Cmd+R)
- [ ] Test the full game flow: pick 3 letters → wheel spin → guess/solve → win/loss screens

## Task 5: Persistence layer (local + Supabase) and stats
- [ ] Add the new Swift files to the Xcode project: `Services/GameResultService.swift`, `Services/StatsService.swift`, `Views/StatsView.swift` — drag them into the Xcode project navigator
- [ ] Build and run in Xcode to verify the Stats tab loads and shows "Sign In to View Stats" for unauthenticated users (Cmd+R)
- [ ] Sign in with a test account, play a game, then verify the result appears in Supabase `game_results` table (check via Supabase dashboard → Table Editor)
- [ ] Test offline behavior: enable airplane mode, play a game, then disable airplane mode and verify the queued result flushes to Supabase
- [ ] Test migration: play games while signed out, then sign in and verify local history migrates to Supabase

## Task 6: Polish, animations, and platform integration
- [ ] Add the new Swift files to the Xcode project: `Services/HapticManager.swift`, `App/LaunchScreen.swift` — drag them into the Xcode project navigator
- [ ] Add `Assets.xcassets` to the Xcode project if not already present — it contains AppIcon and AccentColor asset catalogs
- [ ] Create a 1024x1024 app icon PNG and place it at `Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` — use the cinematic theme (dark bg with amber "MG" or film reel icon)
- [ ] In Xcode, set the launch screen: Info.plist → `UILaunchScreen` → set `UIColorName` to `AccentColor` or use `LaunchScreen.swift` as a custom launch screen storyboard
- [ ] Build and run on iPhone SE simulator to verify tile sizes and keyboard fit on small screens
- [ ] Build and run on iPhone 15 Pro Max simulator to verify layout on large screens
- [ ] Enable VoiceOver in iOS Settings → Accessibility → VoiceOver and test that game elements (tiles, buttons, timer, strikes) announce correctly
- [ ] Test pull-to-refresh on both THUMBS and ROLES start screens — pull down should refresh the puzzle if the date has changed
- [ ] Run Cmd+U to verify all parity tests still pass after polish changes
