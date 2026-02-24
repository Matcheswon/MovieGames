import { createClient } from "@/lib/supabase/client";

// ─── Device ID ───────────────────────────────────────────────────────────────

const DEVICE_ID_KEY = "moviegames:device_id";

function getDeviceId(): string {
  if (typeof window === "undefined") return "00000000-0000-0000-0000-000000000000";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ─── GA4 Custom Events ──────────────────────────────────────────────────────

type GtagParams = Record<string, string | number | boolean>;

export function trackEvent(eventName: string, params?: GtagParams): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  if (w.gtag) w.gtag("event", eventName, params);
}

// ─── Supabase Anonymous Event Logging ───────────────────────────────────────

export async function logGameEvent(
  game: string,
  dateKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const supabase = createClient();
    const deviceId = getDeviceId();

    let userId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch { /* best-effort */ }

    await supabase.from("game_events").insert({
      device_id: deviceId,
      user_id: userId,
      game,
      event: "game_completed",
      date_key: dateKey,
      payload,
    });
  } catch { /* fire and forget */ }
}
