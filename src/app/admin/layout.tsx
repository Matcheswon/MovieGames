import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import AdminNav from "@/components/admin/AdminNav";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Admin",
  "Private admin tools for MovieNight."
);

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  if (!isAdmin(user.email)) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-cinematic">
      <div className="mx-auto max-w-4xl px-5 md:px-8 py-12 md:py-20">
        <div className="animate-fadeIn">
          <Link
            href="/"
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            &larr; Back
          </Link>

          <div className="mt-6 mb-6">
            <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-100">
              Admin
            </h1>
          </div>

          <AdminNav />

          {children}
        </div>
      </div>
    </div>
  );
}
