"use client";

import { useState, useEffect } from "react";

function getSecsUntilMidnightET(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0");
  const totalSecs = get("hour") * 3600 + get("minute") * 60 + get("second");
  return Math.max(0, 86400 - totalSecs);
}

export default function NextPuzzleCountdown() {
  const [secs, setSecs] = useState<number | null>(null);

  useEffect(() => {
    setSecs(getSecsUntilMidnightET());
    const id = setInterval(() => setSecs(getSecsUntilMidnightET()), 1000);
    return () => clearInterval(id);
  }, []);

  if (secs === null) return null;

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  return (
    <div className="text-center py-4 mt-5 border-t border-zinc-800/40">
      <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-600 mb-1.5">
        Next puzzle in
      </p>
      <p className="text-2xl font-bold text-zinc-300 font-mono tabular-nums tracking-wider">
        {h}:{m.toString().padStart(2, "0")}:{s.toString().padStart(2, "0")}
      </p>
    </div>
  );
}
