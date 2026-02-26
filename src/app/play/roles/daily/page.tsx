import type { Metadata } from "next";
import RolesGame from "@/components/roles/RolesGame";
import puzzlesData from "@/data/roles.json";
import { getDailyRolesPuzzle, RolesPuzzle } from "@/lib/dailyUtils";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Daily Movie Roles Puzzle - Guess the Actor and Character",
  description:
    "Play today's movie roles puzzle. Guess the actor and character, spin for bonuses, and solve the daily movie guessing game before you run out of strikes.",
  path: "/play/roles/daily",
  keywords: [
    "movie roles game",
    "guess actor and character game",
    "daily actor puzzle",
    "movie roles guessing game",
  ],
});

export const dynamic = "force-dynamic";

export default function DailyRolesPage() {
  const { puzzle, puzzleNumber, dateKey } = getDailyRolesPuzzle(puzzlesData as RolesPuzzle[]);
  if (!puzzle) return null;
  return <RolesGame puzzle={puzzle} puzzleNumber={puzzleNumber} dateKey={dateKey} />;
}
