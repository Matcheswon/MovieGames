import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata(
  "Playtest",
  "Development-only playtest tools for MovieNight."
);

export default function PlaytestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
