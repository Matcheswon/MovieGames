import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Use service role to bypass RLS
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function normalizeSignature(signature: string): string {
  const trimmed = signature.trim();
  return trimmed.startsWith("sha256=") ? trimmed.slice("sha256=".length) : trimmed;
}

function safeCompareHex(expectedHex: string, providedHex: string): boolean {
  const normalizedExpected = expectedHex.toLowerCase();
  const normalizedProvided = normalizeSignature(providedHex).toLowerCase();

  if (!/^[0-9a-f]+$/.test(normalizedExpected) || !/^[0-9a-f]+$/.test(normalizedProvided)) {
    return false;
  }

  if (normalizedExpected.length !== normalizedProvided.length) {
    return false;
  }

  const expected = Buffer.from(normalizedExpected, "hex");
  const provided = Buffer.from(normalizedProvided, "hex");

  if (expected.length === 0 || provided.length === 0 || expected.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, provided);
}

function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  return safeCompareHex(digest, signature);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") ?? "";

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!event || typeof event !== "object") {
    return NextResponse.json({ error: "Invalid payload shape" }, { status: 400 });
  }

  const eventRecord = event as Record<string, unknown>;
  const meta = (eventRecord.meta ?? null) as Record<string, unknown> | null;
  const data = (eventRecord.data ?? null) as Record<string, unknown> | null;
  const attrs = (data?.attributes ?? null) as Record<string, unknown> | null;
  const eventName = typeof meta?.event_name === "string" ? meta.event_name : null;
  const customData = (meta?.custom_data ?? null) as Record<string, unknown> | null;
  const userId = typeof customData?.user_id === "string" ? customData.user_id : undefined;

  if (!eventName || !attrs || !data) {
    return NextResponse.json({ error: "Missing event fields" }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "No user_id in custom_data" }, { status: 400 });
  }

  const supabase = getAdminClient();

  switch (eventName) {
    case "subscription_created":
    case "subscription_updated":
    case "subscription_resumed": {
      const status = attrs.status === "active" ? "active" : "cancelled";
      const subscriptionId = data.id;
      if (subscriptionId === undefined || subscriptionId === null) {
        return NextResponse.json({ error: "Missing subscription id" }, { status: 400 });
      }

      const { error } = await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          status,
          lemon_squeezy_customer_id: attrs.customer_id == null ? null : String(attrs.customer_id),
          lemon_squeezy_subscription_id: String(subscriptionId),
          current_period_end: typeof attrs.renews_at === "string" ? attrs.renews_at : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) {
        console.error("LemonSqueezy upsert failed:", error);
        return NextResponse.json({ error: "Database write failed" }, { status: 500 });
      }
      break;
    }

    case "subscription_cancelled":
    case "subscription_expired": {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: eventName === "subscription_cancelled" ? "cancelled" : "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      if (error) {
        console.error("LemonSqueezy update failed:", error);
        return NextResponse.json({ error: "Database update failed" }, { status: 500 });
      }
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
