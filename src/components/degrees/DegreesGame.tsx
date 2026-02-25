"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Drama, Film, Share2, Star, Check } from "lucide-react";
import { DegreesPuzzle, DegreesChainPiece, getNyDateKey } from "@/lib/dailyUtils";
import { saveGameResult } from "@/lib/saveResult";
import { logGameEvent, trackEvent } from "@/lib/analytics";
import { DegreesPlaytestResult } from "@/lib/playtest";
import { useFeedbackContext } from "@/components/FeedbackContext";

// ─── Daily streak persistence ───
const DAILY_STORAGE_KEY = "moviegames:degrees:daily";

type DegreesHistoryEntry = {
  dateKey: string;
  puzzleNumber: number;
  solved: boolean;
  attempts: number;
  timeSecs: number;
};

type DailyStreakData = {
  lastPlayedDate: string | null;
  dailyStreak: number;
  bestDailyStreak: number;
  history: DegreesHistoryEntry[];
};

const EMPTY_STREAK: DailyStreakData = { lastPlayedDate: null, dailyStreak: 0, bestDailyStreak: 0, history: [] };

function readDailyStreak(): DailyStreakData {
  if (typeof window === "undefined") return EMPTY_STREAK;
  try {
    const raw = window.localStorage.getItem(DAILY_STORAGE_KEY);
    if (!raw) return EMPTY_STREAK;
    const parsed = JSON.parse(raw) as Partial<DailyStreakData>;
    return {
      lastPlayedDate: parsed.lastPlayedDate ?? null,
      dailyStreak: parsed.dailyStreak ?? 0,
      bestDailyStreak: parsed.bestDailyStreak ?? 0,
      history: parsed.history ?? [],
    };
  } catch {
    return EMPTY_STREAK;
  }
}

function writeDailyStreak(data: DailyStreakData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(data));
}

function isYesterday(dateStr: string, todayStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 1);
  const next = d.toISOString().slice(0, 10);
  return next === todayStr;
}

// ─── Shuffle ───
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Constants ───
const MAX_ATTEMPTS = 3;

type Props = {
  puzzle: DegreesPuzzle;
  puzzleNumber: number;
  dateKey: string;
  playtestMode?: boolean;
  onPlaytestComplete?: (result: DegreesPlaytestResult) => void;
};

type Screen = "start" | "playing" | "solved" | "failed";

function TypeIcon({ type, className = "" }: { type: "movie" | "actor"; className?: string }) {
  if (type === "movie") return <Film className={`w-3.5 h-3.5 ${className}`} />;
  return <Drama className={`w-3.5 h-3.5 ${className}`} />;
}

/** Color palette per piece type — green for movies, blue for actors */
function typeColors(type: "movie" | "actor") {
  if (type === "movie") return {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    icon: "text-emerald-400",
    dashedBorder: "border-emerald-500/50",
    dashedBg: "bg-emerald-500/5",
    dashedIcon: "text-emerald-500/50",
    line: "bg-emerald-500/40",
    poolBorder: "border-emerald-700/60",
    poolBg: "bg-emerald-950/40",
    poolHoverBorder: "hover:border-emerald-500/60",
    poolHoverBg: "hover:bg-emerald-900/40",
    poolIcon: "text-emerald-500",
  };
  return {
    border: "border-sky-500/40",
    bg: "bg-sky-500/10",
    icon: "text-sky-400",
    dashedBorder: "border-sky-500/50",
    dashedBg: "bg-sky-500/5",
    dashedIcon: "text-sky-500/50",
    line: "bg-sky-500/40",
    poolBorder: "border-sky-700/60",
    poolBg: "bg-sky-950/40",
    poolHoverBorder: "hover:border-sky-500/60",
    poolHoverBg: "hover:bg-sky-900/40",
    poolIcon: "text-sky-500",
  };
}

export default function DegreesGame({ puzzle, puzzleNumber, dateKey, playtestMode, onPlaytestComplete }: Props) {
  const [screen, setScreen] = useState<Screen>("start");
  const [slots, setSlots] = useState<(DegreesChainPiece | null)[]>(Array(puzzle.chain.length).fill(null));
  const [pool, setPool] = useState<DegreesChainPiece[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);
  const [justPlaced, setJustPlaced] = useState(-1);
  const [toast, setToast] = useState<string | null>(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSlots = puzzle.chain.length;
  const allFilled = slots.every(Boolean);
  const isOver = screen === "solved" || screen === "failed";
  const degrees = puzzle.chain.filter(c => c.type === "movie").length;

  const { setGameContext } = useFeedbackContext();
  useEffect(() => {
    setGameContext({
      game: "degrees", puzzleNumber, dateKey, degrees, screen,
    });
    return () => setGameContext(null);
  }, [puzzleNumber, dateKey, degrees, screen, setGameContext]);

  // Check if already played today
  useEffect(() => {
    if (playtestMode) return;
    const streak = readDailyStreak();
    if (streak.history.some(h => h.dateKey === dateKey)) {
      setAlreadyPlayed(true);
    }
  }, [dateKey, playtestMode]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const startGame = useCallback(() => {
    const allPieces = [...puzzle.chain, ...puzzle.herrings];
    setPool(seededShuffle(allPieces, puzzleNumber + 42));
    setSlots(Array(totalSlots).fill(null));
    setAttempts(0);
    setLastScore(null);
    setTimer(0);
    setJustPlaced(-1);
    setToast(null);
    setScreen("playing");
  }, [puzzle, puzzleNumber, totalSlots]);

  // Auto-start in playtest mode
  useEffect(() => {
    if (playtestMode && screen === "start") startGame();
  }, [playtestMode, screen, startGame]);

  // Timer
  useEffect(() => {
    if (screen === "playing") {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen]);

  const saveResult = useCallback((solved: boolean, finalAttempts: number) => {
    if (playtestMode) {
      onPlaytestComplete?.({
        puzzleIndex: puzzleNumber - 1,
        startActor: puzzle.start.name,
        endActor: puzzle.end.name,
        chainLength: puzzle.chain.length,
        solved,
        mistakes: finalAttempts,
        hints: 0,
        timeSecs: timer,
      });
      return;
    }

    // Save to localStorage
    const today = getNyDateKey(new Date());
    const streak = readDailyStreak();
    if (streak.history.some(h => h.dateKey === dateKey)) return;

    let newStreak = 1;
    if (streak.lastPlayedDate === today) {
      newStreak = streak.dailyStreak;
    } else if (streak.lastPlayedDate && isYesterday(streak.lastPlayedDate, today)) {
      newStreak = streak.dailyStreak + 1;
    }

    const updated: DailyStreakData = {
      lastPlayedDate: today,
      dailyStreak: newStreak,
      bestDailyStreak: Math.max(streak.bestDailyStreak, newStreak),
      history: [...streak.history, {
        dateKey,
        puzzleNumber,
        solved,
        attempts: finalAttempts,
        timeSecs: timer,
      }],
    };
    writeDailyStreak(updated);

    // Save to Supabase
    saveGameResult({
      game: "degrees",
      dateKey,
      solved,
      mistakes: finalAttempts,
      hints: 0,
      timeSecs: timer,
    });

    // Anonymous analytics (all users, no auth required)
    logGameEvent("degrees", dateKey, {
      puzzleIndex: puzzleNumber,
      solved,
      mistakes: finalAttempts,
      timeSecs: timer,
      chainLength: puzzle.chain.length,
    });
    trackEvent("game_completed", { game: "degrees", solved, mistakes: finalAttempts, time_secs: timer });
  }, [dateKey, puzzleNumber, timer, playtestMode, onPlaytestComplete, puzzle]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Tap a pool piece → place in first empty slot
  const handlePoolTap = (piece: DegreesChainPiece) => {
    if (screen !== "playing") return;
    const emptyIdx = slots.findIndex(s => s === null);
    if (emptyIdx === -1) return;
    const newSlots = [...slots];
    newSlots[emptyIdx] = piece;
    setSlots(newSlots);
    setPool(prev => prev.filter(p => p.id !== piece.id));
    setJustPlaced(emptyIdx);
    setTimeout(() => setJustPlaced(-1), 400);
  };

  // Tap a filled slot → return piece to pool
  const handleSlotTap = (index: number) => {
    if (screen !== "playing") return;
    const piece = slots[index];
    if (!piece) return;
    const newSlots = [...slots];
    newSlots[index] = null;
    setSlots(newSlots);
    setPool(prev => [...prev, piece]);
  };

  // Solve — check all slots at once
  const handleSolve = () => {
    if (!allFilled || screen !== "playing") return;
    const correctCount = slots.filter((s, i) => s && s.id === puzzle.chain[i].id).length;
    const newAttempts = attempts + 1;

    if (correctCount === totalSlots) {
      if (timerRef.current) clearInterval(timerRef.current);
      setAttempts(newAttempts);
      setLastScore(correctCount);
      setTimeout(() => {
        setScreen("solved");
        saveResult(true, newAttempts);
      }, 500);
    } else if (newAttempts >= MAX_ATTEMPTS) {
      if (timerRef.current) clearInterval(timerRef.current);
      setAttempts(newAttempts);
      setLastScore(correctCount);
      setTimeout(() => {
        setScreen("failed");
        saveResult(false, newAttempts);
      }, 500);
    } else {
      setAttempts(newAttempts);
      setLastScore(correctCount);
      showToast(`${correctCount} of ${totalSlots} correct`);
    }
  };

  const starRating = attempts <= 1 ? 3 : attempts === 2 ? 2 : 1;

  // ─── START SCREEN ───
  if (screen === "start") {
    return (
      <div className="min-h-screen bg-cinematic">
        <div className="mx-auto max-w-md px-5 py-12 md:py-20">
          <div className="animate-fadeIn">
            <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              &larr; Back
            </Link>

            <div className="mt-10 text-center">
              <h1 className="font-display text-5xl font-extrabold tracking-tight text-zinc-100 mb-2">
                Degrees
              </h1>
              <p className="text-sm text-zinc-500">Connect the stars</p>
            </div>

            <div className="mt-10 space-y-5 text-sm text-zinc-400 leading-relaxed">
              <p>
                Build a chain of actors and movies that connects two stars. Some pieces are decoys &mdash; choose wisely.
              </p>
              <div className="space-y-3 text-[13px]">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Fill every slot from the pool, then hit <strong className="text-zinc-300">Solve</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>You&apos;ll learn how many are correct &mdash; but not which ones</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Solve in <strong className="text-zinc-300">3 attempts</strong> or fewer</span>
                </div>
              </div>
            </div>

            <div className="mt-10 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">Puzzle #{puzzleNumber}</p>
              <p className="text-lg font-bold text-zinc-100">
                {puzzle.start.name} <span className="text-amber-400">&rarr;</span> {puzzle.end.name}
              </p>
              <p className="text-xs text-zinc-500 mt-1">{degrees} degree{degrees !== 1 ? "s" : ""}</p>
            </div>

            {alreadyPlayed ? (
              <div className="mt-8 text-center">
                <p className="text-sm text-zinc-500 mb-3">You&apos;ve already played today&apos;s puzzle</p>
                <button
                  onClick={startGame}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm text-zinc-950 transition-all active:scale-[0.97] bg-amber-500 hover:bg-amber-400 cursor-pointer"
                >
                  Play Again
                </button>
              </div>
            ) : (
              <button
                onClick={startGame}
                className="mt-8 w-full py-3.5 rounded-xl font-semibold text-sm text-zinc-950 transition-all active:scale-[0.97] bg-amber-500 hover:bg-amber-400 cursor-pointer"
              >
                Play
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULTS SCREEN ───
  if (isOver) {
    const won = screen === "solved";
    const share = [
      `Degrees #${puzzleNumber}`,
      `${won ? "\u2B50".repeat(starRating) : "\u274C"} ${puzzle.start.name} \u2192 ${puzzle.end.name}`,
      `${degrees}\u00B0 \u00B7 ${fmt(timer)} \u00B7 ${attempts} attempt${attempts !== 1 ? "s" : ""}`,
      "",
      "movienight.games",
    ].join("\n");

    return (
      <div className="min-h-screen bg-cinematic">
        <div className="mx-auto max-w-md px-5 py-12 md:py-20">
          <div className="animate-fadeIn">
            <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
              &larr; Home
            </Link>

            <div className="mt-10 text-center">
              <h2 className="font-display text-3xl font-extrabold text-zinc-100 mb-1">
                {won ? "Connected!" : "Disconnected"}
              </h2>
              {won && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${i < starRating ? "text-amber-400 fill-amber-400" : "text-zinc-700"}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Solved chain */}
            <div className="mt-8 flex flex-col items-center">
              <EndpointPill name={puzzle.start.name} connected />
              {puzzle.chain.map((piece, i) => (
                <React.Fragment key={i}>
                  <ChainLine active pieceType={piece.type} />
                  <ChainPill piece={piece} />
                </React.Fragment>
              ))}
              <ChainLine active pieceType={puzzle.chain[puzzle.chain.length - 1]?.type} />
              <EndpointPill name={puzzle.end.name} connected />
            </div>

            {/* Stats */}
            <div className="mt-8 flex justify-center gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-zinc-100">{fmt(timer)}</p>
                <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">Time</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">{attempts}</p>
                <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">Attempt{attempts !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* Actions */}
            {playtestMode ? (
              <p className="mt-6 text-xs text-zinc-500 text-center animate-fadeIn">
                Game recorded. Advancing automatically&hellip;
              </p>
            ) : (
              <div className="mt-8 flex gap-3">
                <Link
                  href="/"
                  className="flex-1 py-3 rounded-xl font-semibold text-sm text-center border-2 border-amber-500/40 text-amber-400 hover:border-amber-500/60 transition-all"
                >
                  Home
                </Link>
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ text: share }).catch(() => {});
                    } else {
                      navigator.clipboard?.writeText(share);
                      showToast("Copied to clipboard");
                    }
                  }}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm text-zinc-950 bg-amber-500 hover:bg-amber-400 transition-all active:scale-[0.97] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── PLAYING SCREEN ───
  const emptyCount = slots.filter(s => s === null).length;

  return (
    <div className={`${playtestMode ? "h-full" : "h-screen"} bg-cinematic flex flex-col overflow-hidden relative`}>
      {/* Toast */}
      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-5 py-2 bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg animate-fadeIn shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="shrink-0 px-5 pt-4 pb-3 flex items-center justify-between border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            &larr;
          </Link>
          <h1 className="font-display text-lg font-bold text-zinc-100">Degrees</h1>
          <span className="text-[10px] text-zinc-600">#{puzzleNumber}</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Attempt dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i < attempts ? "bg-amber-500" : "bg-zinc-700"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-zinc-500 font-mono tabular-nums">{fmt(timer)}</span>
        </div>
      </div>

      {/* Chain area */}
      <div className="flex-1 px-5 overflow-y-auto min-h-0 flex flex-col items-center justify-center py-4">
        {/* Status line */}
        <p className="text-[11px] uppercase tracking-[0.15em] text-zinc-500 mb-3">
          {lastScore !== null ? (
            <><span className="text-amber-400 font-bold">{lastScore} of {totalSlots}</span> correct &mdash; {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? "s" : ""} left</>
          ) : emptyCount > 0 ? (
            <><span className="text-zinc-300 font-bold">{emptyCount}</span> slot{emptyCount !== 1 ? "s" : ""} to fill</>
          ) : (
            <span className="text-emerald-400 font-bold">Ready to solve</span>
          )}
        </p>

        <EndpointPill name={puzzle.start.name} connected={allFilled} />

        {puzzle.chain.map((correctPiece, i) => {
          const filled = slots[i];
          const isJust = justPlaced === i;
          const colors = typeColors(correctPiece.type);
          return (
            <React.Fragment key={i}>
              <ChainLine active={!!filled} pieceType={filled?.type ?? correctPiece.type} />
              <div className="w-full max-w-[300px] transition-all duration-200">
                {filled ? (
                  <button
                    onClick={() => handleSlotTap(i)}
                    className={`w-full px-4 py-2.5 rounded-xl text-center border transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] ${
                      isJust ? "scale-[1.03]" : ""
                    } ${typeColors(filled.type).border} ${typeColors(filled.type).bg}`}
                  >
                    <TypeIcon type={filled.type} className={typeColors(filled.type).icon} />
                    <p className="text-[14px] font-semibold text-zinc-100">
                      {filled.name}
                      {filled.year ? <span className="text-zinc-500 font-normal ml-1">({filled.year})</span> : ""}
                    </p>
                  </button>
                ) : (
                  <div
                    className={`px-4 py-2.5 rounded-xl text-center border border-dashed flex items-center justify-center gap-2 ${colors.dashedBorder} ${colors.dashedBg}`}
                  >
                    <TypeIcon type={correctPiece.type} className={colors.dashedIcon} />
                    <p className={`text-[13px] ${correctPiece.type === "movie" ? "text-emerald-500/60" : "text-sky-500/60"}`}>
                      {correctPiece.type === "movie" ? "Movie" : "Actor"}
                    </p>
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        <ChainLine active={allFilled} pieceType={puzzle.chain[totalSlots - 1]?.type} />
        <EndpointPill name={puzzle.end.name} connected={allFilled} />
      </div>

      {/* Pool + Solve */}
      <div className="shrink-0 border-t border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm">
        {/* Solve button — shows when all slots filled */}
        {allFilled && (
          <div className="px-4 pt-3 pb-1">
            <button
              onClick={handleSolve}
              className="w-full py-3 rounded-xl font-semibold text-sm text-zinc-950 bg-amber-500 hover:bg-amber-400 transition-all active:scale-[0.97] cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Solve (attempt {attempts + 1}/{MAX_ATTEMPTS})
            </button>
          </div>
        )}
        <div className="px-3 pb-3 pt-2">
          <div className="flex flex-wrap gap-1.5 justify-center max-w-md mx-auto">
            {pool.map(piece => (
              <button
                key={piece.id}
                onClick={() => handlePoolTap(piece)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all cursor-pointer active:scale-[0.95] ${typeColors(piece.type).poolBg} ${typeColors(piece.type).poolBorder} text-zinc-200 ${typeColors(piece.type).poolHoverBorder} ${typeColors(piece.type).poolHoverBg}`}
              >
                <TypeIcon type={piece.type} className={typeColors(piece.type).poolIcon} />
                {piece.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ───

function EndpointPill({ name, connected = false }: { name: string; connected?: boolean }) {
  const styles = connected
    ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
    : "border-zinc-700/50 bg-zinc-800/30 text-zinc-400";
  return (
    <div className={`w-full max-w-[300px] px-4 py-2.5 rounded-xl text-center border-2 transition-all duration-300 ${styles}`}>
      <p className="text-[14px] font-bold">{name}</p>
    </div>
  );
}

function ChainPill({ piece }: { piece: DegreesChainPiece }) {
  const c = typeColors(piece.type);
  return (
    <div className={`w-full max-w-[300px] px-4 py-2 rounded-xl text-center border ${c.border} ${c.bg} flex items-center justify-center gap-2`}>
      <TypeIcon type={piece.type} className={c.icon} />
      <p className="text-[13px] font-semibold text-zinc-100">
        {piece.name}
        {piece.year ? <span className="text-zinc-500 font-normal ml-1">({piece.year})</span> : ""}
      </p>
    </div>
  );
}

function ChainLine({ active = false, pieceType }: { active?: boolean; pieceType?: "movie" | "actor" }) {
  const activeBg = pieceType ? typeColors(pieceType).line : "bg-amber-500/40";
  return (
    <div className="flex justify-center">
      <div className={`w-0.5 h-4 transition-all ${active ? activeBg : "bg-zinc-800"}`} />
    </div>
  );
}
