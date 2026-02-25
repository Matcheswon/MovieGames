import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type FeedbackRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  email: string | null;
  category: string | null;
  message: string;
  page_url: string | null;
  game_context: Record<string, unknown> | null;
  status: string;
};

async function getFeedback(): Promise<FeedbackRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Failed to fetch feedback:", error);
    return [];
  }
  return (data ?? []) as FeedbackRow[];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const isNew = status === "new";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        isNew
          ? "bg-amber-500/20 text-amber-400"
          : "bg-zinc-800/50 text-zinc-500"
      }`}
    >
      {status}
    </span>
  );
}

function GameContextSummary({ ctx }: { ctx: Record<string, unknown> | null }) {
  if (!ctx) return null;
  const parts: string[] = [];
  if (ctx.game) parts.push(String(ctx.game));
  if (ctx.puzzleNumber) parts.push(`#${ctx.puzzleNumber}`);
  if (ctx.movie) parts.push(String(ctx.movie));
  if (ctx.actor) parts.push(String(ctx.actor));
  return (
    <span className="text-xs text-zinc-600">
      {parts.join(" — ")}
    </span>
  );
}

export default async function FeedbackPage() {
  const feedback = await getFeedback();

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-bold text-zinc-100">
          Feedback
        </h2>
        <span className="text-xs text-zinc-600">
          {feedback.length} message{feedback.length !== 1 ? "s" : ""}
        </span>
      </div>

      {feedback.length === 0 ? (
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 px-6 py-12 text-center">
          <p className="text-sm text-zinc-500">No feedback yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((fb) => (
            <details
              key={fb.id}
              className="group rounded-xl border border-zinc-800/50 bg-zinc-900/30 overflow-hidden"
            >
              <summary className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-zinc-800/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={fb.status} />
                    {fb.category && (
                      <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                        {fb.category}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-600 ml-auto flex-shrink-0">
                      {formatDate(fb.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 truncate">{fb.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {fb.email && (
                      <span className="text-xs text-zinc-500">{fb.email}</span>
                    )}
                    <GameContextSummary ctx={fb.game_context} />
                  </div>
                </div>
              </summary>

              <div className="border-t border-zinc-800/40 px-4 py-3 space-y-3">
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{fb.message}</p>

                {fb.page_url && (
                  <div className="text-xs text-zinc-600">
                    <span className="text-zinc-500">Page:</span> {fb.page_url}
                  </div>
                )}

                {fb.user_id && (
                  <div className="text-xs text-zinc-600">
                    <span className="text-zinc-500">User ID:</span> {fb.user_id}
                  </div>
                )}

                {fb.game_context && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Game Context</p>
                    <pre className="rounded-lg bg-zinc-950/50 border border-zinc-800/40 px-3 py-2 text-xs text-zinc-400 overflow-x-auto">
                      {JSON.stringify(fb.game_context, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
