import { createClient as createServerClient } from "@supabase/supabase-js";
import { createClient } from "./server";
import { getNyDateKey } from "@/lib/dailyUtils";

export type AdminStats = {
  totalAccounts: number | null;
  activePlayers: number;
  totalGamesPlayed: number;
  todayTotal: number;
  byGame: {
    thumbs: { total: number; today: number };
    roles: { total: number; today: number };
    degrees: { total: number; today: number };
  };
};

async function getTotalAccounts(): Promise<number | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) return null;

  const admin = createServerClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1, page: 1 });
  if (error) return null;

  // listUsers returns total count in the response
  return (data as unknown as { total: number }).total ?? null;
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createClient();
  const todayKey = getNyDateKey(new Date());

  const [totalAccounts, { data: results }] = await Promise.all([
    getTotalAccounts(),
    supabase.from("game_results").select("game, date_key, user_id"),
  ]);

  if (!results || results.length === 0) {
    return {
      totalAccounts,
      activePlayers: 0,
      totalGamesPlayed: 0,
      todayTotal: 0,
      byGame: {
        thumbs: { total: 0, today: 0 },
        roles: { total: 0, today: 0 },
        degrees: { total: 0, today: 0 },
      },
    };
  }

  const uniqueUsers = new Set(results.map((r) => r.user_id));
  const todayResults = results.filter((r) => r.date_key === todayKey);

  const thumbs = results.filter((r) => r.game === "thumbs");
  const roles = results.filter((r) => r.game === "roles");
  const degrees = results.filter((r) => r.game === "degrees");

  return {
    totalAccounts,
    activePlayers: uniqueUsers.size,
    totalGamesPlayed: results.length,
    todayTotal: todayResults.length,
    byGame: {
      thumbs: {
        total: thumbs.length,
        today: todayResults.filter((r) => r.game === "thumbs").length,
      },
      roles: {
        total: roles.length,
        today: todayResults.filter((r) => r.game === "roles").length,
      },
      degrees: {
        total: degrees.length,
        today: todayResults.filter((r) => r.game === "degrees").length,
      },
    },
  };
}
