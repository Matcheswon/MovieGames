import RolesGame from "@/components/roles/RolesGame";
import puzzlesData from "@/data/roles.json";
import { getDailyRolesPuzzle, RolesPuzzle } from "@/lib/dailyUtils";

export const revalidate = 60 * 60;

export default function DailyRolesPage() {
  const { puzzle, puzzleNumber, dateKey } = getDailyRolesPuzzle(puzzlesData as RolesPuzzle[]);
  if (!puzzle) return null;
  return <RolesGame puzzle={puzzle} puzzleNumber={puzzleNumber} dateKey={dateKey} />;
}
