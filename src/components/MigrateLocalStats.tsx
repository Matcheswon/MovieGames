"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const THUMBS_KEY = "moviegames:thumbwars:daily";
const ROLES_KEY = "moviegames:roles:daily";
const DEGREES_KEY = "moviegames:degrees:daily";

export default function MigrateLocalStats() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      // Fetch existing date_keys from Supabase to avoid redundant upserts
      const { data: existing } = await supabase
        .from("game_results")
        .select("game, date_key")
        .eq("user_id", user.id);

      const existingKeys = new Set(
        (existing ?? []).map(r => `${r.game}:${r.date_key}`)
      );

      const rows: Record<string, unknown>[] = [];

      // Thumbs history
      try {
        const raw = localStorage.getItem(THUMBS_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          for (const h of data.history ?? []) {
            if (!existingKeys.has(`thumbs:${h.dateKey}`)) {
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
        }
      } catch {}

      // Roles history
      try {
        const raw = localStorage.getItem(ROLES_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          for (const h of data.history ?? []) {
            if (!existingKeys.has(`roles:${h.dateKey}`)) {
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
        }
      } catch {}

      // Degrees history
      try {
        const raw = localStorage.getItem(DEGREES_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          for (const h of data.history ?? []) {
            if (!existingKeys.has(`degrees:${h.dateKey}`)) {
              rows.push({
                user_id: user.id,
                game: "degrees",
                date_key: h.dateKey,
                solved: h.solved ?? false,
                strikes: h.mistakes ?? 0,
                time_secs: h.timeSecs ?? 0,
              });
            }
          }
        }
      } catch {}

      if (rows.length > 0) {
        for (const row of rows) {
          await supabase.from("game_results").upsert(row, {
            onConflict: "user_id,game,date_key",
          });
        }
        window.location.reload();
      }
    })();
  }, []);

  return null;
}
