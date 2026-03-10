"use client";

import React from "react";

export default function TopNav({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-800/40 bg-zinc-950/60 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl px-5 md:px-8 flex justify-end items-center gap-3 h-12">
        {children}
      </div>
    </div>
  );
}
