"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import RolesGame from "@/components/roles/RolesGame";
import { ThumbWarsGame } from "@/components/thumbs/ThumbWarsGame";
import DegreesGame from "@/components/degrees/DegreesGame";
import PlaytestDashboard from "@/components/playtest/PlaytestDashboard";
import ThumbsPlaytestDashboard from "@/components/playtest/ThumbsPlaytestDashboard";
import DegreesPlaytestDashboard from "@/components/playtest/DegreesPlaytestDashboard";
import rolesPuzzlesData from "@/data/roles.json";
import degreesPuzzlesData from "@/data/degrees.json";
import ratingsData from "@/data/ratings.json";
import { RolesPuzzle, DegreesPuzzle } from "@/lib/dailyUtils";
import { RatingEntry, ThumbWarsMovie } from "@/lib/types";
import {
  PlaytestResult,
  ThumbsPlaytestResult,
  DegreesPlaytestResult,
  readPlaytestSession,
  writePlaytestSession,
  clearPlaytestSession,
} from "@/lib/playtest";

const rolesPuzzles = rolesPuzzlesData as RolesPuzzle[];
const degreesPuzzles = degreesPuzzlesData as DegreesPuzzle[];

// Build Thumbs rounds from ratings: 10 movies per round, no posters needed
const allRatings = (ratingsData as RatingEntry[]).filter(
  e => (e.ebert_thumb === 0 || e.ebert_thumb === 1) && (e.siskel_thumb === 0 || e.siskel_thumb === 1)
);
const THUMBS_ROUND_SIZE = 10;
const thumbsRounds: ThumbWarsMovie[][] = [];
for (let i = 0; i + THUMBS_ROUND_SIZE <= allRatings.length; i += THUMBS_ROUND_SIZE) {
  thumbsRounds.push(
    allRatings.slice(i, i + THUMBS_ROUND_SIZE).map(e => ({
      title: e.title,
      year: e.year,
      director: e.director,
      poster: "",
      siskel: e.siskel_thumb,
      ebert: e.ebert_thumb,
    }))
  );
}

type GameType = "roles" | "thumbs" | "degrees";

const GAME_LABELS: Record<GameType, string> = {
  roles: "ROLES",
  thumbs: "THUMBS",
  degrees: "DEGREES",
};

const PLAYTEST_KEY = "asdlkfjalhoeirwioeu32u49289slkh";

/* ─── Puzzle Selector Dropdown ──────────────────────────────────────────────── */

function PuzzleSelector({
  game,
  totalPuzzles,
  currentIndex,
  playedSet,
  rolesPuzzleList,
  degreesPuzzleList,
  onSelect,
}: {
  game: GameType;
  totalPuzzles: number;
  currentIndex: number;
  playedSet: Set<number>;
  rolesPuzzleList: RolesPuzzle[];
  degreesPuzzleList: DegreesPuzzle[];
  onSelect: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    return Array.from({ length: totalPuzzles }, (_, i) => i);
  }, [totalPuzzles]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(i => {
      if (game === "roles") {
        const p = rolesPuzzleList[i];
        return p?.actor.toLowerCase().includes(q) || p?.character.toLowerCase().includes(q) || p?.movie.toLowerCase().includes(q);
      }
      if (game === "degrees") {
        const p = degreesPuzzleList[i];
        return p?.start.name.toLowerCase().includes(q) || p?.end.name.toLowerCase().includes(q);
      }
      // thumbs: search by round number or movie titles
      const round = thumbsRounds[i];
      if (!round) return false;
      return round.some(m => m.title.toLowerCase().includes(q)) || `${i + 1}`.includes(q);
    });
  }, [items, query, game, rolesPuzzleList, degreesPuzzleList]);

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

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const getLabel = (i: number) => {
    if (game === "roles") {
      const p = rolesPuzzleList[i];
      return p ? `${p.actor} / ${p.character}` : `Puzzle ${i + 1}`;
    }
    if (game === "degrees") {
      const p = degreesPuzzleList[i];
      return p ? `${p.start.name} \u2192 ${p.end.name}` : `Puzzle ${i + 1}`;
    }
    const round = thumbsRounds[i];
    return round ? round.slice(0, 3).map(m => m.title).join(", ") + "..." : `Round ${i + 1}`;
  };

  const getSubLabel = (i: number) => {
    if (game === "roles") {
      const p = rolesPuzzleList[i];
      return p ? `${p.movie} (${p.year})` : "";
    }
    if (game === "degrees") {
      const p = degreesPuzzleList[i];
      return p ? `${p.chain.length} pieces` : "";
    }
    return `${THUMBS_ROUND_SIZE} movies`;
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-2.5 py-1 rounded text-[10px] font-medium bg-zinc-800 text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Go to&hellip;
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-80 bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="p-2 border-b border-zinc-800">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={game === "roles" ? "Search actor, character, or movie\u2026" : game === "degrees" ? "Search actor\u2026" : "Search movie\u2026"}
              className="w-full text-xs bg-zinc-800 border border-zinc-700/40 rounded px-2.5 py-1.5 text-zinc-200 placeholder-zinc-500 outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="overflow-y-auto max-h-64">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-zinc-500 text-center">No matches</div>
            ) : (
              filtered.map(index => {
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
                        <span className="text-zinc-200 truncate">{getLabel(index)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {played && <span className="text-[9px] text-emerald-500/70">played</span>}
                        {isCurrent && <span className="text-[9px] text-amber-400">current</span>}
                      </div>
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">{getSubLabel(index)}</div>
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

export default function PlaytestPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [game, setGame] = useState<GameType>(() => {
    if (typeof window === "undefined") return "roles";
    const saved = window.localStorage.getItem("moviegames:playtest:game");
    if (saved === "roles" || saved === "thumbs" || saved === "degrees") return saved;
    return "roles";
  });
  const [view, setView] = useState<"playing" | "dashboard">("playing");
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Per-game state
  const [rolesIndex, setRolesIndex] = useState(0);
  const [rolesResults, setRolesResults] = useState<PlaytestResult[]>([]);

  const [thumbsIndex, setThumbsIndex] = useState(0);
  const [thumbsResults, setThumbsResults] = useState<ThumbsPlaytestResult[]>([]);

  const [degreesIndex, setDegreesIndex] = useState(0);
  const [degreesResults, setDegreesResults] = useState<DegreesPlaytestResult[]>([]);

  // Access gate
  useEffect(() => {
    const host = window.location.hostname;
    const params = new URLSearchParams(window.location.search);
    setAllowed(host === "localhost" || host === "127.0.0.1" || params.get("key") === PLAYTEST_KEY);
  }, []);

  // Restore sessions from localStorage
  useEffect(() => {
    const rolesSession = readPlaytestSession();
    if (rolesSession.results.length > 0) {
      setRolesResults(rolesSession.results);
      setRolesIndex(Math.min(rolesSession.currentIndex, rolesPuzzles.length - 1));
    }
    const thumbsSession = readPlaytestSession<ThumbsPlaytestResult>("thumbs");
    if (thumbsSession.results.length > 0) {
      setThumbsResults(thumbsSession.results);
      setThumbsIndex(Math.min(thumbsSession.currentIndex, thumbsRounds.length - 1));
    }
    const degreesSession = readPlaytestSession<DegreesPlaytestResult>("degrees");
    if (degreesSession.results.length > 0) {
      setDegreesResults(degreesSession.results);
      setDegreesIndex(Math.min(degreesSession.currentIndex, degreesPuzzles.length - 1));
    }
  }, []);

  // Persist helpers
  const persistRoles = useCallback((results: PlaytestResult[], idx: number) => {
    writePlaytestSession({ results, currentIndex: idx, startedAt: new Date().toISOString() });
  }, []);

  const persistThumbs = useCallback((results: ThumbsPlaytestResult[], idx: number) => {
    writePlaytestSession({ results, currentIndex: idx, startedAt: new Date().toISOString() }, "thumbs");
  }, []);

  const persistDegrees = useCallback((results: DegreesPlaytestResult[], idx: number) => {
    writePlaytestSession({ results, currentIndex: idx, startedAt: new Date().toISOString() }, "degrees");
  }, []);

  // Current game state
  const currentIndex = game === "roles" ? rolesIndex : game === "thumbs" ? thumbsIndex : degreesIndex;
  const totalPuzzles = game === "roles" ? rolesPuzzles.length : game === "thumbs" ? thumbsRounds.length : degreesPuzzles.length;
  const resultsCount = game === "roles" ? rolesResults.length : game === "thumbs" ? thumbsResults.length : degreesResults.length;

  const playedSet = useMemo(() => {
    if (game === "roles") return new Set(rolesResults.map(r => r.puzzleIndex));
    if (game === "thumbs") return new Set(thumbsResults.map(r => r.puzzleIndex));
    return new Set(degreesResults.map(r => r.puzzleIndex));
  }, [game, rolesResults, thumbsResults, degreesResults]);

  // Complete handlers
  const handleRolesComplete = useCallback((result: PlaytestResult) => {
    setRolesResults(prev => {
      const existing = prev.findIndex(r => r.puzzleIndex === result.puzzleIndex);
      const updated = existing >= 0 ? prev.map((r, i) => i === existing ? result : r) : [...prev, result];
      if (autoAdvance && rolesIndex < rolesPuzzles.length - 1) {
        const next = rolesIndex + 1;
        setTimeout(() => setRolesIndex(next), 1500);
        persistRoles(updated, next);
      } else {
        persistRoles(updated, rolesIndex);
      }
      return updated;
    });
  }, [rolesIndex, autoAdvance, persistRoles]);

  const handleThumbsComplete = useCallback((result: ThumbsPlaytestResult) => {
    // Fix puzzleIndex to use current thumbsIndex
    const fixedResult = { ...result, puzzleIndex: thumbsIndex };
    setThumbsResults(prev => {
      const existing = prev.findIndex(r => r.puzzleIndex === fixedResult.puzzleIndex);
      const updated = existing >= 0 ? prev.map((r, i) => i === existing ? fixedResult : r) : [...prev, fixedResult];
      if (autoAdvance && thumbsIndex < thumbsRounds.length - 1) {
        const next = thumbsIndex + 1;
        setTimeout(() => setThumbsIndex(next), 1500);
        persistThumbs(updated, next);
      } else {
        persistThumbs(updated, thumbsIndex);
      }
      return updated;
    });
  }, [thumbsIndex, autoAdvance, persistThumbs]);

  const handleDegreesComplete = useCallback((result: DegreesPlaytestResult) => {
    setDegreesResults(prev => {
      const existing = prev.findIndex(r => r.puzzleIndex === result.puzzleIndex);
      const updated = existing >= 0 ? prev.map((r, i) => i === existing ? result : r) : [...prev, result];
      if (autoAdvance && degreesIndex < degreesPuzzles.length - 1) {
        const next = degreesIndex + 1;
        setTimeout(() => setDegreesIndex(next), 1500);
        persistDegrees(updated, next);
      } else {
        persistDegrees(updated, degreesIndex);
      }
      return updated;
    });
  }, [degreesIndex, autoAdvance, persistDegrees]);

  const handleSkip = () => {
    if (game === "roles" && rolesIndex < rolesPuzzles.length - 1) {
      const next = rolesIndex + 1;
      setRolesIndex(next);
      persistRoles(rolesResults, next);
    } else if (game === "thumbs" && thumbsIndex < thumbsRounds.length - 1) {
      const next = thumbsIndex + 1;
      setThumbsIndex(next);
      persistThumbs(thumbsResults, next);
    } else if (game === "degrees" && degreesIndex < degreesPuzzles.length - 1) {
      const next = degreesIndex + 1;
      setDegreesIndex(next);
      persistDegrees(degreesResults, next);
    }
  };

  const handleReset = () => {
    if (!confirm(`Clear all ${GAME_LABELS[game]} playtest data and start over?`)) return;
    if (game === "roles") { clearPlaytestSession(); setRolesResults([]); setRolesIndex(0); }
    if (game === "thumbs") { clearPlaytestSession("thumbs"); setThumbsResults([]); setThumbsIndex(0); }
    if (game === "degrees") { clearPlaytestSession("degrees"); setDegreesResults([]); setDegreesIndex(0); }
  };

  const jumpTo = (index: number) => {
    const clamped = Math.max(0, Math.min(index, totalPuzzles - 1));
    setView("playing");
    if (game === "roles") { setRolesIndex(clamped); persistRoles(rolesResults, clamped); }
    if (game === "thumbs") { setThumbsIndex(clamped); persistThumbs(thumbsResults, clamped); }
    if (game === "degrees") { setDegreesIndex(clamped); persistDegrees(degreesResults, clamped); }
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

  // Dashboard views
  if (view === "dashboard") {
    if (game === "roles") return <PlaytestDashboard results={rolesResults} totalPuzzles={rolesPuzzles.length} onBack={() => setView("playing")} />;
    if (game === "thumbs") return <ThumbsPlaytestDashboard results={thumbsResults} totalPuzzles={thumbsRounds.length} onBack={() => setView("playing")} />;
    return <DegreesPlaytestDashboard results={degreesResults} totalPuzzles={degreesPuzzles.length} onBack={() => setView("playing")} />;
  }

  // Puzzle info strip content
  const getPuzzleInfo = () => {
    if (game === "roles") {
      const p = rolesPuzzles[rolesIndex];
      return p ? (
        <>
          <span className="text-[10px] text-zinc-600">{p.movie} ({p.year})</span>
          {p.difficulty === "hard" && <span className="text-[10px] text-red-400/70 font-medium">HARD</span>}
        </>
      ) : null;
    }
    if (game === "degrees") {
      const p = degreesPuzzles[degreesIndex];
      return p ? (
        <span className="text-[10px] text-zinc-600">{p.start.name} &rarr; {p.end.name} &middot; {p.chain.length} pieces</span>
      ) : null;
    }
    // thumbs
    const round = thumbsRounds[thumbsIndex];
    return round ? (
      <span className="text-[10px] text-zinc-600">{round.length} movies</span>
    ) : null;
  };

  return (
    <div className="relative h-dvh bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-4 py-2 bg-zinc-900/80 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-amber-400 tracking-wider uppercase">Playtest</span>

          {/* Game selector dropdown */}
          <select
            value={game}
            onChange={e => { const g = e.target.value as GameType; setGame(g); setView("playing"); window.localStorage.setItem("moviegames:playtest:game", g); }}
            className="text-xs bg-zinc-800 border border-zinc-700/40 rounded px-2 py-1 text-zinc-200 cursor-pointer"
          >
            {(["roles", "thumbs", "degrees"] as GameType[]).map(g => (
              <option key={g} value={g}>{GAME_LABELS[g]}</option>
            ))}
          </select>

          <span className="text-xs text-zinc-500">
            {currentIndex + 1} of {totalPuzzles}
          </span>
          <span className="text-[10px] text-zinc-600">
            ({resultsCount} played)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)}
              className="accent-amber-500 w-3 h-3" />
            <span className="text-[10px] text-zinc-500">Auto-advance</span>
          </label>
          <PuzzleSelector
            game={game}
            totalPuzzles={totalPuzzles}
            currentIndex={currentIndex}
            playedSet={playedSet}
            rolesPuzzleList={rolesPuzzles}
            degreesPuzzleList={degreesPuzzles}
            onSelect={jumpTo}
          />
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
          style={{ width: `${(resultsCount / totalPuzzles) * 100}%` }} />
      </div>

      {/* Puzzle info strip */}
      <div className="relative z-20 flex items-center justify-between px-4 py-1.5 bg-zinc-900/40 border-b border-zinc-800/30">
        <div className="flex items-center gap-3">
          {getPuzzleInfo()}
          {playedSet.has(currentIndex) && <span className="text-[10px] text-emerald-500/70">Already played</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => currentIndex > 0 && jumpTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="px-2 py-0.5 rounded text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30 cursor-pointer disabled:cursor-default">
            &larr;
          </button>
          <input type="number" min={1} max={totalPuzzles} value={currentIndex + 1}
            onChange={e => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPuzzles) jumpTo(v - 1); }}
            className="w-12 text-center text-xs bg-zinc-800 border border-zinc-700/40 rounded px-1 py-0.5 text-zinc-300" />
          <button onClick={() => currentIndex < totalPuzzles - 1 && jumpTo(currentIndex + 1)}
            disabled={currentIndex === totalPuzzles - 1}
            className="px-2 py-0.5 rounded text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30 cursor-pointer disabled:cursor-default">
            &rarr;
          </button>
        </div>
      </div>

      {/* Game area */}
      <div className="flex-1 overflow-hidden">
        {game === "roles" && rolesPuzzles[rolesIndex] && (
          <RolesGame
            key={`roles-${rolesIndex}`}
            puzzle={rolesPuzzles[rolesIndex]}
            puzzleNumber={rolesIndex + 1}
            dateKey={`playtest-${rolesIndex}`}
            playtestMode
            onPlaytestComplete={handleRolesComplete}
          />
        )}

        {game === "thumbs" && thumbsRounds[thumbsIndex] && (
          <ThumbWarsGame
            key={`thumbs-${thumbsIndex}`}
            movies={thumbsRounds[thumbsIndex]}
            mode="daily"
            dateKey={`playtest-thumbs-${thumbsIndex}`}
            puzzleNumber={thumbsIndex}
            playtestMode
            onPlaytestComplete={handleThumbsComplete}
          />
        )}

        {game === "degrees" && degreesPuzzles[degreesIndex] && (
          <DegreesGame
            key={`degrees-${degreesIndex}`}
            puzzle={degreesPuzzles[degreesIndex]}
            puzzleNumber={degreesIndex + 1}
            dateKey={`playtest-degrees-${degreesIndex}`}
            playtestMode
            onPlaytestComplete={handleDegreesComplete}
          />
        )}
      </div>
    </div>
  );
}
