"use server";

import { createClient } from "@/lib/supabase/server";

type FeedbackPayload = {
  email?: string;
  category: string;
  message: string;
  pageUrl?: string;
  gameContext?: Record<string, unknown> | null;
};

export async function submitFeedback(payload: FeedbackPayload) {
  const { message, category, email, pageUrl, gameContext } = payload;

  if (!message || message.trim().length === 0) {
    return { error: "Message is required." };
  }
  if (message.length > 5000) {
    return { error: "Message is too long (max 5000 characters)." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from("feedback").insert({
    user_id: user?.id ?? null,
    email: email?.trim() || null,
    category,
    message: message.trim(),
    page_url: pageUrl || null,
    game_context: gameContext || null,
  });

  if (error) {
    console.error("Feedback insert error:", error);
    return { error: "Failed to submit feedback. Please try again." };
  }

  return { success: true };
}
