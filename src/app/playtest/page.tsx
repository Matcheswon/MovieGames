"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { readPlaytestSession } from "@/lib/playtest";
import { ThumbsPlaytestResult, DegreesPlaytestResult } from "@/lib/playtest";

const PLAYTEST_KEY = "asdlkfjalhoeirwioeu32u49289slkh";

const GAMES = [
  { key: "roles", label: "Roles", href: "/playtest/roles", description: "Guess the actor from the character name, letter by letter" },
  { key: "thumbs", label: "Thumb Wars", href: "/playtest/thumbs", description: "Did Siskel & Ebert give it a thumbs up or down?" },
  { key: "degrees", label: "Degrees", href: "/playtest/degrees", description: "Connect two actors through shared movies" },
] as const;

export default function PlaytestHubPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    const host = window.location.hostname;
    const params = new URLSearchParams(window.location.search);
    setAllowed(host === "localhost" || host === "127.0.0.1" || params.get("key") === PLAYTEST_KEY);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const rolesSession = readPlaytestSession();
    const thumbsSession = readPlaytestSession<ThumbsPlaytestResult>("thumbs");
    const degreesSession = readPlaytestSession<DegreesPlaytestResult>("degrees");
    setStats({
      roles: rolesSession.results.length,
      thumbs: thumbsSession.results.length,
      degrees: degreesSession.results.length,
    });
  }, [allowed]);

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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <h1 className="text-2xl font-bold text-amber-400 tracking-wider uppercase mb-2">Playtest</h1>
      <p className="text-sm text-zinc-500 mb-8">Choose a game to playtest</p>

      <div className="grid gap-4 w-full max-w-md">
        {GAMES.map(g => (
          <Link
            key={g.key}
            href={g.href}
            className="block p-4 rounded-lg bg-zinc-900 border border-zinc-800/60 hover:border-amber-500/40 hover:bg-zinc-900/80 transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-zinc-200 group-hover:text-amber-400 transition-colors uppercase tracking-wider">
                {g.label}
              </span>
              {(stats[g.key] ?? 0) > 0 && (
                <span className="text-[10px] text-zinc-500">{stats[g.key]} played</span>
              )}
            </div>
            <p className="text-xs text-zinc-500">{g.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
