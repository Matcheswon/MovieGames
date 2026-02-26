import type { Metadata } from "next";
import DegreesGame from "@/components/degrees/DegreesGame";
import puzzlesData from "@/data/degrees.json";
import { getDailyDegreesPuzzle, DegreesPuzzle } from "@/lib/dailyUtils";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Daily Movie Connections Puzzle - Degrees",
  description:
    "Play a daily movie connections puzzle and connect actors through shared movies. Solve the movie degrees challenge in the fewest moves you can.",
  path: "/play/degrees/daily",
  keywords: [
    "movie connections game",
    "actor connection game",
    "movie degrees puzzle",
    "daily movie puzzle game",
  ],
});

export const dynamic = "force-dynamic";

export default function DailyDegreesPage() {
  const { puzzle, puzzleNumber, dateKey } = getDailyDegreesPuzzle(puzzlesData as DegreesPuzzle[]);
  if (!puzzle) return null;
  return <DegreesGame puzzle={puzzle} puzzleNumber={puzzleNumber} dateKey={dateKey} />;
}
