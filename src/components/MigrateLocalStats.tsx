"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const THUMBS_KEY = "moviegames:thumbwars:daily";
const ROLES_KEY = "moviegames:roles:daily";
const MIGRATED_KEY = "moviegames:stats-migrated";

export default function MigrateLocalStats() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (localStorage.getItem(MIGRATED_KEY)) return;

    (async () => {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const rows: Record<string, unknown>[] = [];

      // Thumbs history
      try {
        const raw = localStorage.getItem(THUMBS_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          for (const h of data.history ?? []) {
            rows.push({
              user_id: user.id,
              game: "thumbs",
              date_key: h.dateKey,
              score: h.score ?? 0,
              out_of: h.outOf ?? 0,
              time_secs: h.timeSecs ?? 0,
            });
          }
        }
      } catch {}

      // Roles history
      try {
        const raw = localStorage.getItem(ROLES_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          for (const h of data.history ?? []) {
            rows.push({
              user_id: user.id,
              game: "roles",
              date_key: h.dateKey,
              solved: h.solved ?? false,
              strikes: h.strikes ?? 0,
              rounds_used: h.roundsUsed ?? null,
              time_secs: h.timeSecs ?? 0,
            });
          }
        }
      } catch {}

      if (rows.length > 0) {
        for (const row of rows) {
          await supabase.from("game_results").upsert(row, {
            onConflict: "user_id,game,date_key",
          });
        }
      }

      localStorage.setItem(MIGRATED_KEY, "1");
      if (rows.length > 0) window.location.reload();
    })();
  }, []);

  return null;
}
