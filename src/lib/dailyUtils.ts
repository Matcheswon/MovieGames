import { RatingEntry } from "@/lib/types";

export type RolesPuzzle = {
  actor: string;
  character: string;
  movie: string;
  year: number;
};

const ROLES_EPOCH = "2026-02-17";

export function getDailyRolesPuzzle(
  puzzles: RolesPuzzle[],
  now = new Date()
): { dateKey: string; puzzle: RolesPuzzle | null; puzzleNumber: number } {
  const dateKey = getNyDateKey(now);
  if (puzzles.length === 0) return { dateKey, puzzle: null, puzzleNumber: 0 };
  const epoch = new Date(ROLES_EPOCH + "T12:00:00");
  const today = new Date(dateKey + "T12:00:00");
  const daysSinceEpoch = Math.round((today.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
  const index = ((daysSinceEpoch % puzzles.length) + puzzles.length) % puzzles.length;
  return { dateKey, puzzle: puzzles[index] ?? null, puzzleNumber: index + 1 };
}

const NY_TIMEZONE = "America/New_York";

function getNyDateKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: NY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(date);
}

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getDailyMovie(entries: RatingEntry[], now = new Date()): {
  dateKey: string;
  movie: RatingEntry | null;
} {
  const dateKey = getNyDateKey(now);

  if (entries.length === 0) {
    return { dateKey, movie: null };
  }

  const hash = stableHash(dateKey);
  const index = hash % entries.length;
  return {
    dateKey,
    movie: entries[index] ?? null
  };
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function getDailyMovies(
  entries: RatingEntry[],
  count: number,
  now = new Date()
): { dateKey: string; movies: RatingEntry[] } {
  const dateKey = getNyDateKey(now);

  if (entries.length === 0) {
    return { dateKey, movies: [] };
  }

  const hash = stableHash(dateKey);
  const rng = seededRandom(hash);

  const shuffled = [...entries];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return { dateKey, movies: shuffled.slice(0, count) };
}
