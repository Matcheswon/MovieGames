import type { Metadata } from "next";
import RolesGame from "@/components/roles/RolesGame";
import puzzlesData from "@/data/roles.json";
import { getDailyRolesPuzzle, RolesPuzzle, stableHash, getNyDateKey } from "@/lib/dailyUtils";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Bonus Round - Roles",
  description:
    "Play a bonus round from the Roles archive after completing your daily puzzle.",
  path: "/play/roles/bonus",
  keywords: [
    "movie roles game",
    "bonus round",
    "movie roles archive",
  ],
});

export const dynamic = "force-dynamic";

export default function BonusRolesPage() {
  const puzzles = puzzlesData as RolesPuzzle[];
  const dateKey = getNyDateKey(new Date());

  // Figure out today's daily puzzle index so we can avoid recent puzzles
  const { puzzleNumber: dailyPuzzleNumber } = getDailyRolesPuzzle(puzzles);
  const dailyIndex = dailyPuzzleNumber - 1; // 0-based

  // Pick from puzzles that are at least 6 behind the current daily
  // so the bonus doesn't feel like a repeat of recent days
  const maxBonusIndex = Math.max(0, dailyIndex - 6);
  const pool = maxBonusIndex + 1; // indices 0..maxBonusIndex

  // Deterministic per day: same bonus puzzle all day
  const hash = stableHash(dateKey + "-roles-bonus");
  const bonusIndex = pool > 0 ? hash % pool : 0;
  const bonusPuzzle = puzzles[bonusIndex];
  if (!bonusPuzzle) return null;

  const bonusPuzzleNumber = bonusIndex + 1; // 1-indexed for display
  const bonusDateKey = `bonus-${dateKey}`; // synthetic key to avoid daily collisions

  return (
    <RolesGame
      puzzle={bonusPuzzle}
      puzzleNumber={bonusPuzzleNumber}
      dateKey={bonusDateKey}
      bonusMode
    />
  );
}
