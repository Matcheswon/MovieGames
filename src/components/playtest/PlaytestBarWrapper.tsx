"use client";

import { useState, ReactNode } from "react";

export default function PlaytestBarWrapper({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="absolute top-2 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-700/50 text-[10px] font-bold text-amber-400/80 uppercase tracking-wider hover:text-amber-300 hover:border-zinc-600 transition-all cursor-pointer backdrop-blur-sm shadow-lg flex items-center gap-1.5"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        Playtest
      </button>
    );
  }

  return (
    <div className="relative">
      {children}
      <button
        onClick={() => setHidden(true)}
        className="absolute top-2 right-2 z-30 p-1 rounded text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
        title="Hide playtest bar"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
