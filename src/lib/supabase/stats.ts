import { createClient } from "./server";

type GameStats = {
  gamesPlayed: number;
  currentStreak: number;
  bestStreak: number;
  averageTimeSecs: number;
};

type ThumbsStats = GameStats & {
  averageScore: number;
  averageOutOf: number;
  bestScore: number;
};

type RolesStats = GameStats & {
  solveRate: number;
  averageStrikes: number;
};

export type UserStats = {
  thumbs: ThumbsStats | null;
  roles: RolesStats | null;
};

function computeStreak(dateKeys: string[]): { current: number; best: number } {
  if (dateKeys.length === 0) return { current: 0, best: 0 };

  // Sort descending (newest first)
  const sorted = [...dateKeys].sort((a, b) => b.localeCompare(a));

  // Check if today or yesterday is the most recent play
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const mostRecent = sorted[0];

  let current = 0;
  let best = 0;
  let streak = 1;

  // Current streak: count consecutive days from most recent
  if (mostRecent === today || mostRecent === yesterday) {
    current = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] + "T12:00:00");
      prev.setDate(prev.getDate() - 1);
      const expected = prev.toISOString().slice(0, 10);
      if (sorted[i] === expected) {
        current++;
      } else {
        break;
      }
    }
  }

  // Best streak: find longest consecutive run
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T12:00:00");
    prev.setDate(prev.getDate() - 1);
    const expected = prev.toISOString().slice(0, 10);
    if (sorted[i] === expected) {
      streak++;
    } else {
      best = Math.max(best, streak);
      streak = 1;
    }
  }
  best = Math.max(best, streak, current);

  return { current, best };
}

export async function getUserStats(): Promise<UserStats | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: results } = await supabase
    .from("game_results")
    .select("*")
    .eq("user_id", user.id)
    .order("date_key", { ascending: true });

  if (!results || results.length === 0) return { thumbs: null, roles: null };

  const thumbsResults = results.filter(r => r.game === "thumbs");
  const rolesResults = results.filter(r => r.game === "roles");

  let thumbs: ThumbsStats | null = null;
  if (thumbsResults.length > 0) {
    const { current, best } = computeStreak(thumbsResults.map(r => r.date_key));
    const totalScore = thumbsResults.reduce((s, r) => s + (r.score ?? 0), 0);
    const totalOutOf = thumbsResults.reduce((s, r) => s + (r.out_of ?? 0), 0);
    const bestScore = Math.max(...thumbsResults.map(r => r.score ?? 0));
    thumbs = {
      gamesPlayed: thumbsResults.length,
      currentStreak: current,
      bestStreak: best,
      averageTimeSecs: Math.round(thumbsResults.reduce((s, r) => s + r.time_secs, 0) / thumbsResults.length),
      averageScore: Math.round((totalScore / totalOutOf) * 100),
      averageOutOf: Math.round(totalOutOf / thumbsResults.length),
      bestScore,
    };
  }

  let roles: RolesStats | null = null;
  if (rolesResults.length > 0) {
    const { current, best } = computeStreak(rolesResults.map(r => r.date_key));
    const solved = rolesResults.filter(r => r.solved).length;
    roles = {
      gamesPlayed: rolesResults.length,
      currentStreak: current,
      bestStreak: best,
      averageTimeSecs: Math.round(rolesResults.reduce((s, r) => s + r.time_secs, 0) / rolesResults.length),
      solveRate: Math.round((solved / rolesResults.length) * 100),
      averageStrikes: +(rolesResults.reduce((s, r) => s + (r.strikes ?? 0), 0) / rolesResults.length).toFixed(1),
    };
  }

  return { thumbs, roles };
}
