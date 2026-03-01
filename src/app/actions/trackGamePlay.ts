"use server";

import { createClient } from "@supabase/supabase-js";

export async function trackAnonymousGameResult(data: {
  anonId: string;
  game: string;
  dateKey: string;
  timeSecs: number;
  score: number | null;
  outOf: number | null;
  solved: boolean | null;
  strikes: number | null;
  roundsUsed: number | null;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const supabase = createClient(url, key);

  const { error } = await supabase.from("game_results").upsert(
    {
      user_id: data.anonId,
      game: data.game,
      date_key: data.dateKey,
      time_secs: data.timeSecs,
      score: data.score,
      out_of: data.outOf,
      solved: data.solved,
      strikes: data.strikes,
      rounds_used: data.roundsUsed,
    },
    { onConflict: "user_id,game,date_key" }
  );

  if (error) {
    console.error("[trackAnonymousGameResult] Error:", error.message);
  }
}
