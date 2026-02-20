"use client";

import { useState, useEffect, useCallback } from "react";
import RolesGame from "@/components/roles/RolesGame";
import PlaytestDashboard from "@/components/playtest/PlaytestDashboard";
import puzzlesData from "@/data/roles.json";
import { RolesPuzzle } from "@/lib/dailyUtils";
import {
  PlaytestResult,
  readPlaytestSession,
  writePlaytestSession,
  clearPlaytestSession,
} from "@/lib/playtest";

const puzzles = puzzlesData as RolesPuzzle[];

export default function PlaytestRolesPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [view, setView] = useState<"playing" | "dashboard">("playing");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<PlaytestResult[]>([]);
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Localhost gate
  useEffect(() => {
    const host = window.location.hostname;
    setAllowed(host === "localhost" || host === "127.0.0.1");
  }, []);

  // Restore session from localStorage
  useEffect(() => {
    const session = readPlaytestSession();
    if (session.results.length > 0) {
      setResults(session.results);
      setCurrentIndex(session.currentIndex);
    }
  }, []);

  const persist = useCallback((newResults: PlaytestResult[], newIndex: number) => {
    writePlaytestSession({
      results: newResults,
      currentIndex: newIndex,
      startedAt: new Date().toISOString(),
    });
  }, []);

  const handleComplete = useCallback((result: PlaytestResult) => {
    setResults(prev => {
      const existing = prev.findIndex(r => r.puzzleIndex === result.puzzleIndex);
      const updated = existing >= 0
        ? prev.map((r, i) => i === existing ? result : r)
        : [...prev, result];

      if (autoAdvance && currentIndex < puzzles.length - 1) {
        const nextIndex = currentIndex + 1;
        setTimeout(() => setCurrentIndex(nextIndex), 1500);
        persist(updated, nextIndex);
      } else {
        persist(updated, currentIndex);
      }
      return updated;
    });
  }, [currentIndex, autoAdvance, persist]);

  const handleSkip = () => {
    if (currentIndex < puzzles.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      persist(results, next);
    }
  };

  const handleReset = () => {
    if (confirm("Clear all playtest data and start over?")) {
      clearPlaytestSession();
      setResults([]);
      setCurrentIndex(0);
    }
  };

  const jumpTo = (index: number) => {
    setCurrentIndex(index);
    setView("playing");
    persist(results, index);
  };

  if (allowed === null) return null;

  if (!allowed) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center"
        style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Development Only</h1>
          <p className="text-zinc-500">This page is only available on localhost.</p>
        </div>
      </div>
    );
  }

  if (view === "dashboard") {
    return <PlaytestDashboard results={results} totalPuzzles={puzzles.length} onBack={() => setView("playing")} />;
  }

  const puzzle = puzzles[currentIndex];
  if (!puzzle) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">All puzzles complete!</h1>
          <button onClick={() => setView("dashboard")}
            className="mt-4 px-6 py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold cursor-pointer">
            View Dashboard
          </button>
        </div>
      </div>
    );
  }

  const playedThis = results.some(r => r.puzzleIndex === currentIndex);

  return (
    <div className="relative h-dvh bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-amber-400 tracking-wider uppercase">Playtest</span>
          <span className="text-xs text-zinc-500">
            Puzzle {currentIndex + 1} of {puzzles.length}
          </span>
          <span className="text-[10px] text-zinc-600">
            ({results.length} played)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)}
              className="accent-amber-500 w-3 h-3" />
            <span className="text-[10px] text-zinc-500">Auto-advance</span>
          </label>
          <button onClick={handleSkip}
            className="px-2.5 py-1 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
            Skip
          </button>
          <button onClick={() => setView("dashboard")}
            className="px-2.5 py-1 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
            Dashboard
          </button>
          <button onClick={handleReset}
            className="px-2.5 py-1 rounded text-[10px] font-medium bg-zinc-800 text-red-400/70 hover:text-red-300 transition-colors cursor-pointer">
            Reset
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-zinc-800">
        <div className="h-full bg-amber-500/60 transition-all duration-300"
          style={{ width: `${(results.length / puzzles.length) * 100}%` }} />
      </div>

      {/* Puzzle info strip */}
      <div className="relative z-20 flex items-center justify-between px-4 py-1.5 bg-zinc-900/40 border-b border-zinc-800/30">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-600">{puzzle.movie} ({puzzle.year})</span>
          {playedThis && <span className="text-[10px] text-emerald-500/70">Already played</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => currentIndex > 0 && jumpTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="px-2 py-0.5 rounded text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30 cursor-pointer disabled:cursor-default">
            &larr;
          </button>
          <input type="number" min={1} max={puzzles.length} value={currentIndex + 1}
            onChange={e => { const v = parseInt(e.target.value); if (v >= 1 && v <= puzzles.length) jumpTo(v - 1); }}
            className="w-12 text-center text-xs bg-zinc-800 border border-zinc-700/40 rounded px-1 py-0.5 text-zinc-300" />
          <button onClick={() => currentIndex < puzzles.length - 1 && jumpTo(currentIndex + 1)}
            disabled={currentIndex === puzzles.length - 1}
            className="px-2 py-0.5 rounded text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30 cursor-pointer disabled:cursor-default">
            &rarr;
          </button>
        </div>
      </div>

      {/* Game */}
      <div className="flex-1 overflow-hidden">
        <RolesGame
          key={currentIndex}
          puzzle={puzzle}
          puzzleNumber={currentIndex + 1}
          dateKey={`playtest-${currentIndex}`}
          playtestMode
          maxRounds={10}
          onPlaytestComplete={handleComplete}
        />
      </div>
    </div>
  );
}
