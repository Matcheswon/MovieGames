import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, category, email, pageUrl, gameContext } = body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Message is too long (max 5000 characters)." }, { status: 400 });
  }

  // Get current user if logged in (best-effort, don't fail if not)
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Anonymous user — that's fine
  }

  // Use service role to bypass RLS for the insert
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createServiceClient(url, key);

  const { error } = await admin.from("feedback").insert({
    user_id: userId,
    email: typeof email === "string" ? email.trim() || null : null,
    category: category || null,
    message: message.trim(),
    page_url: pageUrl || null,
    game_context: gameContext || null,
  });

  if (error) {
    console.error("Feedback insert error:", error);
    return NextResponse.json({ error: "Failed to submit feedback." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
