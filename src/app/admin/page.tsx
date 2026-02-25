import { getAdminStats } from "@/lib/supabase/adminStats";

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

  return (
    <section>
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
  );
}
