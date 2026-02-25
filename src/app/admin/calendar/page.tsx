import AdminCalendar from "@/components/admin/AdminCalendar";
import puzzlesData from "@/data/roles.json";
import { getEligibleRatings } from "@/lib/ratingUtils";
import { RolesPuzzle } from "@/lib/dailyUtils";

export default function CalendarPage() {
  const rolesPuzzles = puzzlesData as RolesPuzzle[];
  const ratingsCount = getEligibleRatings().length;

  return (
    <section>
      <h2 className="font-display text-xl font-bold text-zinc-100 mb-4">
        Puzzle Schedule
      </h2>
      <AdminCalendar
        rolesPuzzles={rolesPuzzles}
        ratingsCount={ratingsCount}
      />
    </section>
  );
}
