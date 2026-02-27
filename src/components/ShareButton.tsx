"use client";

import { useState, useEffect } from "react";
import { Share2, Copy, Check } from "lucide-react";

export default function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const handleShare = async () => {
    if (canShare) {
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
      className={`flex-1 py-3 rounded-xl text-sm font-medium tracking-wide transition-all active:scale-[0.97] cursor-pointer inline-flex items-center justify-center gap-1.5 ${
        copied
          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
          : "bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 hover:bg-zinc-700/60"
      }`}>
      {copied ? <Check className="w-3.5 h-3.5" /> : canShare ? <Share2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : canShare ? "Share" : "Copy Results"}
    </button>
  );
}
