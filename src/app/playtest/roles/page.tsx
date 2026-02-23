"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

/* ─── Puzzle Selector Dropdown ──────────────────────────────────────────────── */

function PuzzleSelector({
  puzzles,
  currentIndex,
  results,
  onSelect,
}: {
  puzzles: RolesPuzzle[];
  currentIndex: number;
  results: PlaytestResult[];
  onSelect: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const playedSet = useMemo(() => new Set(results.map(r => r.puzzleIndex)), [results]);

  const filtered = useMemo(() => {
    if (!query.trim()) return puzzles.map((p, i) => ({ puzzle: p, index: i }));
    const q = query.toLowerCase();
    return puzzles
      .map((p, i) => ({ puzzle: p, index: i }))
      .filter(({ puzzle }) =>
        puzzle.actor.toLowerCase().includes(q) ||
        puzzle.character.toLowerCase().includes(q) ||
        puzzle.movie.toLowerCase().includes(q)
      );
  }, [puzzles, query]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-2.5 py-1 rounded text-[10px] font-medium bg-zinc-800 text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Go to…
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-80 bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="p-2 border-b border-zinc-800">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search actor, character, or movie…"
              className="w-full text-xs bg-zinc-800 border border-zinc-700/40 rounded px-2.5 py-1.5 text-zinc-200 placeholder-zinc-500 outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="overflow-y-auto max-h-64">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-zinc-500 text-center">No matches</div>
            ) : (
              filtered.map(({ puzzle, index }) => {
                const played = playedSet.has(index);
                const isCurrent = index === currentIndex;
                return (
                  <button
                    key={index}
                    onClick={() => { onSelect(index); setOpen(false); setQuery(""); }}
                    className={`w-full text-left px-3 py-2 text-xs border-b border-zinc-800/50 hover:bg-zinc-800/80 transition-colors cursor-pointer ${
                      isCurrent ? "bg-amber-500/10" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-zinc-400 mr-1.5">#{index + 1}</span>
                        <span className="text-zinc-200">{puzzle.actor}</span>
                        <span className="text-zinc-600 mx-1">/</span>
                        <span className="text-zinc-300">{puzzle.character}</span>
                        {puzzle.difficulty === "hard" && (
                          <span className="ml-1.5 text-[9px] text-red-400/70 font-medium">HARD</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {played && <span className="text-[9px] text-emerald-500/70">played</span>}
                        {isCurrent && <span className="text-[9px] text-amber-400">current</span>}
                      </div>
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">{puzzle.movie} ({puzzle.year})</div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Playtest Page ────────────────────────────────────────────────────── */

export default function PlaytestRolesPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [view, setView] = useState<"playing" | "dashboard">("playing");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<PlaytestResult[]>([]);
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Access gate: localhost OR secret key in URL
  const PLAYTEST_KEY = "asdlkfjalhoeirwioeu32u49289slkh";
  useEffect(() => {
    const host = window.location.hostname;
    const params = new URLSearchParams(window.location.search);
    setAllowed(host === "localhost" || host === "127.0.0.1" || params.get("key") === PLAYTEST_KEY);
  }, []);

  // Restore session from localStorage (clamp index to valid range)
  useEffect(() => {
    const session = readPlaytestSession();
    if (session.results.length > 0) {
      setResults(session.results);
      setCurrentIndex(Math.min(session.currentIndex, puzzles.length - 1));
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
    const clamped = Math.max(0, Math.min(index, puzzles.length - 1));
    setCurrentIndex(clamped);
    setView("playing");
    persist(results, clamped);
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
          <PuzzleSelector puzzles={puzzles} currentIndex={currentIndex} results={results} onSelect={jumpTo} />
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
      {puzzle && (
        <div className="relative z-20 flex items-center justify-between px-4 py-1.5 bg-zinc-900/40 border-b border-zinc-800/30">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-600">{puzzle.movie} ({puzzle.year})</span>
            {puzzle.difficulty === "hard" && (
              <span className="text-[10px] text-red-400/70 font-medium">HARD (10 rounds)</span>
            )}
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
      )}

      {/* Game */}
      <div className="flex-1 overflow-hidden">
        {puzzle ? (
          <RolesGame
            key={currentIndex}
            puzzle={puzzle}
            puzzleNumber={currentIndex + 1}
            dateKey={`playtest-${currentIndex}`}
            playtestMode
            onPlaytestComplete={handleComplete}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
            No puzzle at this index. Use the selector above to pick a puzzle.
          </div>
        )}
      </div>
    </div>
  );
}
