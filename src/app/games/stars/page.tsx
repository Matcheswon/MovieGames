import Link from "next/link";

export default function StarsPage() {
  return (
    <div className="min-h-screen bg-cinematic text-zinc-100 flex flex-col items-center justify-center px-6">
      <div className="text-center animate-slideUp max-w-md">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <div className="w-2 h-2 rounded-full bg-amber-500/60" />
          <div className="w-2 h-2 rounded-full bg-amber-500/30" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mb-1">
          <span className="text-amber-400">Stars</span><span className="text-zinc-300"> Mode</span>
        </h1>
        <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500 mb-8">Coming Soon</p>

        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 mb-8 text-left">
          <p className="text-sm text-zinc-400 leading-relaxed">
            Predict each critic&apos;s star rating instead of thumbs. This game mode is under development.
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <Link href="/games/thumb-wars"
            className="py-3 px-5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm tracking-wide hover:bg-amber-400 transition-all active:scale-[0.97] shadow-lg shadow-amber-500/20">
            Play Thumb Wars
          </Link>
          <Link href="/"
            className="py-3 px-5 rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 text-sm font-medium tracking-wide hover:bg-zinc-700/60 transition-all active:scale-[0.97]">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
