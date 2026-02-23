"use client";

import { ThumbsPlaytestResult } from "@/lib/playtest";
import { useState, useMemo } from "react";

type SortKey = "puzzleIndex" | "score" | "outOf" | "perfectRounds" | "timeSecs";

export default function ThumbsPlaytestDashboard({ results, totalPuzzles, onBack }: {
  results: ThumbsPlaytestResult[];
  totalPuzzles: number;
  onBack: () => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("puzzleIndex");
  const [sortAsc, setSortAsc] = useState(true);
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(totalPuzzles);

  const ranged = useMemo(() => {
    return results.filter(r => (r.puzzleIndex + 1) >= rangeFrom && (r.puzzleIndex + 1) <= rangeTo);
  }, [results, rangeFrom, rangeTo]);

  const filtered = useMemo(() => {
    const r = [...ranged];
    r.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return r;
  }, [ranged, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const avgScore = ranged.length > 0 ? ranged.reduce((s, r) => s + r.score, 0) / ranged.length : 0;
  const avgOutOf = ranged.length > 0 ? ranged.reduce((s, r) => s + r.outOf, 0) / ranged.length : 0;
  const avgPct = avgOutOf > 0 ? (avgScore / avgOutOf * 100) : 0;
  const avgTime = ranged.length > 0 ? ranged.reduce((s, r) => s + r.timeSecs, 0) / ranged.length : 0;
  const avgPerfect = ranged.length > 0 ? ranged.reduce((s, r) => s + r.perfectRounds, 0) / ranged.length : 0;

  // Score percentage distribution
  const scoreBuckets = [
    { label: "0-50%", count: ranged.filter(r => (r.score / r.outOf) < 0.5).length },
    { label: "50-70%", count: ranged.filter(r => { const p = r.score / r.outOf; return p >= 0.5 && p < 0.7; }).length },
    { label: "70-90%", count: ranged.filter(r => { const p = r.score / r.outOf; return p >= 0.7 && p < 0.9; }).length },
    { label: "90-100%", count: ranged.filter(r => (r.score / r.outOf) >= 0.9).length },
  ];
  const maxScoreBucket = Math.max(...scoreBuckets.map(b => b.count), 1);

  // Perfect rounds distribution
  const maxPerfectRounds = Math.max(...ranged.map(r => r.perfectRounds), 0);
  const perfectDist = Array.from({ length: maxPerfectRounds + 1 }, (_, i) => ranged.filter(r => r.perfectRounds === i).length);
  const maxPerfectDist = Math.max(...perfectDist, 1);

  const timeBuckets = [
    { label: "0-30s", count: ranged.filter(r => r.timeSecs < 30).length },
    { label: "30-60s", count: ranged.filter(r => r.timeSecs >= 30 && r.timeSecs < 60).length },
    { label: "60-90s", count: ranged.filter(r => r.timeSecs >= 60 && r.timeSecs < 90).length },
    { label: "90-120s", count: ranged.filter(r => r.timeSecs >= 90 && r.timeSecs < 120).length },
    { label: "120s+", count: ranged.filter(r => r.timeSecs >= 120).length },
  ];
  const maxTimeBucket = Math.max(...timeBuckets.map(b => b.count), 1);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.round(s % 60).toString().padStart(2, "0")}`;
  const arrow = (key: SortKey) => sortKey === key ? (sortAsc ? " \u2191" : " \u2193") : "";
  const isFullRange = rangeFrom === 1 && rangeTo === totalPuzzles;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              THUMBS Playtest Dashboard
            </h1>
            <p className="text-sm text-zinc-500 mt-1">{results.length} of {totalPuzzles} rounds played</p>
          </div>
          <button onClick={onBack}
            className="px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 font-bold text-sm hover:bg-amber-400 transition-all active:scale-[0.97] cursor-pointer">
            Back to Games
          </button>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <p className="text-lg mb-2">No data yet</p>
            <p className="text-sm">Play some rounds first, then check back here.</p>
          </div>
        ) : (
          <>
            {/* Range Filter */}
            <div className="flex items-center gap-3 mb-6 bg-zinc-900/40 border border-zinc-800/40 rounded-xl px-4 py-3">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Rounds</span>
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
                <p className="text-sm">No rounds played in this range yet.</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                  {[
                    { v: `${ranged.length}${!isFullRange ? `/${rangeTo - rangeFrom + 1}` : `/${totalPuzzles}`}`, l: "Played" },
                    { v: `${avgPct.toFixed(0)}%`, l: "Avg Score" },
                    { v: fmt(avgTime), l: "Avg Time" },
                    { v: avgPerfect.toFixed(1), l: "Avg Perfect" },
                    { v: `${avgScore.toFixed(1)}/${avgOutOf.toFixed(0)}`, l: "Avg Correct" },
                  ].map((s, i) => (
                    <div key={i} className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-zinc-100">{s.v}</p>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">{s.l}</p>
                    </div>
                  ))}
                </div>

                {/* Charts Grid */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  {/* Score Distribution */}
                  <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-zinc-300 mb-4">Score Distribution</h3>
                    <div className="flex items-end gap-3 h-32">
                      {scoreBuckets.map((b, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-zinc-400">{b.count}</span>
                          <div className="w-full rounded-t bg-amber-500/70" style={{ height: `${(b.count / maxScoreBucket) * 100}%`, minHeight: b.count > 0 ? 4 : 0 }} />
                          <span className="text-[10px] text-zinc-500">{b.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Perfect Rounds Distribution */}
                  <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-zinc-300 mb-4">Perfect Rounds Distribution</h3>
                    <div className="flex items-end gap-2 h-32">
                      {perfectDist.map((count, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-zinc-400">{count}</span>
                          <div className="w-full rounded-t bg-emerald-500/70" style={{ height: `${(count / maxPerfectDist) * 100}%`, minHeight: count > 0 ? 4 : 0 }} />
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
                </div>

                {/* Results Table */}
                <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800/40">
                          {([
                            ["puzzleIndex", "#"],
                            ["score", "Score"],
                            ["outOf", "Out Of"],
                            ["perfectRounds", "Perfect"],
                            ["timeSecs", "Time"],
                          ] as [SortKey, string][]).map(([key, label]) => (
                            <th key={key} onClick={() => handleSort(key)}
                              className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap select-none">
                              {label}{arrow(key)}
                            </th>
                          ))}
                          <th className="px-3 py-3 text-left text-[10px] uppercase tracking-widest text-zinc-500 font-medium whitespace-nowrap">
                            Movies
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r) => {
                          const pct = r.outOf > 0 ? Math.round(r.score / r.outOf * 100) : 0;
                          return (
                            <tr key={r.puzzleIndex} className="border-b border-zinc-800/20 hover:bg-zinc-800/20 transition-colors">
                              <td className="px-3 py-2.5 text-zinc-500">{r.puzzleIndex + 1}</td>
                              <td className="px-3 py-2.5 text-zinc-200 font-medium tabular-nums">{r.score}/{r.outOf} ({pct}%)</td>
                              <td className="px-3 py-2.5 text-zinc-300 tabular-nums">{r.outOf}</td>
                              <td className="px-3 py-2.5 text-zinc-300 tabular-nums">{r.perfectRounds}</td>
                              <td className="px-3 py-2.5 text-zinc-300 tabular-nums">{fmt(r.timeSecs)}</td>
                              <td className="px-3 py-2.5 text-zinc-400 text-xs truncate max-w-[200px]">{r.movies.join(", ")}</td>
                            </tr>
                          );
                        })}
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
