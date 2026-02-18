import { createClient } from "./server";

export async function getProStatus(): Promise<{
  isPro: boolean;
  userId: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { isPro: false, userId: null };
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .single();

  const isPro =
    subscription?.status === "active" &&
    (!subscription.current_period_end ||
      new Date(subscription.current_period_end) > new Date());

  return { isPro, userId: user.id };
}
