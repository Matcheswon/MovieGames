"use client";

import { PlaytestResult } from "@/lib/playtest";
import { useState, useMemo } from "react";

type SortKey = "puzzleIndex" | "actor" | "movie" | "solved" | "timeSecs" | "strikes" | "roundsUsed" | "letterCount" | "uniqueLetterCount";

export default function PlaytestDashboard({ results, totalPuzzles, onBack }: {
  results: PlaytestResult[];
  totalPuzzles: number;
  onBack: () => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("puzzleIndex");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterSolved, setFilterSolved] = useState<"all" | "solved" | "failed">("all");
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(totalPuzzles);

  // Range-filtered results (all stats/charts derive from this)
  const ranged = useMemo(() => {
    return results.filter(r => (r.puzzleIndex + 1) >= rangeFrom && (r.puzzleIndex + 1) <= rangeTo);
  }, [results, rangeFrom, rangeTo]);

  const filtered = useMemo(() => {
    let r = [...ranged];
    if (filterSolved === "solved") r = r.filter(x => x.solved);
    if (filterSolved === "failed") r = r.filter(x => !x.solved);
    r.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "boolean") return sortAsc ? (av === bv ? 0 : av ? -1 : 1) : (av === bv ? 0 : av ? 1 : -1);
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return r;
  }, [ranged, sortKey, sortAsc, filterSolved]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const solved = ranged.filter(r => r.solved);
  const solveRate = ranged.length > 0 ? (solved.length / ranged.length * 100) : 0;
  const avgTime = ranged.length > 0 ? ranged.reduce((s, r) => s + r.timeSecs, 0) / ranged.length : 0;
  const avgStrikes = ranged.length > 0 ? ranged.reduce((s, r) => s + r.strikes, 0) / ranged.length : 0;
  const avgRounds = ranged.length > 0 ? ranged.reduce((s, r) => s + r.roundsUsed, 0) / ranged.length : 0;

  // Distributions
  const strikeDist = [0, 1, 2, 3].map(s => ranged.filter(r => r.strikes === s).length);
  const maxRoundsPlayed = Math.max(...ranged.map(r => r.roundsUsed), 8);
  const roundDist = Array.from({ length: maxRoundsPlayed }, (_, i) => ranged.filter(r => r.roundsUsed === i + 1).length);
  const maxStrikeDist = Math.max(...strikeDist, 1);
  const maxRoundDist = Math.max(...roundDist, 1);

  // Time buckets (0-30, 30-60, 60-90, 90-120, 120+)
  const timeBuckets = [
    { label: "0-30s", count: ranged.filter(r => r.timeSecs < 30).length },
    { label: "30-60s", count: ranged.filter(r => r.timeSecs >= 30 && r.timeSecs < 60).length },
    { label: "60-90s", count: ranged.filter(r => r.timeSecs >= 60 && r.timeSecs < 90).length },
    { label: "90-120s", count: ranged.filter(r => r.timeSecs >= 90 && r.timeSecs < 120).length },
    { label: "120s+", count: ranged.filter(r => r.timeSecs >= 120).length },
  ];
  const maxTimeBucket = Math.max(...timeBuckets.map(b => b.count), 1);

  // Solve rate by letter count bracket
  const letterBrackets = [
    { label: "< 15", filter: (r: PlaytestResult) => r.letterCount < 15 },
    { label: "15-20", filter: (r: PlaytestResult) => r.letterCount >= 15 && r.letterCount < 20 },
    { label: "20-25", filter: (r: PlaytestResult) => r.letterCount >= 20 && r.letterCount < 25 },
    { label: "25+", filter: (r: PlaytestResult) => r.letterCount >= 25 },
  ].map(b => {
    const matching = ranged.filter(b.filter);
    const solvedCount = matching.filter(r => r.solved).length;
    return { label: b.label, total: matching.length, solved: solvedCount, rate: matching.length > 0 ? solvedCount / matching.length * 100 : 0 };
  });

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.round(s % 60).toString().padStart(2, "0")}`;
  const arrow = (key: SortKey) => sortKey === key ? (sortAsc ? " \u2191" : " \u2193") : "";

  const isFullRange = rangeFrom === 1 && rangeTo === totalPuzzles;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              ROLES Playtest Dashboard
            </h1>
            <p className="text-sm text-zinc-500 mt-1">{results.length} of {totalPuzzles} puzzles played</p>
          </div>
          <button onClick={onBack}
            className="px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-all active:scale-[0.97] cursor-pointer">
            Back to Games
          </button>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <p className="text-lg mb-2">No data yet</p>
            <p className="text-sm">Play some puzzles first, then check back here.</p>
          </div>
        ) : (
          <>
            {/* Range Filter */}
            <div className="flex items-center gap-3 mb-6 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Games</span>
              <input type="number" min={1} max={rangeTo} value={rangeFrom}
                onChange={e => { const v = parseInt(e.target.value); if (v >= 1 && v <= rangeTo) setRangeFrom(v); }}
                className="w-16 text-center text-sm bg-zinc-800 border border-zinc-700/40 rounded-lg px-2 py-1.5 text-zinc-200 tabular-nums" />
              <span className="text-zinc-600">&ndash;</span>
              <input type="number" min={rangeFrom} max={totalPuzzles} value={rangeTo}
                onChange={e => { const v = parseInt(e.target.value); if (v >= rangeFrom && v <= totalPuzzles) setRangeTo(v); }}
                className="w-16 text-center text-sm bg-zinc-800 border border-zinc-700/40 rounded-lg px-2 py-1.5 text-zinc-200 tabular-nums" />
              {!isFullRange && (
                <>
                  <span className="text-xs text-zinc-500">({ranged.length} played in range)</span>
                  <button onClick={() => { setRangeFrom(1); setRangeTo(totalPuzzles); }}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer ml-1">
                    Reset
                  </button>
                </>
              )}
            </div>

            {ranged.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <p className="text-sm">No games played in this range yet.</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                  {[
                    { v: `${ranged.length}${!isFullRange ? `/${rangeTo - rangeFrom + 1}` : `/${totalPuzzles}`}`, l: "Played" },
                    { v: `${solveRate.toFixed(0)}%`, l: "Solve Rate" },
                    { v: fmt(avgTime), l: "Avg Time" },
                    { v: avgStrikes.toFixed(1), l: "Avg Strikes" },
                    { v: avgRounds.toFixed(1), l: "Avg Rounds" },
                  ].map((s, i) => (
                    <div key={i} className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-zinc-100">{s.v}</p>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">{s.l}</p>
                    </div>
                  ))}
                </div>

                {/* Charts Grid */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  {/* Strikes Distribution */}
                  <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-zinc-300 mb-4">Strikes Distribution</h3>
                    <div className="flex items-end gap-3 h-32">
                      {strikeDist.map((count, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-zinc-400">{count}</span>
                          <div className="w-full rounded-t bg-amber-500/70" style={{ height: `${(count / maxStrikeDist) * 100}%`, minHeight: count > 0 ? 4 : 0 }} />
                          <span className="text-xs text-zinc-500">{i}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rounds Distribution */}
                  <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-zinc-300 mb-4">Rounds Used Distribution</h3>
                    <div className="flex items-end gap-2 h-32">
                      {roundDist.map((count, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-zinc-400">{count}</span>
                          <div className="w-full rounded-t bg-emerald-500/70" style={{ height: `${(count / maxRoundDist) * 100}%`, minHeight: count > 0 ? 4 : 0 }} />
                          <span className="text-xs text-zinc-500">{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Time Distribution */}
                  <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-zinc-300 mb-4">Time Distribution</h3>
                    <div className="flex items-end gap-3 h-32">
                      {timeBuckets.map((b, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-zinc-400">{b.count}</span>
                          <div className="w-full rounded-t bg-sky-500/70" style={{ height: `${(b.count / maxTimeBucket) * 100}%`, minHeight: b.count > 0 ? 4 : 0 }} />
                          <span className="text-[10px] text-zinc-500">{b.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Solve Rate by Letter Count */}
                  <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-zinc-300 mb-4">Solve Rate by Letter Count</h3>
                    <div className="space-y-3">
                      {letterBrackets.map((b, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-400">{b.label} letters</span>
                            <span className="text-zinc-500">{b.solved}/{b.total} ({b.rate.toFixed(0)}%)</span>
                          </div>
                          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500/70 rounded-full transition-all" style={{ width: `${b.rate}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Filter tabs */}
                <div className="flex gap-2 mb-4">
                  {(["all", "solved", "failed"] as const).map(f => (
                    <button key={f} onClick={() => setFilterSolved(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        filterSolved === f
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-zinc-900/40 text-zinc-500 border border-zinc-800/40 hover:text-zinc-300"
                      }`}>
                      {f === "all" ? `All (${ranged.length})` : f === "solved" ? `Solved (${solved.length})` : `Failed (${ranged.length - solved.length})`}
                    </button>
                  ))}
                </div>

                {/* Results Table */}
                <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800/40">
                          {([
                            ["puzzleIndex", "#"],
                            ["actor", "Actor"],
                            ["movie", "Movie"],
                            ["solved", "Result"],
                            ["timeSecs", "Time"],
                            ["strikes", "Strikes"],
                            ["roundsUsed", "Rounds"],
                            ["letterCount", "Letters"],
                            ["uniqueLetterCount", "Unique"],
                          ] as [SortKey, string][]).map(([key, label]) => (
                            <th key={key} onClick={() => handleSort(key)}
                              className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap select-none">
                              {label}{arrow(key)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r) => (
                          <tr key={r.puzzleIndex} className="border-b border-zinc-800/20 hover:bg-zinc-800/20 transition-colors">
                            <td className="px-3 py-2.5 text-zinc-500">{r.puzzleIndex + 1}</td>
                            <td className="px-3 py-2.5 text-zinc-200 font-medium whitespace-nowrap">{r.actor}</td>
                            <td className="px-3 py-2.5 text-zinc-400 whitespace-nowrap">{r.movie} ({r.year})</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.solved ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                                {r.solved ? "Solved" : "Failed"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-zinc-300 tabular-nums">{fmt(r.timeSecs)}</td>
                            <td className="px-3 py-2.5 text-zinc-300 tabular-nums">{r.strikes}/3</td>
                            <td className="px-3 py-2.5 text-zinc-300 tabular-nums">{r.roundsUsed}</td>
                            <td className="px-3 py-2.5 text-zinc-300 tabular-nums">{r.letterCount}</td>
                            <td className="px-3 py-2.5 text-zinc-300 tabular-nums">{r.uniqueLetterCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
