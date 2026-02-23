// Playtest types and persistence for game testing

// ─── Result types per game ─────────────────────────────────────────────────

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

export type ThumbsPlaytestResult = {
  puzzleIndex: number;
  movies: string[];
  score: number;
  outOf: number;
  perfectRounds: number;
  timeSecs: number;
};

export type DegreesPlaytestResult = {
  puzzleIndex: number;
  startActor: string;
  endActor: string;
  chainLength: number;
  solved: boolean;
  mistakes: number;
  hints: number;
  timeSecs: number;
};

// ─── Session types ──────────────────────────────────────────────────────────

type PlaytestSession<T> = {
  results: T[];
  currentIndex: number;
  startedAt: string;
};

const STORAGE_KEYS = {
  roles: "moviegames:playtest:roles",
  thumbs: "moviegames:playtest:thumbs",
  degrees: "moviegames:playtest:degrees",
} as const;

type GameKey = keyof typeof STORAGE_KEYS;

function emptySession<T>(): PlaytestSession<T> {
  return { results: [], currentIndex: 0, startedAt: new Date().toISOString() };
}

// ─── Generic read/write/clear per game ──────────────────────────────────────

export function readPlaytestSession(): PlaytestSession<PlaytestResult>;
export function readPlaytestSession<T>(game: GameKey): PlaytestSession<T>;
export function readPlaytestSession<T>(game: GameKey = "roles"): PlaytestSession<T> {
  if (typeof window === "undefined") return emptySession<T>();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[game]);
    if (!raw) return emptySession<T>();
    return JSON.parse(raw) as PlaytestSession<T>;
  } catch {
    return emptySession<T>();
  }
}

export function writePlaytestSession(session: PlaytestSession<PlaytestResult>): void;
export function writePlaytestSession<T>(session: PlaytestSession<T>, game: GameKey): void;
export function writePlaytestSession<T>(session: PlaytestSession<T>, game: GameKey = "roles"): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS[game], JSON.stringify(session));
}

export function clearPlaytestSession(): void;
export function clearPlaytestSession(game: GameKey): void;
export function clearPlaytestSession(game: GameKey = "roles"): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEYS[game]);
}

// ─── Utilities ──────────────────────────────────────────────────────────────

export function countGuessableLetters(text: string): { total: number; unique: number } {
  const letters: string[] = [];
  for (const ch of text) {
    const normalized = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    if (/^[A-Z]$/.test(normalized)) letters.push(normalized);
  }
  return { total: letters.length, unique: new Set(letters).size };
}
