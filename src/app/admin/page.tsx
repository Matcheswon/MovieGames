import Link from "next/link";
import { getAdminStats } from "@/lib/supabase/adminStats";
import AdminCalendar from "@/components/admin/AdminCalendar";
import puzzlesData from "@/data/roles.json";
import { getEligibleRatings } from "@/lib/ratingUtils";
import { RolesPuzzle } from "@/lib/dailyUtils";

export const dynamic = "force-dynamic";

function StatCard({
  value,
  label,
  sub,
}: {
  value: string | number;
  label: string;
  sub?: string;
}) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl py-4 px-3 text-center">
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-zinc-500 mt-1">
        {label}
      </p>
      {sub && <p className="text-[9px] text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function AdminPage() {
  const stats = await getAdminStats();

  const rolesPuzzles = puzzlesData as RolesPuzzle[];
  const ratingsCount = getEligibleRatings().length;

  return (
    <div className="min-h-screen bg-cinematic">
      <div className="mx-auto max-w-4xl px-5 md:px-8 py-12 md:py-20">
        <div className="animate-fadeIn">
          <Link
            href="/"
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            &larr; Back
          </Link>

          <div className="mt-6 mb-10">
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-100">
              Admin
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Puzzle schedule &amp; stats overview
            </p>
          </div>

          {/* Stats Overview */}
          <section className="mb-10">
            <h2 className="font-display text-xl font-bold text-zinc-100 mb-4">
              Stats Overview
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {stats.totalAccounts !== null && (
                <StatCard value={stats.totalAccounts} label="Accounts" />
              )}
              <StatCard value={stats.activePlayers} label="Active Players" />
              <StatCard value={stats.totalGamesPlayed} label="Total Games" />
              <StatCard
                value={stats.byGame.thumbs.total}
                label="Thumbs"
                sub={`${stats.byGame.thumbs.today} today`}
              />
              <StatCard
                value={stats.byGame.roles.total}
                label="Roles"
                sub={`${stats.byGame.roles.today} today`}
              />
              <StatCard value={stats.todayTotal} label="Played Today" />
            </div>
          </section>

          <div className="border-t border-zinc-800/50 mb-10" />

          {/* Calendar */}
          <section>
            <h2 className="font-display text-xl font-bold text-zinc-100 mb-4">
              Puzzle Schedule
            </h2>
            <AdminCalendar
              rolesPuzzles={rolesPuzzles}
              ratingsCount={ratingsCount}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
