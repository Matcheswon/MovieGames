import ratings from "@/data/ratings.json";
import { RatingEntry } from "@/lib/types";

export function getEligibleRatings(): RatingEntry[] {
  return (ratings as RatingEntry[]).filter((entry) => {
    return (
      (entry.ebert_thumb === 0 || entry.ebert_thumb === 1) &&
      (entry.siskel_thumb === 0 || entry.siskel_thumb === 1)
    );
  });
}

export function getRandomMovie(entries: RatingEntry[]): RatingEntry | null {
  if (entries.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * entries.length);
  return entries[index] ?? null;
}

export function getRandomMovies(entries: RatingEntry[], count: number): RatingEntry[] {
  const shuffled = [...entries];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
