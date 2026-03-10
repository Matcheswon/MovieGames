"use client";

import { useState, useEffect } from "react";
import { getNyDateKey } from "@/lib/dailyUtils";
import { Check, Trophy } from "lucide-react";

const STORAGE_KEYS: Record<string, string> = {
  thumbs: "moviegames:thumbwars:daily",
  roles: "moviegames:roles:daily",
};

const TOTAL_GAMES = Object.keys(STORAGE_KEYS).length;

function getPlayedGames(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const today = getNyDateKey(new Date());
  const played = new Set<string>();

  for (const [game, key] of Object.entries(STORAGE_KEYS)) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data.history?.some((h: { dateKey: string }) => h.dateKey === today)) {
        played.add(game);
      }
    } catch {
      /* ignore */
    }
  }

  return played;
}

/** Small "Done" badge to overlay on a game card when today's puzzle is complete. */
export function PlayedBadge({ game }: { game: string }) {
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    setPlayed(getPlayedGames().has(game));
  }, [game]);

  if (!played) return null;

  return (
    <span className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2 py-0.5 ml-2">
      <Check className="w-3 h-3 text-emerald-400" />
      <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
        Done
      </span>
    </span>
  );
}

/** Progress banner showing daily completion across all games. */
export function DailyTripleBanner() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(getPlayedGames().size);
  }, []);

  if (count === 0) return null;

  const allDone = count >= TOTAL_GAMES;

  return (
    <div
      className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border mb-6 transition-all ${
        allDone
          ? "bg-amber-500/10 border-amber-500/30"
          : "bg-zinc-900/50 border-zinc-800/50"
      }`}
    >
      {allDone ? (
        <>
          <Trophy className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-bold text-amber-400">
            Daily Double Complete!
          </p>
        </>
      ) : (
        <>
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_GAMES }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i < count ? "bg-emerald-400" : "bg-zinc-700"
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-zinc-400">
            <span className="text-zinc-200 font-bold">{count}/{TOTAL_GAMES}</span> daily
            games complete
          </p>
        </>
      )}
    </div>
  );
}
