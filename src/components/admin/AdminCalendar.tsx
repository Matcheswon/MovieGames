"use client";

import { useState, useMemo } from "react";
import {
  getDailyRolesPuzzle,
  getNyDateKey,
  type RolesPuzzle,
} from "@/lib/dailyUtils";

const THUMBS_EPOCH = "2026-02-17";
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DayPuzzles = {
  day: number;
  dateKey: string;
  roles: { puzzle: RolesPuzzle | null; puzzleNumber: number };
  thumbsPuzzleNumber: number;
};

type Props = {
  rolesPuzzles: RolesPuzzle[];
  ratingsCount: number;
};

export default function AdminCalendar({
  rolesPuzzles,
}: Props) {
  const now = new Date();
  const todayKey = getNyDateKey(now);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
    setSelectedDay(null);
  }

  function goToToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDay(null);
  }

  // Build the calendar grid for the current month
  const { cells, daysInMonth } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startDow = firstDay.getDay();
    const dim = new Date(year, month + 1, 0).getDate();

    const grid: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) grid.push(null);
    for (let d = 1; d <= dim; d++) grid.push(d);
    while (grid.length % 7 !== 0) grid.push(null);

    return { cells: grid, daysInMonth: dim };
  }, [year, month]);

  // Get puzzle data for a specific day
  function getPuzzlesForDay(day: number): DayPuzzles {
    const date = new Date(year, month, day, 12, 0, 0);
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const roles = getDailyRolesPuzzle(rolesPuzzles, date);

    // Compute thumbs puzzle number inline (same epoch logic as dailyUtils)
    const thumbsEpoch = new Date(THUMBS_EPOCH + "T12:00:00");
    const dayDate = new Date(dateKey + "T12:00:00");
    const daysSinceEpoch = Math.round(
      (dayDate.getTime() - thumbsEpoch.getTime()) / (1000 * 60 * 60 * 24)
    );
    const thumbsPuzzleNumber = Math.max(1, daysSinceEpoch + 1);

    return { day, dateKey, roles, thumbsPuzzleNumber };
  }

  // Get selected day detail
  const selectedDetail = selectedDay ? getPuzzlesForDay(selectedDay) : null;

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={prevMonth}
          className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-3 py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:border-amber-500/30 hover:text-amber-400"
        >
          &larr; Prev
        </button>
        <div className="text-center">
          <h3 className="font-display text-lg font-bold text-zinc-100">
            {MONTH_NAMES[month]} {year}
          </h3>
          <button
            onClick={goToToday}
            className="text-[10px] uppercase tracking-widest text-zinc-600 hover:text-amber-400 transition-colors"
          >
            Today
          </button>
        </div>
        <button
          onClick={nextMonth}
          className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-3 py-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:border-amber-500/30 hover:text-amber-400"
        >
          Next &rarr;
        </button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-[9px] uppercase tracking-widest text-zinc-600 py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={i} className="h-24 md:h-28" />;
          }

          const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateKey === todayKey;
          const isSelected = day === selectedDay;
          const puzzles = getPuzzlesForDay(day);

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(day === selectedDay ? null : day)}
              className={`h-24 md:h-28 rounded-lg border p-1.5 text-left transition-all ${
                isSelected
                  ? "border-amber-500/70 bg-amber-500/10 ring-1 ring-amber-500/30"
                  : isToday
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-zinc-800/40 bg-zinc-900/30 hover:border-zinc-700/60"
              }`}
            >
              <div
                className={`text-xs font-bold mb-1 ${
                  isToday ? "text-amber-400" : "text-zinc-400"
                }`}
              >
                {day}
              </div>
              <div className="space-y-0.5 text-[8px] md:text-[9px] leading-tight">
                {puzzles.roles.puzzle && (
                  <div className="text-zinc-500 truncate">
                    <span className="text-amber-600/60">R</span>{" "}
                    {puzzles.roles.puzzle.actor.split(" ").pop()}
                  </div>
                )}
                <div className="text-zinc-500 truncate">
                  <span className="text-green-600/60">T</span>{" "}
                  #{puzzles.thumbsPuzzleNumber}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day detail panel */}
      {selectedDetail && (
        <div className="mt-4 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-display text-lg font-bold text-zinc-100">
              {MONTH_NAMES[month]} {selectedDetail.day}, {year}
            </h4>
            <span
              className={`text-[10px] uppercase tracking-widest ${
                selectedDetail.dateKey === todayKey
                  ? "text-amber-400"
                  : "text-zinc-600"
              }`}
            >
              {selectedDetail.dateKey === todayKey ? "Today" : selectedDetail.dateKey}
            </span>
          </div>

          <div className="space-y-4">
            {/* Roles detail */}
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-950/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">🎭</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-500/70">
                  Roles #{selectedDetail.roles.puzzleNumber}
                </span>
              </div>
              {selectedDetail.roles.puzzle ? (
                <div className="text-sm text-zinc-300">
                  <span className="font-semibold">{selectedDetail.roles.puzzle.actor}</span>
                  <span className="text-zinc-500"> as </span>
                  <span className="text-zinc-400">{selectedDetail.roles.puzzle.character}</span>
                  <div className="text-xs text-zinc-600 mt-1">
                    {selectedDetail.roles.puzzle.movie} ({selectedDetail.roles.puzzle.year})
                    {selectedDetail.roles.puzzle.difficulty === "hard" && (
                      <span className="ml-2 text-red-500/70">Hard</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-600">No puzzle data</p>
              )}
            </div>

            {/* Thumbs detail */}
            <div className="rounded-lg border border-zinc-800/40 bg-zinc-950/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">👍</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-green-500/70">
                  Thumbs #{selectedDetail.thumbsPuzzleNumber}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                10 seeded-random movies from the Siskel &amp; Ebert database
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
