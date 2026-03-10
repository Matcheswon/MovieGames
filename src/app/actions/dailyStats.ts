"use server";

import { createClient } from "@/lib/supabase/server";

export type DailyAggregateStats = {
  totalPlayers: number;
  solveRate: number | null;
  avgScore: number | null;
};

/** Get aggregate stats for a game on a given day (total players, solve rate, etc.) */
export async function getDailyAggregateStats(
  game: string,
  dateKey: string
): Promise<DailyAggregateStats> {
  try {
    const supabase = await createClient();

    const { count: totalPlayers } = await supabase
      .from("game_results")
      .select("*", { count: "exact", head: true })
      .eq("game", game)
      .eq("date_key", dateKey);

    if (!totalPlayers || totalPlayers === 0) {
      return { totalPlayers: 0, solveRate: null, avgScore: null };
    }

    if (game === "thumbs") {
      // For thumbs, compute average score percentage
      const { data } = await supabase
        .from("game_results")
        .select("score, out_of")
        .eq("game", game)
        .eq("date_key", dateKey);

      const avgScore =
        data && data.length > 0
          ? Math.round(
              (data.reduce(
                (s, r) => s + (r.score ?? 0) / (r.out_of || 1),
                0
              ) /
                data.length) *
                100
            )
          : null;

      return { totalPlayers, solveRate: null, avgScore };
    }

    // For roles/degrees, compute solve rate
    const { count: solvedCount } = await supabase
      .from("game_results")
      .select("*", { count: "exact", head: true })
      .eq("game", game)
      .eq("date_key", dateKey)
      .eq("solved", true);

    const solveRate = Math.round(((solvedCount ?? 0) / totalPlayers) * 100);

    return { totalPlayers, solveRate, avgScore: null };
  } catch {
    return { totalPlayers: 0, solveRate: null, avgScore: null };
  }
}
