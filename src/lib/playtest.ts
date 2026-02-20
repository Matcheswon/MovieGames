// Playtest types and persistence for ROLES game testing

export type PlaytestResult = {
  puzzleIndex: number;
  actor: string;
  character: string;
  movie: string;
  year: number;
  solved: boolean;
  strikes: number;
  roundsUsed: number;
  timeSecs: number;
  letterCount: number;
  uniqueLetterCount: number;
};

type PlaytestSession = {
  results: PlaytestResult[];
  currentIndex: number;
  startedAt: string;
};

const STORAGE_KEY = "moviegames:playtest:roles";

const EMPTY_SESSION: PlaytestSession = {
  results: [],
  currentIndex: 0,
  startedAt: new Date().toISOString(),
};

export function readPlaytestSession(): PlaytestSession {
  if (typeof window === "undefined") return EMPTY_SESSION;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SESSION;
    return JSON.parse(raw) as PlaytestSession;
  } catch {
    return EMPTY_SESSION;
  }
}

export function writePlaytestSession(session: PlaytestSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearPlaytestSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function countGuessableLetters(text: string): { total: number; unique: number } {
  const letters: string[] = [];
  for (const ch of text) {
    const normalized = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    if (/^[A-Z]$/.test(normalized)) letters.push(normalized);
  }
  return { total: letters.length, unique: new Set(letters).size };
}
