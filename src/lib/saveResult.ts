import { createClient } from "@/lib/supabase/client";

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

type GameResult = ThumbsResult | RolesResult;

export async function saveGameResult(result: GameResult) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // not logged in, skip silently

  const row = {
    user_id: user.id,
    game: result.game,
    date_key: result.dateKey,
    time_secs: result.timeSecs,
    score: result.game === "thumbs" ? result.score : null,
    out_of: result.game === "thumbs" ? result.outOf : null,
    solved: result.game === "roles" ? result.solved : null,
    strikes: result.game === "roles" ? result.strikes : null,
    rounds_used: result.game === "roles" ? result.roundsUsed : null,
  };

  await supabase.from("game_results").upsert(row, {
    onConflict: "user_id,game,date_key",
  });
}
