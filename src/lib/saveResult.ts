import { createClient } from "@/lib/supabase/client";
import { getNyDateKey } from "@/lib/dailyUtils";

type ThumbsResult = {
  game: "thumbs";
  dateKey: string;
  score: number;
  outOf: number;
  timeSecs: number;
};

type RolesResult = {
  game: "roles";
  dateKey: string;
  solved: boolean;
  strikes: number;
  roundsUsed: number;
  timeSecs: number;
};

type DegreesResult = {
  game: "degrees";
  dateKey: string;
  solved: boolean;
  mistakes: number;
  hints: number;
  timeSecs: number;
};

type GameResult = ThumbsResult | RolesResult | DegreesResult;

export async function saveGameResult(result: GameResult) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // not logged in, skip silently

  const row: Record<string, unknown> = {
    user_id: user.id,
    game: result.game,
    date_key: result.dateKey,
    time_secs: result.timeSecs,
    score: result.game === "thumbs" ? result.score : null,
    out_of: result.game === "thumbs" ? result.outOf : null,
    solved: result.game === "roles" ? result.solved : result.game === "degrees" ? result.solved : null,
    strikes: result.game === "roles" ? result.strikes : result.game === "degrees" ? result.mistakes : null,
    rounds_used: result.game === "roles" ? result.roundsUsed : null,
  };

  await supabase.from("game_results").upsert(row, {
    onConflict: "user_id,game,date_key",
  });
}

export async function getTodayResult(game: string, dateKey: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("game_results")
    .select("*")
    .eq("user_id", user.id)
    .eq("game", game)
    .eq("date_key", dateKey)
    .single();

  return data;
}

function prevDateKey(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Fetch current streak for a game from Supabase (client-side). Returns 0 if not logged in. */
export async function getGameStreak(game: string): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from("game_results")
    .select("date_key")
    .eq("user_id", user.id)
    .eq("game", game)
    .order("date_key", { ascending: false });

  if (!data || data.length === 0) return 0;

  const sorted = [...new Set(data.map(r => r.date_key))].sort((a, b) => b.localeCompare(a));
  const today = getNyDateKey(new Date());
  const yesterday = prevDateKey(today);

  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prevDateKey(sorted[i - 1])) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
