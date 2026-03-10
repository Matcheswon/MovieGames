"use client";

type PlayHistoryEntry = {
  dateKey: string;
  games: string[];
};

const GAME_COLORS: Record<string, string> = {
  thumbs: "bg-sky-400",
  roles: "bg-amber-400",
};

function prevDate(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function formatMonthLabel(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short" });
}

function getDayOfWeek(dateKey: string): number {
  const d = new Date(dateKey + "T12:00:00Z");
  return d.getUTCDay(); // 0 = Sun, 6 = Sat
}

/**
 * GitHub-style contribution calendar showing play activity over the last 8 weeks.
 * Pass play history from Supabase (already fetched by stats page).
 */
export default function PlayHistoryCalendar({
  history,
  todayKey,
}: {
  history: PlayHistoryEntry[];
  todayKey: string;
}) {
  // Build a map of dateKey -> games played
  const dateMap = new Map<string, string[]>();
  for (const entry of history) {
    dateMap.set(entry.dateKey, entry.games);
  }

  // Generate last 56 days (8 weeks) ending today
  const days: string[] = [];
  let cursor = todayKey;
  for (let i = 0; i < 56; i++) {
    days.unshift(cursor);
    cursor = prevDate(cursor);
  }

  // Organize into weeks (columns) x weekdays (rows)
  // Each week is Sun-Sat. We'll build columns.
  const weeks: (string | null)[][] = [];
  let currentWeek: (string | null)[] = [];

  for (const day of days) {
    const dow = getDayOfWeek(day);
    if (dow === 0 && currentWeek.length > 0) {
      // Pad remaining slots
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
      currentWeek = [];
    }
    // Pad start of first week
    if (weeks.length === 0 && currentWeek.length === 0) {
      for (let i = 0; i < dow; i++) currentWeek.push(null);
    }
    currentWeek.push(day);
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  // Month labels for the top row
  const monthLabels: { label: string; colSpan: number }[] = [];
  let prevMonth = "";
  for (const week of weeks) {
    const firstDay = week.find((d) => d !== null);
    const month = firstDay ? formatMonthLabel(firstDay) : "";
    if (month !== prevMonth) {
      monthLabels.push({ label: month, colSpan: 1 });
      prevMonth = month;
    } else {
      monthLabels[monthLabels.length - 1].colSpan++;
    }
  }

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div>
      {/* Month labels */}
      <div className="flex mb-1 ml-8">
        {monthLabels.map((m, i) => (
          <div
            key={i}
            className="text-[9px] text-zinc-500 uppercase tracking-wider"
            style={{ width: `${m.colSpan * 16}px` }}
          >
            {m.label}
          </div>
        ))}
      </div>

      <div className="flex gap-0">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-[2px] mr-1 shrink-0">
          {dayLabels.map((label, i) => (
            <div
              key={i}
              className="h-3 flex items-center text-[8px] text-zinc-600 w-7 justify-end pr-1"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex gap-[2px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {week.map((day, di) => {
                if (!day) {
                  return (
                    <div key={di} className="w-3 h-3 rounded-[2px]" />
                  );
                }

                const games = dateMap.get(day) ?? [];
                const count = games.length;
                const isToday = day === todayKey;

                const bg =
                  count === 0
                    ? "bg-zinc-800/50"
                    : count === 1
                    ? "bg-emerald-500/30"
                    : count === 2
                    ? "bg-emerald-500/60"
                    : "bg-emerald-400";

                const gamesPlayed = games
                  .map((g) => g.charAt(0).toUpperCase() + g.slice(1))
                  .join(", ");
                const title = count > 0
                  ? `${day}: ${gamesPlayed}`
                  : day;

                return (
                  <div
                    key={di}
                    title={title}
                    className={`w-3 h-3 rounded-[2px] transition-colors ${bg} ${
                      isToday ? "ring-1 ring-zinc-500" : ""
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 ml-8">
        <span className="text-[9px] text-zinc-600">Less</span>
        <div className="w-3 h-3 rounded-[2px] bg-zinc-800/50" />
        <div className="w-3 h-3 rounded-[2px] bg-emerald-500/30" />
        <div className="w-3 h-3 rounded-[2px] bg-emerald-500/60" />
        <div className="w-3 h-3 rounded-[2px] bg-emerald-400" />
        <span className="text-[9px] text-zinc-600">More</span>
        <div className="flex items-center gap-1.5 ml-3">
          {Object.entries(GAME_COLORS).map(([game, color]) => (
            <span key={game} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
              <span className="text-[9px] text-zinc-600 capitalize">{game}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
