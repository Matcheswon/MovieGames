# PTR Feature Manifest — ROLES

> **PTR = Public Test Realm.** These features only appear when the PTR toggle is ON
> in the playtest build (`/playtest/roles`). They are **never visible** in the
> production daily game at `/play/roles/daily`.
>
> **When you add or remove a PTR feature, update this file.** This is the single
> source of truth for what differs between the standard and experimental builds.

---

## How it works

1. The playtest page (`src/app/playtest/roles/page.tsx`) has a **PTR ON/OFF** toggle
   that sets `buildVariant` to `"standard"` or `"experimental"`.
2. It passes `variant={buildVariant}` to `<RolesGame>`.
3. Inside `RolesGame`, `const isExperimental = variant === "experimental"` gates all
   PTR-only UI and logic.
4. The `useExperimentalFeatures` hook (`src/components/roles/useExperimentalFeatures.ts`)
   holds PTR-only state (score, streaks, badges, etc.) and returns noops when disabled.
5. The daily game page (`src/app/play/roles/daily/page.tsx`) never passes a `variant`
   prop, so `isExperimental` is always `false` in production.

### Adding a new PTR feature

- Gate **all** UI and logic with `isExperimental`. No exceptions.
- If the feature needs its own state/logic, add it to `useExperimentalFeatures.ts`.
  The hook already returns a `NOOP_STATE` when disabled, so add a noop default there.
- If it's purely UI (no new state), just wrap the JSX with `{isExperimental && (...)}`.
- Add an entry to the **Active PTR Features** section below.
- Mark it with a `{/* PTR: ... */}` comment in the JSX for searchability.

### Graduating a feature to production

- Remove the `isExperimental` gate so the feature runs unconditionally.
- Move the entry from **Active PTR Features** below to **Graduated** with a date.
- If the feature used `useExperimentalFeatures` state, migrate that state into
  `RolesGame` directly and remove it from the hook.

### Removing a PTR feature

- Delete the gated code and any hook state.
- Move the entry to **Removed** with a date and reason.

---

## Active PTR Features

### Scoring System
**Files:** `useExperimentalFeatures.ts`, `RolesGame.tsx`
**What it does:** Point-based scoring (0–N pts) displayed in the header during gameplay
and on the results screen. Points awarded for correct guesses (10 pts per letter
occurrence), speed bonuses (5 pts within 2s, 3 pts within 4s), streak multipliers
(+2 per consecutive correct), and a no-solve bonus (+20). Wrong guesses deduct 5 pts.
Max possible score is computed per puzzle.
**Status:** Needs work — scoring formula may need rebalancing.

### Hot Streak Counter
**Files:** `useExperimentalFeatures.ts`, `RolesGame.tsx`
**What it does:** Tracks consecutive correct guesses across rounds. Displays a flame
icon + count in the header. Visual intensity increases at 3/5/7 streaks. Milestone
toasts float up ("Streak x3!", "Hot Streak!", "ON FIRE!"). Resets on wrong guess or
timeout.
**Status:** Needs work — streak milestones may need tuning.

### Tile Heat Map
**Files:** `useExperimentalFeatures.ts`, `RolesGame.tsx`
**What it does:** Tiles glow with heat intensity based on reveal context. Applied during
tile pop animations on correct guesses.
**Status:** Needs work — visual effect is subtle, may need stronger differentiation.

### Badges (Full Reveal, Quick Draw)
**Files:** `useExperimentalFeatures.ts`, `RolesGame.tsx`
**What it does:** Awards badges on the results screen. "Full Reveal" if solved without
using solve mode. "Quick Draw" if any guess was made within 2 seconds.
**Status:** Needs work — badge criteria and display may change.

### Letter Cloud (Results)
**Files:** `useExperimentalFeatures.ts`, `RolesGame.tsx`
**What it does:** On the results screen, shows all 26 letters sized by their frequency
in the puzzle. Correct guesses are green, wrong are red, unused are dim. Gives a
post-game breakdown of letter distribution.
**Status:** Needs work — may be too noisy on the results screen.

### Share Text Enhancements
**Files:** `RolesGame.tsx`
**What it does:** Adds badge emojis and score to the share text when PTR is on.
**Status:** Tied to scoring/badges — graduates when they do.

### Effect Announcement Banner
**Files:** `RolesGame.tsx`
**What it does:** After the Role Call wheel lands, a prominent banner appears below the
spinner showing the effect icon, name, and description (green for good, red for bad).
Persists for 3 seconds so the player can read it even after the phase transitions to
guessing. Addresses the problem of new players not noticing what the wheel landed on.
**Status:** New — needs playtesting.

### Active Effect Tag
**Files:** `RolesGame.tsx`
**What it does:** During the guessing phase, shows a subtle reminder below "Guess a
letter" for effects that change the round behavior: "Free Letter active — miss without
a strike", "+4s — extra time this round", "Half Time — only 4 seconds". Only appears
after the announcement banner fades.
**Status:** New — needs playtesting.

### Enhanced Double Guess Header
**Files:** `RolesGame.tsx`
**What it does:** When the wheel lands on Double Guess and transitions to pick-2-letters,
a Target icon + "DOUBLE GUESS" label in emerald appears above the "Pick 2 Letters"
prompt. Makes it clear why the player is suddenly picking 2 letters.
**Status:** New — needs playtesting.

### Phase Breadcrumb
**Files:** `RolesGame.tsx`
**What it does:** A small `SPIN › EFFECT › GUESS` indicator below the round counter.
The current phase step is highlighted in amber, others are dim. Orients new players on
where they are in the round flow.
**Status:** New — needs playtesting.

---

## Graduated

(none yet)

---

## Removed

(none yet)
