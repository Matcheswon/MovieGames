# ROLES Playtest Changelog

Changes tested in the playtest environment (`/playtest/roles`, localhost-only).
When a change is validated and ready for the main game, move it to "Applied" and note the date.

---

## Testing

(none)

---

## Applied (2026-02-20)

71 puzzles playtested. 80% solve rate, 1:11 avg time, 0.9 avg strikes, 6.4 avg rounds.

### Spin or Solve at Round Start
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** At the start of each round (pre-roll phase), the player now chooses between **Spin** (spin the Role Call wheel) and **Solve** (go directly to solve mode, skipping the wheel). Mirrors the Wheel of Fortune mechanic where contestants can attempt to solve at any point.

### Removed Mid-Round Solve Button
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** Removed the "Solve" button that appeared during the guessing phase (after a spin). Since players can now choose Solve at pre-roll before spinning, the mid-round solve was redundant. Guessing phase now only shows "Guess a letter" text.

### Arrow Key Selection for Pre-roll Buttons
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** Left/Right arrow keys toggle focus between Spin and Solve buttons during pre-roll. Enter confirms the selected action. A ring highlight shows which button is focused. Resets to Spin each new round.

### Give Up Button on Final Solve
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** When the player reaches "Solve or lose" (all rounds used), a small "Give up" link appears below the instructions. Clicking it ends the game as failed. Prevents players from being stuck when they don't know the answer.

### 10 Rounds (up from 8)
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** `DEFAULT_MAX_ROUNDS` changed from 8 to 10. Playtest data: 75% solve rate at 8 rounds vs 84% at 10 rounds. Avg rounds used: 7.0 — enough breathing room without being a cakewalk.

### 3 Strikes = Game Over
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** Hitting 3 strikes now ends the game as failed (1s delay so the 3rd strike is visible). Previously, 3 strikes only locked the keyboard for the current round and the game continued. With avg strikes at 0.7-1.2, strikes were irrelevant — now they add real tension. Also removed the old keyboard-lockout-on-strikes advance logic.

### Double Guess Picks Are Free (No Strikes)
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** When the wheel lands on "Double Guess" (pick 2 letters), wrong picks no longer cost strikes. They still show as wrong on the keyboard. Prevents the frustrating case where a pick-2 miss triggers a 3rd strike and immediately ends the game.

### 30-Second Decision Timer (Normal Timer Bar)
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** Added a 30-second (`DECISION_TIME`) countdown timer to two previously untimed phases: pre-roll (auto-spins on expiry) and final solve (game ends as failed on expiry). Uses the same full-width timer bar above the keyboard.

### Pick 2 (Double Guess) Timer
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** The Double Guess phase now has a countdown timer (same as the guessing phase). Previously you could sit in pick-double forever with no time pressure.

### Free Letter Wheel Effect
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** New "Free Letter" wheel effect (ticket icon). When active, the player's next wrong letter guess doesn't cost a strike. Shows amber "free!" floating text instead of red "strike!" text. Limited to 2 per game. Resets each round (use it or lose it).

### Dynamic Tile Sizing
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** Tile size scales based on the longest word in the puzzle. Long names like ARNOLD SCHWARZENEGGER no longer overflow the container. Scales from w-10/h-12 (short words) down to w-5/h-7 (13+ chars).

### Keyboard Retains Hit/Miss Colors in Solve Mode
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** When entering solve mode, keyboard keys now retain their green (revealed) and red (wrong guess) styling instead of all going neutral.

### Solve Reveals Full Board on Easter Egg
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** When a correct solve triggers an easter egg, all remaining letters are now revealed immediately so the board shows the complete answer.

### Back Button More Prominent on Solve Page
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** The back button on the (non-final) solve page is now a proper styled button with background, border, and hover state instead of a tiny text link.

### Easter Egg Moved to Results Screen
**Files:** `src/components/roles/RolesGame.tsx`
**Description:** Easter egg text now displays on the results screen (below the movie title) instead of as a floating animation before results. Removes the 3.2-second delay and timing conflicts. Uses `animate-floatUp` for the same float-up-and-fade effect.

### Dashboard: Game Range Filter
**Files:** `src/components/playtest/PlaytestDashboard.tsx`
**Description:** Dashboard range picker for filtering stats by game range. Playtest-only feature.

### Bug Fixes Applied
- **Easter Egg Timer Restart on Solve** — Fixed phase/timer conflict when correct solve triggers easter egg
- **Wrong Solve Now Adds a Strike** — Wrong solve increments strikes AND decrements attempts
- **Pick-3 Misses Revealed Too Early** — Deferred miss marking until after reveal animation
- **Wheel Spin Picking Already-Revealed Letters** — Filtered revealed letters from wheel spin pools
- **Double Advance on Timer Expiry** — Moved side effects out of state updaters, using ref for countdown
