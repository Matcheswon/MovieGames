import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const MAX_MESSAGE_LENGTH = 5000;
const MAX_EMAIL_LENGTH = 320;
const MAX_PAGE_URL_LENGTH = 500;
const MAX_GAME_CONTEXT_LENGTH = 5000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 8;
const ALLOWED_CATEGORIES = new Set(["Bug Report", "Puzzle Feedback", "General Feedback"]);

type RateBucket = {
  count: number;
  windowStart: number;
};

const feedbackRateBuckets = new Map<string, RateBucket>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function consumeFeedbackRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  if (feedbackRateBuckets.size > 1000) {
    for (const [key, bucket] of feedbackRateBuckets) {
      if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
        feedbackRateBuckets.delete(key);
      }
    }
  }

  const bucket = feedbackRateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    feedbackRateBuckets.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart)) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  bucket.count += 1;
  feedbackRateBuckets.set(ip, bucket);
  return { allowed: true, retryAfterSeconds: 0 };
}

function isValidEmail(email: string): boolean {
  // Lightweight email sanity check.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rate = consumeFeedbackRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many feedback submissions. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isPlainObject(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { message, category, email, pageUrl, gameContext, website } = body;

  // Honeypot for basic bot traffic.
  if (typeof website === "string" && website.trim().length > 0) {
    return NextResponse.json({ success: true });
  }

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` }, { status: 400 });
  }

  if (typeof email === "string") {
    const trimmedEmail = email.trim();
    if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
      return NextResponse.json({ error: `Email is too long (max ${MAX_EMAIL_LENGTH} characters).` }, { status: 400 });
    }
    if (trimmedEmail.length > 0 && !isValidEmail(trimmedEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
  } else if (email !== undefined && email !== null) {
    return NextResponse.json({ error: "Invalid email value." }, { status: 400 });
  }

  if (typeof category === "string" && category.trim().length > 0 && !ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }

  if (typeof pageUrl === "string") {
    if (pageUrl.length > MAX_PAGE_URL_LENGTH) {
      return NextResponse.json({ error: `Page URL is too long (max ${MAX_PAGE_URL_LENGTH} characters).` }, { status: 400 });
    }
    if (pageUrl.trim().length > 0 && !pageUrl.startsWith("/") && !pageUrl.startsWith("http://") && !pageUrl.startsWith("https://")) {
      return NextResponse.json({ error: "Invalid page URL." }, { status: 400 });
    }
  } else if (pageUrl !== undefined && pageUrl !== null) {
    return NextResponse.json({ error: "Invalid page URL value." }, { status: 400 });
  }

  if (gameContext !== undefined && gameContext !== null) {
    if (!isPlainObject(gameContext)) {
      return NextResponse.json({ error: "Invalid game context." }, { status: 400 });
    }
    if (JSON.stringify(gameContext).length > MAX_GAME_CONTEXT_LENGTH) {
      return NextResponse.json(
        { error: `Game context is too large (max ${MAX_GAME_CONTEXT_LENGTH} characters).` },
        { status: 400 }
      );
    }
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Feedback service is not configured." }, { status: 503 });
  }
  const admin = createServiceClient(url, key);

  const { error } = await admin.from("feedback").insert({
    user_id: userId,
    email: typeof email === "string" ? email.trim() || null : null,
    category: typeof category === "string" ? category : null,
    message: message.trim(),
    page_url: typeof pageUrl === "string" ? pageUrl : null,
    game_context: isPlainObject(gameContext) ? gameContext : null,
  });

  if (error) {
    console.error("Feedback insert error:", error);
    return NextResponse.json({ error: "Failed to submit feedback." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
