"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X, Send, CheckCircle } from "lucide-react";
import { useFeedbackContext } from "./FeedbackContext";
import { submitFeedback } from "@/app/feedback/actions";

const CATEGORIES = ["Bug Report", "Puzzle Feedback", "General Feedback"] as const;

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [message, setMessage] = useState("");

  const { gameContext } = useFeedbackContext();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function reset() {
    setMessage("");
    setError(null);
    setSent(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    setError(null);

    const result = await submitFeedback({
      email: email || undefined,
      category,
      message,
      pageUrl: typeof window !== "undefined" ? window.location.pathname : undefined,
      gameContext,
    });

    setSending(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 2000);
    }
  }

  const pathname = usePathname();

  // Hide on admin pages and during active gameplay
  if (pathname.startsWith("/admin")) return null;
  const isPlaying = gameContext?.screen === "playing";
  if (isPlaying && !open) return null;

  return (
    <div ref={panelRef} className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3">
      {/* Panel */}
      {open && (
        <div
          className="w-80 animate-slideUp rounded-2xl border border-zinc-800/60 bg-zinc-900 shadow-2xl shadow-black/60 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
            <span className="text-sm font-semibold text-zinc-200">Send Feedback</span>
            <button
              onClick={() => { setOpen(false); reset(); }}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
              <p className="text-sm text-zinc-300">Thanks for your feedback!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
              {/* Email */}
              <input
                type="email"
                placeholder="Email (optional, for replies)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-800/60 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/40 transition-colors"
              />

              {/* Category */}
              <div className="flex gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      category === cat
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        : "bg-zinc-800/50 text-zinc-500 border border-zinc-800/40 hover:text-zinc-400"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Game context indicator */}
              {gameContext && (
                <div className="rounded-lg bg-zinc-800/30 px-3 py-2 text-xs text-zinc-500">
                  <span className="text-zinc-400">Puzzle info will be included:</span>{" "}
                  {gameContext.game as string}{gameContext.puzzleNumber ? ` #${gameContext.puzzleNumber}` : ""}
                </div>
              )}

              {/* Message */}
              <textarea
                required
                rows={3}
                placeholder="What's on your mind?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full resize-none rounded-lg border border-zinc-800/60 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/40 transition-colors"
              />

              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="flex items-center justify-center gap-2 rounded-lg bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Send Feedback
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => { setOpen(!open); if (!open) reset(); }}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800/60 bg-zinc-900 text-zinc-400 shadow-lg shadow-black/40 transition-all hover:border-amber-500/40 hover:text-amber-400 hover:shadow-amber-500/10"
      >
        {open ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
      </button>
    </div>
  );
}
