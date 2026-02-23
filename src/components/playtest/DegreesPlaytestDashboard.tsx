"use client";

import { DegreesPlaytestResult } from "@/lib/playtest";
import { useState, useMemo } from "react";

type SortKey = "puzzleIndex" | "startActor" | "endActor" | "solved" | "timeSecs" | "mistakes" | "hints" | "chainLength";

export default function DegreesPlaytestDashboard({ results, totalPuzzles, onBack }: {
  results: DegreesPlaytestResult[];
  totalPuzzles: number;
  onBack: () => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("puzzleIndex");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterSolved, setFilterSolved] = useState<"all" | "solved" | "failed">("all");
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(totalPuzzles);

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
  const avgMistakes = ranged.length > 0 ? ranged.reduce((s, r) => s + r.mistakes, 0) / ranged.length : 0;
  const avgHints = ranged.length > 0 ? ranged.reduce((s, r) => s + r.hints, 0) / ranged.length : 0;

  // Distributions
  const mistakeDist = [0, 1, 2, 3].map(s => ranged.filter(r => r.mistakes === s).length);
  const maxMistakeDist = Math.max(...mistakeDist, 1);

  const hintDist = [0, 1, 2, 3].map(s => ranged.filter(r => r.hints === s).length);
  const maxHintDist = Math.max(...hintDist, 1);

  const timeBuckets = [
    { label: "0-30s", count: ranged.filter(r => r.timeSecs < 30).length },
    { label: "30-60s", count: ranged.filter(r => r.timeSecs >= 30 && r.timeSecs < 60).length },
    { label: "60-90s", count: ranged.filter(r => r.timeSecs >= 60 && r.timeSecs < 90).length },
    { label: "90-120s", count: ranged.filter(r => r.timeSecs >= 90 && r.timeSecs < 120).length },
    { label: "120s+", count: ranged.filter(r => r.timeSecs >= 120).length },
  ];
  const maxTimeBucket = Math.max(...timeBuckets.map(b => b.count), 1);

  // Solve rate by chain length
  const chainBrackets = [3, 5, 7].map(len => {
    const matching = ranged.filter(r => r.chainLength === len);
    const solvedCount = matching.filter(r => r.solved).length;
    return { label: `${len} pieces`, total: matching.length, solved: solvedCount, rate: matching.length > 0 ? solvedCount / matching.length * 100 : 0 };
  });
  // Catch-all for other lengths
  const otherLengths = ranged.filter(r => ![3, 5, 7].includes(r.chainLength));
  if (otherLengths.length > 0) {
    const solvedOther = otherLengths.filter(r => r.solved).length;
    chainBrackets.push({ label: "Other", total: otherLengths.length, solved: solvedOther, rate: otherLengths.length > 0 ? solvedOther / otherLengths.length * 100 : 0 });
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.round(s % 60).toString().padStart(2, "0")}`;
  const arrow = (key: SortKey) => sortKey === key ? (sortAsc ? " \u2191" : " \u2193") : "";
  const isFullRange = rangeFrom === 1 && rangeTo === totalPuzzles;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              DEGREES Playtest Dashboard
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
                    { v: avgMistakes.toFixed(1), l: "Avg Mistakes" },
                    { v: avgHints.toFixed(1), l: "Avg Hints" },
                  ].map((s, i) => (
                    <div key={i} className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-zinc-100">{s.v}</p>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">{s.l}</p>
                    </div>
                  ))}
                </div>

                {/* Charts Grid */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  {/* Mistakes Distribution */}
                  <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-zinc-300 mb-4">Mistakes Distribution</h3>
                    <div className="flex items-end gap-3 h-32">
                      {mistakeDist.map((count, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-zinc-400">{count}</span>
                          <div className="w-full rounded-t bg-amber-500/70" style={{ height: `${(count / maxMistakeDist) * 100}%`, minHeight: count > 0 ? 4 : 0 }} />
                          <span className="text-xs text-zinc-500">{i}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Hints Distribution */}
                  <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-zinc-300 mb-4">Hints Used Distribution</h3>
                    <div className="flex items-end gap-3 h-32">
                      {hintDist.map((count, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-zinc-400">{count}</span>
                          <div className="w-full rounded-t bg-emerald-500/70" style={{ height: `${(count / maxHintDist) * 100}%`, minHeight: count > 0 ? 4 : 0 }} />
                          <span className="text-xs text-zinc-500">{i}</span>
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

                  {/* Solve Rate by Chain Length */}
                  <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-zinc-300 mb-4">Solve Rate by Chain Length</h3>
                    <div className="space-y-3">
                      {chainBrackets.map((b, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-400">{b.label}</span>
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
                            ["startActor", "Start"],
                            ["endActor", "End"],
                            ["chainLength", "Chain"],
                            ["solved", "Result"],
                            ["timeSecs", "Time"],
                            ["mistakes", "Mistakes"],
                            ["hints", "Hints"],
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
                            <td className="px-3 py-2.5 text-zinc-200 font-medium whitespace-nowrap">{r.startActor}</td>
                            <td className="px-3 py-2.5 text-zinc-200 whitespace-nowrap">{r.endActor}</td>
                            <td className="px-3 py-2.5 text-zinc-300 tabular-nums">{r.chainLength}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.solved ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                                {r.solved ? "Solved" : "Failed"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-zinc-300 tabular-nums">{fmt(r.timeSecs)}</td>
                            <td className="px-3 py-2.5 text-zinc-300 tabular-nums">{r.mistakes}/3</td>
                            <td className="px-3 py-2.5 text-zinc-300 tabular-nums">{r.hints}/3</td>
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
