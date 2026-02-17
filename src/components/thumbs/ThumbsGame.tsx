"use client";

import { useEffect, useRef, useState } from "react";
import { AttemptsList } from "@/components/thumbs/AttemptsList";
import { ResultReveal } from "@/components/thumbs/ResultReveal";
import { ThumbsPicker } from "@/components/thumbs/ThumbsPicker";
import { RatingEntry, ThumbAttempt, ThumbValue } from "@/lib/types";

const MAX_ATTEMPTS = 6;
const STATS_STORAGE_KEY = "moviegames:thumbs:stats";

type GameMode = "random" | "daily";
type GameStatus = "playing" | "won" | "lost";

type ThumbsStats = {
  played: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  lastResult: "win" | "loss" | null;
  lastPlayedDate: string | null;
  lastMode: GameMode | null;
  lastPuzzleKey: string | null;
};

type ThumbsGameProps = {
  movie: RatingEntry;
  puzzleKey: string;
  mode: GameMode;
};

const EMPTY_STATS: ThumbsStats = {
  played: 0,
  wins: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastResult: null,
  lastPlayedDate: null,
  lastMode: null,
  lastPuzzleKey: null
};

function nyDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

function readStats(): ThumbsStats {
  if (typeof window === "undefined") {
    return EMPTY_STATS;
  }

  const rawValue = window.localStorage.getItem(STATS_STORAGE_KEY);
  if (!rawValue) {
    return EMPTY_STATS;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<ThumbsStats>;
    return {
      played: parsed.played ?? 0,
      wins: parsed.wins ?? 0,
      currentStreak: parsed.currentStreak ?? 0,
      bestStreak: parsed.bestStreak ?? 0,
      lastResult: parsed.lastResult ?? null,
      lastPlayedDate: parsed.lastPlayedDate ?? null,
      lastMode: parsed.lastMode ?? null,
      lastPuzzleKey: parsed.lastPuzzleKey ?? null
    };
  } catch {
    return EMPTY_STATS;
  }
}

function writeStats(stats: ThumbsStats): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
}

export function ThumbsGame({ movie, puzzleKey, mode }: ThumbsGameProps) {
  const [siskel, setSiskel] = useState<ThumbValue | null>(null);
  const [ebert, setEbert] = useState<ThumbValue | null>(null);
  const [attempts, setAttempts] = useState<ThumbAttempt[]>([]);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [message, setMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<ThumbsStats>(EMPTY_STATS);
  const hasRecorded = useRef(false);

  useEffect(() => {
    setSiskel(null);
    setEbert(null);
    setAttempts([]);
    setStatus("playing");
    setMessage(null);
    hasRecorded.current = false;
    setStats(readStats());
  }, [puzzleKey]);

  useEffect(() => {
    if (status === "playing" || hasRecorded.current) {
      return;
    }

    hasRecorded.current = true;
    const currentStats = readStats();

    if (currentStats.lastPuzzleKey === puzzleKey) {
      setStats(currentStats);
      return;
    }

    const won = status === "won";
    const nextStreak = won ? currentStats.currentStreak + 1 : 0;
    const nextStats: ThumbsStats = {
      played: currentStats.played + 1,
      wins: currentStats.wins + (won ? 1 : 0),
      currentStreak: nextStreak,
      bestStreak: Math.max(currentStats.bestStreak, nextStreak),
      lastResult: won ? "win" : "loss",
      lastPlayedDate: nyDateKey(),
      lastMode: mode,
      lastPuzzleKey: puzzleKey
    };

    writeStats(nextStats);
    setStats(nextStats);
  }, [mode, puzzleKey, status]);

  const attemptsRemaining = MAX_ATTEMPTS - attempts.length;
  const canSubmit = status === "playing" && siskel !== null && ebert !== null;

  function submitGuess() {
    if (status !== "playing") {
      return;
    }

    if (siskel === null || ebert === null) {
      setMessage("Pick both critics before submitting.");
      return;
    }

    setMessage(null);

    const nextAttempt: ThumbAttempt = {
      siskel,
      ebert,
      siskelCorrect: siskel === movie.siskel_thumb,
      ebertCorrect: ebert === movie.ebert_thumb
    };

    const nextAttempts = [...attempts, nextAttempt];
    setAttempts(nextAttempts);

    if (nextAttempt.siskelCorrect && nextAttempt.ebertCorrect) {
      setStatus("won");
      return;
    }

    if (nextAttempts.length >= MAX_ATTEMPTS) {
      setStatus("lost");
      return;
    }

    setSiskel(null);
    setEbert(null);
  }

  return (
    <div className="space-y-4 rounded-3xl border border-white/55 bg-white/78 p-5 shadow-card backdrop-blur sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-ink/65">
          {mode === "daily" ? "Daily Puzzle" : "Random Puzzle"}
        </p>
        <p className="text-sm font-medium text-ink/75">{attemptsRemaining} tries left</p>
      </div>

      <ThumbsPicker
        siskel={siskel}
        ebert={ebert}
        onSiskelChange={setSiskel}
        onEbertChange={setEbert}
        disabled={status !== "playing"}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submitGuess}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
        >
          Submit Guess
        </button>
        {message ? <p className="text-sm font-medium text-warn">{message}</p> : null}
      </div>

      <AttemptsList attempts={attempts} maxAttempts={MAX_ATTEMPTS} />

      {status !== "playing" ? <ResultReveal movie={movie} won={status === "won"} /> : null}

      <section className="rounded-2xl border border-ink/15 bg-white/88 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink/70">Stats</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-ink/12 bg-ink/5 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-ink/55">Played</p>
            <p className="mt-1 text-lg font-semibold text-ink">{stats.played}</p>
          </div>
          <div className="rounded-xl border border-ink/12 bg-ink/5 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-ink/55">Wins</p>
            <p className="mt-1 text-lg font-semibold text-ink">{stats.wins}</p>
          </div>
          <div className="rounded-xl border border-ink/12 bg-ink/5 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-ink/55">Streak</p>
            <p className="mt-1 text-lg font-semibold text-ink">{stats.currentStreak}</p>
          </div>
          <div className="rounded-xl border border-ink/12 bg-ink/5 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.12em] text-ink/55">Best</p>
            <p className="mt-1 text-lg font-semibold text-ink">{stats.bestStreak}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
