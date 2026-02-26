import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Sign In",
  "Sign in or create an account for MovieNight."
);

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
