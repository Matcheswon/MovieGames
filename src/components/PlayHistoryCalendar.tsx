"use client";

type PlayHistoryEntry = {
  dateKey: string;
  games: string[];
};

function addDays(dateKey: string, n: number): string {
  const d = new Date(dateKey + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
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

  // Find the Saturday that ends today's week, then go back 8 full weeks
  const todayDow = getDayOfWeek(todayKey);
  const endDate = addDays(todayKey, 6 - todayDow); // Saturday of this week
  const startDate = addDays(endDate, -55); // 8 weeks = 56 days total

  // Generate all 56 days (always 8 full Sun-Sat weeks)
  const weeks: string[][] = [];
  let cursor = startDate;
  for (let w = 0; w < 8; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
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
            style={{ width: `${m.colSpan * 14}px` }}
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
                const isFuture = day > todayKey;
                if (isFuture) {
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
      </div>
    </div>
  );
}
