import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserStats } from "@/lib/supabase/stats";
import MigrateLocalStats from "@/components/MigrateLocalStats";

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StatBox({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl py-3 px-2 text-center">
      <p className="text-xl font-bold text-zinc-100">{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-zinc-500 mt-1">{label}</p>
    </div>
  );
}

function StreakBox({ current, best }: { current: number; best: number }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl py-3 px-2 text-center">
      <p className="text-xl font-bold text-amber-400">
        {current > 0 ? `${current}\u{1F525}` : "0"}
      </p>
      <p className="text-[9px] uppercase tracking-widest text-zinc-500 mt-1">
        Streak {best > 0 && <span className="text-zinc-600">(best: {best})</span>}
      </p>
    </div>
  );
}

function EmptyState({ game }: { game: string }) {
  const href = game === "thumbs" ? "/play/thumbs/daily" : "/play/roles/daily";
  return (
    <div className="text-center py-6">
      <p className="text-sm text-zinc-500 mb-3">No {game} games played yet</p>
      <Link href={href} className="text-sm text-amber-400 font-semibold hover:text-amber-300 transition-colors">
        Play now &rarr;
      </Link>
    </div>
  );
}

export default async function StatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const stats = await getUserStats();

  return (
    <div className="min-h-screen bg-cinematic">
      <MigrateLocalStats />
      <div className="mx-auto max-w-lg px-5 md:px-8 py-12 md:py-20">
        <div className="animate-fadeIn">
          <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            &larr; Back
          </Link>

          <div className="mt-6 mb-10">
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-100">
              Your Stats
            </h1>
            <p className="text-sm text-zinc-500 mt-1">{user.email}</p>
          </div>

          {/* Thumbs Stats */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">{"\u{1F44D}"}</span>
              <h2 className="font-display text-xl font-bold text-zinc-100">THUMBS</h2>
            </div>

            {stats?.thumbs ? (
              <>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <StatBox value={stats.thumbs.gamesPlayed} label="Played" />
                  <StatBox value={`${stats.thumbs.averageScore}%`} label="Avg Score" />
                  <StreakBox current={stats.thumbs.currentStreak} best={stats.thumbs.bestStreak} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <StatBox value={formatTime(stats.thumbs.averageTimeSecs)} label="Avg Time" />
                  <StatBox value={stats.thumbs.bestScore} label="Best Score" />
                  <StatBox value={`${stats.thumbs.averageOutOf}`} label="Out Of" />
                </div>
              </>
            ) : (
              <EmptyState game="thumbs" />
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-800/50 mb-8" />

          {/* Roles Stats */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">{"\u{1F3AD}"}</span>
              <h2 className="font-display text-xl font-bold text-zinc-100">ROLES</h2>
            </div>

            {stats?.roles ? (
              <>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <StatBox value={stats.roles.gamesPlayed} label="Played" />
                  <StatBox value={`${stats.roles.solveRate}%`} label="Solve Rate" />
                  <StreakBox current={stats.roles.currentStreak} best={stats.roles.bestStreak} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <StatBox value={formatTime(stats.roles.averageTimeSecs)} label="Avg Time" />
                  <StatBox value={stats.roles.averageStrikes} label="Avg Strikes" />
                </div>
              </>
            ) : (
              <EmptyState game="roles" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
