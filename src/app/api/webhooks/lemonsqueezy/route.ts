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

function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") ?? "";

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const eventName: string = event.meta.event_name;
  const customData = event.meta.custom_data ?? {};
  const userId: string | undefined = customData.user_id;
  const attrs = event.data.attributes;

  if (!userId) {
    return NextResponse.json({ error: "No user_id in custom_data" }, { status: 400 });
  }

  const supabase = getAdminClient();

  switch (eventName) {
    case "subscription_created":
    case "subscription_updated":
    case "subscription_resumed": {
      const status = attrs.status === "active" ? "active" : "cancelled";
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          status,
          lemon_squeezy_customer_id: String(attrs.customer_id),
          lemon_squeezy_subscription_id: String(event.data.id),
          current_period_end: attrs.renews_at,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      break;
    }

    case "subscription_cancelled":
    case "subscription_expired": {
      await supabase
        .from("subscriptions")
        .update({
          status: eventName === "subscription_cancelled" ? "cancelled" : "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
