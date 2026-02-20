# Implementation Plan — iOS MovieGames App

> Each task = one full Claude session. Tasks are ordered by dependency.

---

## Task 1: Project scaffold + Supabase auth
- [x] Create Xcode project with SwiftUI, target iOS 17+
- [x] Add `supabase-swift` package dependency
- [x] Configure Supabase client with project URL and anon key
- [x] Implement auth flow: Google OAuth sign-in, email/password sign-in, sign-up
- [x] Build Auth screen (sign in / sign up tabs, guest dismiss)
- [x] Store session in Keychain, handle token refresh
- [x] Add app navigation shell (tab bar or nav stack: Home, THUMBS, ROLES, Stats, Profile)
- [x] Set up dark cinematic theme (zinc-950 background, amber accents, DM Sans / Playfair Display fonts)

**Acceptance:** User can sign in with Google or email, session persists across app launches, guest can dismiss auth.

---

## Task 2: Daily puzzle engine + data bundling
- [x] Bundle `ratings.json` and `roles.json` as app resources
- [x] Port `stableHash()` and `seededRandom()` functions to Swift (must produce identical output)
- [x] Port `getNyDateKey()` — format current date as YYYY-MM-DD in America/New_York timezone
- [x] Implement `getDailyMovies()` for THUMBS — seeded Fisher-Yates shuffle, take first 10
- [x] Implement `getDailyRolesPuzzle()` for ROLES — epoch-based modulo index into puzzles array
- [x] Implement ROLES `rng()` for wheel effect sequence generation
- [x] Write unit tests verifying Swift output matches known web app outputs for specific dates
- [x] Implement freshness guard: on `scenePhase` change to `.active`, check if NY date changed → reload puzzle

**Acceptance:** For any given date, the Swift functions produce the exact same puzzle selection and puzzle number as the web app. Tests prove parity for at least 5 known dates.

---

## Task 3: THUMBS game implementation
- [ ] Build THUMBS start screen (instructions, streak display, play button, already-played detection)
- [ ] Build playing screen: movie poster (from TMDB), title/year, Siskel & Ebert thumb buttons
- [ ] Implement thumb button states: default → selected (amber) → correct (green) → wrong (red)
- [ ] Add progress bar (10 pips: green/amber/red/gray)
- [ ] Implement auto-reveal timing (300ms after both picks, 1200ms before next movie)
- [ ] Add continuous game timer
- [ ] Build results screen: grade, score, time, perfect rounds, streak, movie-by-movie breakdown
- [ ] Implement share sheet with emoji grid format matching web
- [ ] Add TMDB poster fetching with caching (URLCache or SwiftUI AsyncImage with cache)
- [ ] Add movie info/overview popup

**Acceptance:** Full THUMBS game playable with correct scoring, grading, timing, and visual feedback matching the web experience.

---

## Task 4: ROLES game implementation
- [ ] Build ROLES start screen (instructions, streak display, play button, already-played detection)
- [ ] Build letter board: two rows (actor + character) with hidden/revealed tile states
- [ ] Implement pick-3-letters phase with keyboard and stagger reveal animation
- [ ] Build Role Call wheel animation (spin, settle, display effect)
- [ ] Implement all 8 wheel effects with constraints (max counts, no consecutive bad effects)
- [ ] Build guessing phase: on-screen QWERTY keyboard, letter state coloring (green/red/default)
- [ ] Implement timer with per-round countdown (8s base, effect modifications)
- [ ] Implement strike system (3 strikes = game over)
- [ ] Build solve mode: fill-in-the-blank overlay with keyboard input and submit
- [ ] Implement solve attempt limits (2 normal + 1 final)
- [ ] Build win screen with easter egg quote display and celebration animation
- [ ] Build loss screen with answer reveal
- [ ] Implement share sheet matching web format

**Acceptance:** Full ROLES game playable with correct wheel effects, letter logic, strike tracking, solve mode, and timing matching web behavior.

---

## Task 5: Persistence layer (local + Supabase) and stats
- [ ] Implement UserDefaults storage for guest mode using same key structure as web (`moviegames:thumbwars:daily`, `moviegames:roles:daily`)
- [ ] Implement Supabase `game_results` upsert for authenticated users (THUMBS and ROLES payloads)
- [ ] Implement dual-save: save to local storage always, save to Supabase if authenticated
- [ ] Implement daily streak logic: consecutive NY-timezone dates, reset if gap > 1 day
- [ ] Build local → Supabase migration flow on first sign-in
- [ ] Build Stats screen: THUMBS tab (games played, avg score %, best score, avg time, streaks) and ROLES tab (games played, solve rate %, avg strikes, avg time, streaks)
- [ ] Implement streak computation from Supabase game_results (matching web algorithm)
- [ ] Handle offline gracefully: queue Supabase writes for retry, show local stats as fallback

**Acceptance:** Guest results persist locally. Authenticated results appear in Supabase and match web stats. Migration transfers all local history on sign-in. Stats screen shows correct aggregated data.

---

## Task 6: Polish, animations, and platform integration
- [ ] Refine tile reveal animations for ROLES (blink → pop, stagger timing matching web)
- [ ] Add haptic feedback: light tap on button press, success/error haptics on reveal
- [ ] Implement keyboard input for iPad (physical keyboard support for letter guessing)
- [ ] Add app icon and launch screen
- [ ] Test on all iPhone sizes (SE, standard, Pro Max) — ensure responsive layout
- [ ] Ensure VoiceOver accessibility for game elements (tile labels, button actions, timer announcements)
- [ ] Add pull-to-refresh or manual refresh for stale puzzles
- [ ] Final QA pass: verify daily puzzle parity with web app for current date

**Acceptance:** App feels polished and native. Animations are smooth. Works correctly across device sizes. Accessible via VoiceOver. Daily puzzles verified matching web.

---

## Dependency Graph

```
Task 1 (scaffold + auth)
  └── Task 2 (puzzle engine + data)
        ├── Task 3 (THUMBS game)
        └── Task 4 (ROLES game)
              └── Task 5 (persistence + stats)
                    └── Task 6 (polish)
```

Tasks 3 and 4 can be worked in parallel once Task 2 is complete.

---

## Key Risk: Puzzle Parity

The most critical technical risk is ensuring the Swift implementations of `stableHash`, `seededRandom`, and the Fisher-Yates shuffle produce **byte-identical** results to the JavaScript versions. Integer overflow behavior differs between JS and Swift — the hash function uses `|= 0` to force 32-bit signed integer semantics in JS, which must be replicated exactly in Swift using `Int32` arithmetic.

**Mitigation:** Task 2 includes mandatory cross-platform parity tests. Generate a test fixture from the web app (date → expected movie IDs / puzzle index) and validate in Swift.

---

## Out of Scope (v1)
- Push notifications
- Widgets / Live Activities
- Sign in with Apple (no App Store social login requirement triggered)
- Pro subscriptions / LemonSqueezy
- Remote puzzle data fetching (data is bundled)
- iPad-specific layouts
- watchOS / macOS targets
