import DegreesGame from "@/components/degrees/DegreesGame";
import puzzlesData from "@/data/degrees.json";
import { getDailyDegreesPuzzle, DegreesPuzzle } from "@/lib/dailyUtils";

export const dynamic = "force-dynamic";

export default function DailyDegreesPage() {
  const { puzzle, puzzleNumber, dateKey } = getDailyDegreesPuzzle(puzzlesData as DegreesPuzzle[]);
  if (!puzzle) return null;
  return <DegreesGame puzzle={puzzle} puzzleNumber={puzzleNumber} dateKey={dateKey} />;
}
