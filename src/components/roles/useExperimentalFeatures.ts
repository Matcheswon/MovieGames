// PTR feature state/logic for ROLES experimental build.
// See docs/PTR-FEATURES.md for the full manifest. Update it when adding/removing features.

import { useState, useCallback, useRef } from "react";

// ─── Types ───

export type ExperimentalBadges = {
  fullReveal: boolean;
  quickDraw: boolean;
};

export type LetterCloudEntry = {
  status: "correct" | "wrong" | "unused";
  count: number; // occurrences in the puzzle (0 if not in puzzle)
};

export type ExperimentalState = {
  // Score
  score: number;
  maxPossibleScore: number;
  // Hot streak
  hotStreak: number;
  peakHotStreak: number;
  streakMilestone: number | null;
  // Badges
  badges: ExperimentalBadges;
  // Tile heat
  tileHeatMap: Map<string, number>;
  // Letter cloud
  letterCloud: Map<string, LetterCloudEntry>;
  // Event handlers
  onCorrectGuess: (letter: string, matchCount: number, timeRemaining: number, guessTime: number) => void;
  onWrongGuess: () => void;
  onTimeout: () => void;
  onSolveModeEntered: () => void;
  onGameEnd: (solved: boolean) => void;
  setTileHeat: (posKey: string, intensity: number) => void;
  clearTileHeat: () => void;
  reset: () => void;
};

// ─── Noop instance (returned when experimental is disabled) ───

const EMPTY_MAP = new Map<string, number>();
const EMPTY_CLOUD = new Map<string, LetterCloudEntry>();
const NOOP = () => {};

const NOOP_STATE: ExperimentalState = {
  score: 0,
  maxPossibleScore: 0,
  hotStreak: 0,
  peakHotStreak: 0,
  streakMilestone: null,
  badges: { fullReveal: false, quickDraw: false },
  tileHeatMap: EMPTY_MAP,
  letterCloud: EMPTY_CLOUD,
  onCorrectGuess: NOOP,
  onWrongGuess: NOOP,
  onTimeout: NOOP,
  onSolveModeEntered: NOOP,
  onGameEnd: NOOP,
  setTileHeat: NOOP,
  clearTileHeat: NOOP,
  reset: NOOP,
};

// ─── Score constants ───

const PTS_PER_OCCURRENCE = 10;
const PTS_SPEED_FAST = 5;    // within 2s of round start
const PTS_SPEED_MED = 3;     // within 4s
const PTS_STREAK_MULT = 2;   // +2 per streak level
const PTS_NO_SOLVE = 20;
const PTS_WRONG_PENALTY = 5;

// ─── Helper: compute max possible score for a puzzle ───

function computeMaxPossible(actor: string, character: string, normalize: (ch: string) => string, isGuessable: (ch: string) => boolean): number {
  const combined = actor + character;
  const letterCounts = new Map<string, number>();
  for (const ch of combined) {
    if (!isGuessable(ch)) continue;
    const n = normalize(ch);
    letterCounts.set(n, (letterCounts.get(n) ?? 0) + 1);
  }

  let totalOccurrences = 0;
  for (const count of letterCounts.values()) totalOccurrences += count;
  const uniqueCount = letterCounts.size;

  // Base points: every letter occurrence
  const baseMax = totalOccurrences * PTS_PER_OCCURRENCE;
  // Speed: assume fast on every unique guess
  const speedMax = uniqueCount * PTS_SPEED_FAST;
  // Streak: assume perfect streak 1..uniqueCount
  // streak bonus for guess i (0-indexed) = PTS_STREAK_MULT * i
  let streakMax = 0;
  for (let i = 1; i < uniqueCount; i++) streakMax += PTS_STREAK_MULT * i;
  // No-solve bonus
  const noSolveMax = PTS_NO_SOLVE;

  return baseMax + speedMax + streakMax + noSolveMax;
}

// ─── Helper: build letter cloud from puzzle ───

function buildLetterCloud(
  actor: string,
  character: string,
  revealed: Set<string>,
  wrongGuesses: string[],
  normalize: (ch: string) => string,
  isGuessable: (ch: string) => boolean,
): Map<string, LetterCloudEntry> {
  const cloud = new Map<string, LetterCloudEntry>();

  // Init all 26 letters
  for (let c = 65; c <= 90; c++) {
    cloud.set(String.fromCharCode(c), { status: "unused", count: 0 });
  }

  // Count occurrences in puzzle
  const combined = actor + character;
  for (const ch of combined) {
    if (!isGuessable(ch)) continue;
    const n = normalize(ch);
    const entry = cloud.get(n);
    if (entry) entry.count += 1;
  }

  // Mark status
  const wrongSet = new Set(wrongGuesses.map(w => w.toUpperCase()));
  for (const [letter, entry] of cloud) {
    if (revealed.has(letter)) {
      entry.status = "correct";
    } else if (wrongSet.has(letter)) {
      entry.status = "wrong";
    }
  }

  return cloud;
}

// ─── Hook ───

export function useExperimentalFeatures(
  enabled: boolean,
  puzzle: { actor: string; character: string },
  revealed: Set<string>,
  wrongGuesses: string[],
  normalize: (ch: string) => string,
  isGuessable: (ch: string) => boolean,
): ExperimentalState {
  // All state — always declared (React rules of hooks)
  const [score, setScore] = useState(0);
  const [hotStreak, setHotStreak] = useState(0);
  const [peakHotStreak, setPeakHotStreak] = useState(0);
  const [streakMilestone, setStreakMilestone] = useState<number | null>(null);
  const [usedSolveMode, setUsedSolveMode] = useState(false);
  const [hadQuickDraw, setHadQuickDraw] = useState(false);
  const [badges, setBadges] = useState<ExperimentalBadges>({ fullReveal: false, quickDraw: false });
  const [tileHeatMap, setTileHeatMap] = useState<Map<string, number>>(new Map());

  const hotStreakRef = useRef(0);
  const milestoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxPossibleScore = enabled
    ? computeMaxPossible(puzzle.actor, puzzle.character, normalize, isGuessable)
    : 0;

  const letterCloud = enabled
    ? buildLetterCloud(puzzle.actor, puzzle.character, revealed, wrongGuesses, normalize, isGuessable)
    : EMPTY_CLOUD;

  const onCorrectGuess = useCallback((letter: string, matchCount: number, timeRemaining: number, guessTime: number) => {
    if (!enabled) return;

    // Base points
    let pts = matchCount * PTS_PER_OCCURRENCE;

    // Speed bonus
    const elapsed = guessTime - timeRemaining;
    if (elapsed <= 2) pts += PTS_SPEED_FAST;
    else if (elapsed <= 4) pts += PTS_SPEED_MED;

    // Quick draw check
    if (elapsed <= 2) setHadQuickDraw(true);

    // Streak
    const newStreak = hotStreakRef.current + 1;
    hotStreakRef.current = newStreak;
    setHotStreak(newStreak);
    setPeakHotStreak(prev => Math.max(prev, newStreak));

    // Streak bonus (based on streak BEFORE this guess, i.e. newStreak - 1)
    if (newStreak > 1) {
      pts += PTS_STREAK_MULT * (newStreak - 1);
    }

    // Check milestones
    if (newStreak === 3 || newStreak === 5 || newStreak === 7) {
      if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current);
      setStreakMilestone(newStreak);
      milestoneTimerRef.current = setTimeout(() => {
        setStreakMilestone(null);
        milestoneTimerRef.current = null;
      }, 2400);
    }

    setScore(prev => prev + pts);
  }, [enabled]);

  const onWrongGuess = useCallback(() => {
    if (!enabled) return;
    hotStreakRef.current = 0;
    setHotStreak(0);
    setScore(prev => Math.max(0, prev - PTS_WRONG_PENALTY));
  }, [enabled]);

  const onTimeout = useCallback(() => {
    if (!enabled) return;
    hotStreakRef.current = 0;
    setHotStreak(0);
  }, [enabled]);

  const onSolveModeEntered = useCallback(() => {
    if (!enabled) return;
    setUsedSolveMode(true);
  }, [enabled]);

  const onGameEnd = useCallback((solved: boolean) => {
    if (!enabled) return;
    if (solved && !usedSolveMode) {
      setScore(prev => prev + PTS_NO_SOLVE);
    }
    setBadges({
      fullReveal: solved && !usedSolveMode,
      quickDraw: hadQuickDraw,
    });
  }, [enabled, usedSolveMode, hadQuickDraw]);

  const setTileHeat = useCallback((posKey: string, intensity: number) => {
    if (!enabled) return;
    setTileHeatMap(prev => {
      const n = new Map(prev);
      n.set(posKey, intensity);
      return n;
    });
  }, [enabled]);

  const clearTileHeat = useCallback(() => {
    if (!enabled) return;
    setTileHeatMap(new Map());
  }, [enabled]);

  const reset = useCallback(() => {
    setScore(0);
    setHotStreak(0);
    hotStreakRef.current = 0;
    setPeakHotStreak(0);
    setStreakMilestone(null);
    setUsedSolveMode(false);
    setHadQuickDraw(false);
    setBadges({ fullReveal: false, quickDraw: false });
    setTileHeatMap(new Map());
    if (milestoneTimerRef.current) {
      clearTimeout(milestoneTimerRef.current);
      milestoneTimerRef.current = null;
    }
  }, []);

  if (!enabled) return NOOP_STATE;

  return {
    score,
    maxPossibleScore,
    hotStreak,
    peakHotStreak,
    streakMilestone,
    badges,
    tileHeatMap,
    letterCloud,
    onCorrectGuess,
    onWrongGuess,
    onTimeout,
    onSolveModeEntered,
    onGameEnd,
    setTileHeat,
    clearTileHeat,
    reset,
  };
}
