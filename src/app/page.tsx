import Link from "next/link";
import { games } from "@/lib/games";
import { GameDefinition } from "@/lib/types";
import AuthButton from "@/components/AuthButton";

function GameCard({ game }: { game: GameDefinition }) {
  const isLive = game.status === "live";
  const isPreview = game.status === "preview";

  return (
    <Link
      href={isLive || isPreview ? game.href : "#"}
      className={`group relative block overflow-hidden rounded-2xl border transition-all duration-300 ${
        isLive
          ? "border-zinc-800/60 bg-zinc-900/50 hover:border-amber-500/30 hover:bg-zinc-900/70"
          : "border-zinc-800/30 bg-zinc-900/25 opacity-60"
      }`}
      aria-disabled={!isLive && !isPreview}
      tabIndex={!isLive && !isPreview ? -1 : 0}
    >
      {isLive && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.08),transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      )}
      <div className="relative p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
            isLive ? "text-amber-500/70" : isPreview ? "text-zinc-600" : "text-zinc-700"
          }`}>
            {isLive ? "Play Now" : isPreview ? "Preview" : "Coming Soon"}
          </span>
        </div>
        <h2 className="font-display text-2xl md:text-3xl font-bold text-zinc-100 leading-none flex items-center gap-2">
          {game.icon && <span>{game.icon}</span>}
          {game.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          {game.description}
        </p>
        {isLive && (
          <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400 group-hover:text-amber-300 transition-colors">
            Play
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-cinematic">
      <div className="mx-auto max-w-4xl px-5 md:px-8 py-12 md:py-20">
        {/* Auth */}
        <div className="flex justify-end mb-6 animate-fadeIn">
          <AuthButton />
        </div>

        {/* Header */}
        <div className="text-center mb-12 md:mb-16 animate-fadeIn">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <div className="w-2 h-2 rounded-full bg-amber-500/60" />
            <div className="w-2 h-2 rounded-full bg-amber-500/30" />
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-extrabold tracking-tight mb-2">
            <span className="text-amber-400">Movie</span><span className="text-zinc-300">Games</span>
          </h1>
          <p className="text-sm md:text-base text-zinc-500 max-w-md mx-auto">
            Test your movie knowledge with fast-paced trivia games about the films you love.
          </p>
        </div>

        {/* Featured Game */}
        <div className="mb-6 animate-fadeIn" style={{ animationDelay: "0.1s" }}>
          <Link
            href="/games/thumbs/daily"
            className="group relative block overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/50 hover:border-amber-500/40 transition-all duration-300"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.1),transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative p-8 md:p-10 md:flex md:items-center md:justify-between md:gap-8">
              <div className="flex-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-500/70">Featured</span>
                <h2 className="mt-2 font-display text-3xl md:text-5xl font-extrabold text-zinc-100 leading-none flex items-center gap-3">
                  <span>{"\u{1F44D}"}</span> THUMBS
                </h2>
                <p className="mt-3 text-sm md:text-base text-zinc-400 max-w-lg leading-relaxed">
                  Ten movies. Two critics. Lightning speed. Guess whether Siskel &amp; Ebert gave each film a thumbs up or down &mdash; before time runs out.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold uppercase tracking-wider text-zinc-950 shadow-lg shadow-amber-500/20 group-hover:bg-amber-400 transition-all">
                  Play Now
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-3 text-5xl opacity-80">
                <span>{"\u{1F44D}"}</span>
                <span>{"\u{1F44E}"}</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Other Games Grid */}
        <div className="grid gap-4 md:grid-cols-2 animate-fadeIn" style={{ animationDelay: "0.2s" }}>
          {games.filter(g => g.slug !== "thumbs").map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-700">
            Powered by Siskel &amp; Ebert reviews &middot; TMDB
          </p>
        </footer>
      </div>
    </div>
  );
}
