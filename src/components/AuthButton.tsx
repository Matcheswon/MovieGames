import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { isAdmin } from "@/lib/admin";

export default async function AuthButton() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Link
        href="/auth"
        className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:border-amber-500/30 hover:text-amber-400"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {isAdmin(user.email) && (
        <Link
          href="/admin"
          className="rounded-lg border border-amber-500/30 bg-zinc-900/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-amber-400/70 transition-colors hover:border-amber-500/50 hover:text-amber-400"
        >
          Admin
        </Link>
      )}
      <Link
        href="/stats"
        className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:border-amber-500/30 hover:text-amber-400"
      >
        Stats
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-300"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
