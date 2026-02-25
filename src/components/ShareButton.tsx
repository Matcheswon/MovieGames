"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

export default function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {}
    }
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleShare}
      className="flex-1 py-3 rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 text-sm font-medium tracking-wide hover:bg-zinc-700/60 transition-all active:scale-[0.97] cursor-pointer inline-flex items-center justify-center gap-1.5">
      <Share2 className="w-3.5 h-3.5" />
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
