"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RolesPuzzle, getNyDateKey } from "@/lib/dailyUtils";
import { saveGameResult } from "@/lib/saveResult";

// ─── Daily streak persistence ───
const DAILY_STORAGE_KEY = "moviegames:roles:daily";

type RolesHistoryEntry = {
  dateKey: string;
  puzzleNumber: number;
  solved: boolean;
  strikes: number;
  timeSecs: number;
  roundsUsed?: number;
};

type DailyStreakData = {
  lastPlayedDate: string | null;
  dailyStreak: number;
  bestDailyStreak: number;
  history: RolesHistoryEntry[];
};

const EMPTY_STREAK: DailyStreakData = { lastPlayedDate: null, dailyStreak: 0, bestDailyStreak: 0, history: [] };

function readDailyStreak(): DailyStreakData {
  if (typeof window === "undefined") return EMPTY_STREAK;
  try {
    const raw = window.localStorage.getItem(DAILY_STORAGE_KEY);
    if (!raw) return EMPTY_STREAK;
    const parsed = JSON.parse(raw) as Partial<DailyStreakData>;
    return {
      lastPlayedDate: parsed.lastPlayedDate ?? null,
      dailyStreak: parsed.dailyStreak ?? 0,
      bestDailyStreak: parsed.bestDailyStreak ?? 0,
      history: parsed.history ?? [],
    };
  } catch {
    return EMPTY_STREAK;
  }
}

function writeDailyStreak(data: DailyStreakData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(data));
}

function isYesterday(dateStr: string, todayStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 1);
  const next = d.toISOString().slice(0, 10);
  return next === todayStr;
}

function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {}
    }
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleShare}
      className="flex-1 py-3 rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 text-sm font-medium tracking-wide hover:bg-zinc-700/60 transition-all active:scale-[0.97] cursor-pointer">
      {copied ? "Copied!" : "Share"}
    </button>
  );
}

// Role Call effects — the wheel guesses FOR you now
const CALL_SHEET = [
  { label: "Letter Spin", desc: "A random letter is guessed", icon: "\u{1F524}", type: "random_letter", good: true },
  { label: "Letter Spin", desc: "A random letter is guessed", icon: "\u{1F524}", type: "random_letter", good: true },
  { label: "Double Spin", desc: "Two random letters guessed", icon: "\u2728", type: "double_letter", good: true },
  { label: "Vowel Spin", desc: "A random vowel is guessed", icon: "\u{1F170}\uFE0F", type: "vowel", good: true },
  { label: "Double Guess", desc: "Guess 2 letters next!", icon: "\u{1F3AF}", type: "double_guess", good: true },
  { label: "+4 Seconds", desc: "Extra time this round", icon: "\u23F1\uFE0F", type: "bonus_time", good: true },
  { label: "Lose a Turn", desc: "Skip to next round", icon: "\u23ED\uFE0F", type: "lose_turn", good: false },
  { label: "Half Time", desc: "Only 4 seconds", icon: "\u23F3", type: "half_time", good: false },
  { label: "Keyboard Lock", desc: "Solve only this round", icon: "\u{1F512}", type: "kb_lock", good: false },
];

function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

const BASE_TIME = 8;
const MAX_STRIKES = 3;
const MAX_ROUNDS = 8;

function normalizeLetter(ch: string): string {
  return ch
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function isGuessableChar(ch: string): boolean {
  return /^[A-Z]$/.test(normalizeLetter(ch));
}

function normalizePhrase(phrase: string): string {
  return phrase
    .split("")
    .map((ch) => (isGuessableChar(ch) ? normalizeLetter(ch) : ch))
    .join("");
}

function getBlankPositions(actor: string, character: string, revealed: Set<string>) {
  const p: { word: string; index: number; ch: string }[] = [];
  actor.split("").forEach((ch, i) => {
    const normalized = normalizeLetter(ch);
    if (isGuessableChar(ch) && !revealed.has(normalized)) p.push({ word: "actor", index: i, ch: normalized });
  });
  character.split("").forEach((ch, i) => {
    const normalized = normalizeLetter(ch);
    if (isGuessableChar(ch) && !revealed.has(normalized)) p.push({ word: "character", index: i, ch: normalized });
  });
  return p;
}

export default function RolesGame({ puzzle, puzzleNumber, dateKey }: { puzzle: RolesPuzzle; puzzleNumber: number; dateKey: string }) {
  const router = useRouter();
  const [screen, setScreen] = useState<"start" | "playing" | "solved" | "failed">("start");
  const [revealed, setRevealed] = useState(new Set<string>());
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<string>("idle");
  const [strikes, setStrikes] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [guessTime, setGuessTime] = useState(BASE_TIME);
  const [guessTimer, setGuessTimer] = useState(BASE_TIME);
  const [guessedLetters, setGuessedLetters] = useState(new Set<string>());
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [justRevealed, setJustRevealed] = useState(new Set<string>());
  const [justEliminated, setJustEliminated] = useState(new Set<string>());
  const [rollResult, setRollResult] = useState<typeof CALL_SHEET[number] | null>(null);
  const [rollAnimIdx, setRollAnimIdx] = useState(-1);
  const [lastGuess, setLastGuess] = useState<{ letter: string; correct: boolean; fromSpin?: boolean } | null>(null);
  const [pickedLetters, setPickedLetters] = useState<string[]>([]);
  const [revealingIdx, setRevealingIdx] = useState(-1);
  const [solveMode, setSolveMode] = useState(false);
  const [solveCursor, setSolveCursor] = useState(0);
  const [solveInputs, setSolveInputs] = useState<Record<string, string>>({});
  const [solveAttempts, setSolveAttempts] = useState(2);
  const [finalSolveMode, setFinalSolveMode] = useState(false);
  const [shakeBoard, setShakeBoard] = useState(false);
  const [roundKbLock, setRoundKbLock] = useState(false);
  const [lostTurn, setLostTurn] = useState(false);
  const [guessesThisRound, setGuessesThisRound] = useState(1);
  const [guessesRemaining, setGuessesRemaining] = useState(1);
  const [guessResolving, setGuessResolving] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [lostRounds, setLostRounds] = useState(new Set<number>());
  const [turnWarning, setTurnWarning] = useState<string | null>(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState<RolesHistoryEntry | null>(null);
  const [fanfareLetter, setFanfareLetter] = useState<string | null>(null);
  const [fanfareCount, setFanfareCount] = useState(0);
  const [tileBlinking, setTileBlinking] = useState<string | null>(null);
  const [tilesPopping, setTilesPopping] = useState(new Set<string>());
  const [tilesLit, setTilesLit] = useState(new Set<string>());

  const rand = useRef(rng(puzzleNumber));
  const rollSeqRef = useRef<typeof CALL_SHEET[number][]>([]);
  const totalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const guessRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const guessesRemainingRef = useRef(1);
  const dailyRecorded = useRef(false);
  const roundRef = useRef(0);
  const screenRef = useRef<"start" | "playing" | "solved" | "failed">("start");
  const lockoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windUpRef = useRef(false);
  const fanfareKeyRef = useRef(0);

  const kbLocked = strikes >= MAX_STRIKES || roundKbLock;
  const allLetters = new Set(
    [...puzzle.actor.split(""), ...puzzle.character.split("")]
      .filter((ch) => isGuessableChar(ch))
      .map((ch) => normalizeLetter(ch))
  );
  const allDone = [...allLetters].every(c => revealed.has(c));
  const isOver = screen === "solved" || screen === "failed";
  const blankPositions = getBlankPositions(puzzle.actor, puzzle.character, revealed);

  useEffect(() => {
    guessesRemainingRef.current = guessesRemaining;
  }, [guessesRemaining]);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // Desktop keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isOver || screen !== "playing") return;
      const key = e.key.toUpperCase();
      if (key === "BACKSPACE" && (phase === "pick-letters" || phase === "pick-double") && pickedLetters.length > 0) { e.preventDefault(); handlePickBackspace(); return; }
      if (key === "BACKSPACE" && solveMode) { e.preventDefault(); handleSolveBackspace(); return; }
      if (key === "ENTER" && phase === "pre-roll") { e.preventDefault(); handleSpin(); return; }
      if (key === "ENTER" && solveMode) { e.preventDefault(); handleSolveSubmit(); return; }
      if (key.length === 1 && key >= "A" && key <= "Z") {
        e.preventDefault();
        if (phase === "pick-letters" || phase === "pick-double") handlePickLetter(key);
        else if (solveMode) handleSolveType(key);
        else if (phase === "guessing") handleLetter(key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const startGame = useCallback(() => {
    rand.current = rng(puzzleNumber + Date.now());
    const seq: typeof CALL_SHEET = [];
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const counts: Record<string, number> = {};
      for (const e of seq) counts[e.type] = (counts[e.type] ?? 0) + 1;
      const prev = i > 0 ? seq[i - 1].type : null;
      // Each bad effect backs off as it accumulates: lose_turn ≤2, kb_lock ≤1, half_time ≤2; none consecutive
      const isRejected = (t: string) =>
        (t === "lose_turn" && (prev === "lose_turn" || (counts["lose_turn"] ?? 0) >= 2)) ||
        (t === "kb_lock"   && (prev === "kb_lock"   || (counts["kb_lock"]   ?? 0) >= 1)) ||
        (t === "half_time" && (prev === "half_time" || (counts["half_time"] ?? 0) >= 2));
      let eff: typeof CALL_SHEET[number];
      let tries = 0;
      do {
        eff = CALL_SHEET[Math.floor(rand.current() * CALL_SHEET.length)];
        tries++;
      } while (isRejected(eff.type) && tries < 20);
      seq.push(eff);
    }
    rollSeqRef.current = seq;
    roundRef.current = 0;
    setRevealed(new Set()); setRound(0); setPhase("pick-letters");
    setStrikes(0); setTotalTime(0); setGuessTime(BASE_TIME);
    setGuessTimer(BASE_TIME); setGuessedLetters(new Set());
    setWrongGuesses([]); setJustRevealed(new Set()); setJustEliminated(new Set());
    setRollResult(null); setRollAnimIdx(-1);
    setLastGuess(null); setPickedLetters([]); setRevealingIdx(-1);
    setSolveMode(false); setSolveCursor(0); setSolveInputs({});
    setSolveAttempts(2); setFinalSolveMode(false); setShakeBoard(false);
    setRoundKbLock(false); setLostTurn(false);
    setGuessesThisRound(1); setGuessesRemaining(1);
    guessesRemainingRef.current = 1;
    setGuessResolving(false);
    setLostRounds(new Set());
    setTurnWarning(null);
    setFanfareLetter(null); setFanfareCount(0);
    setTileBlinking(null); setTilesPopping(new Set()); setTilesLit(new Set());
    dailyRecorded.current = false;
    setScreen("playing");
  }, [puzzleNumber]);

  useEffect(() => {
    if (screen === "playing" && phase !== "pick-letters" && phase !== "revealing-picks" && phase !== "pre-roll" && phase !== "round-ending") {
      totalRef.current = setInterval(() => setTotalTime(t => t + 1), 1000);
      return () => { if (totalRef.current) clearInterval(totalRef.current); };
    }
    return () => { if (totalRef.current) clearInterval(totalRef.current); };
  }, [screen, phase]);

  useEffect(() => {
    if (phase === "guessing" && !solveMode) {
      setGuessTimer(guessTime);
      guessRef.current = setInterval(() => {
        setGuessTimer(t => {
          if (t <= 1) { if (guessRef.current) clearInterval(guessRef.current); setTimeout(() => advance(), 300); return 0; }
          return t - 1;
        });
      }, 1000);
      return () => { if (guessRef.current) clearInterval(guessRef.current); };
    }
    return () => { if (guessRef.current) clearInterval(guessRef.current); };
  }, [phase, solveMode, guessTime]);

  useEffect(() => { if (solveMode && guessRef.current) clearInterval(guessRef.current); }, [solveMode]);

  useEffect(() => {
    if (screen === "playing" && allDone && phase !== "pick-letters" && phase !== "revealing-picks" && phase !== "pick-double") {
      if (totalRef.current) clearInterval(totalRef.current);
      if (guessRef.current) clearInterval(guessRef.current);
      setTimeout(() => setScreen("solved"), 500);
    }
  }, [revealed, screen, phase, allDone]);

  // Load daily streak + detect already-played from localStorage
  useEffect(() => {
    const today = dateKey;
    const data = readDailyStreak();
    if (data.lastPlayedDate) {
      if (data.lastPlayedDate === today || isYesterday(data.lastPlayedDate, today)) {
        setDailyStreak(data.dailyStreak);
      }
    }
    const todayEntry = data.history.find(h => h.dateKey === today);
    if (todayEntry) setAlreadyPlayed(todayEntry);
  }, [dateKey]);

  // Freshness guard: if server-rendered dateKey is stale, refresh the page
  useEffect(() => {
    const clientDate = getNyDateKey(new Date());
    if (clientDate !== dateKey) {
      router.refresh();
      return;
    }
    // Also re-check when tab becomes visible (handles bfcache / tab sleep)
    const onVisibility = () => {
      if (document.visibilityState === "visible" && getNyDateKey(new Date()) !== dateKey) {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [dateKey, router]);

  // Turn warning popup
  useEffect(() => {
    if (screen !== "playing" || phase !== "pre-roll") return;
    const turnsLeft = MAX_ROUNDS - round;
    if (turnsLeft <= 3) {
      const msg = turnsLeft === 1 ? "Last round!" : `${turnsLeft} rounds left!`;
      setTurnWarning(msg);
      const t = setTimeout(() => setTurnWarning(null), 2000);
      return () => clearTimeout(t);
    }
  }, [round, phase, screen]);

  // Record daily streak when game ends
  useEffect(() => {
    if (screen !== "solved" && screen !== "failed") return;
    if (dailyRecorded.current) return;
    dailyRecorded.current = true;
    const today = dateKey;
    const data = readDailyStreak();
    if (data.lastPlayedDate === today) {
      setDailyStreak(data.dailyStreak);
      return;
    }
    const newStreak = data.lastPlayedDate && isYesterday(data.lastPlayedDate, today)
      ? data.dailyStreak + 1
      : 1;
    const newBest = Math.max(newStreak, data.bestDailyStreak);
    const roundsUsed = Math.min(MAX_ROUNDS, round + 1);
    const entry: RolesHistoryEntry = {
      dateKey: today,
      puzzleNumber,
      solved: screen === "solved",
      strikes,
      timeSecs: totalTime,
      roundsUsed,
    };
    const alreadyLogged = data.history.some(h => h.dateKey === today);
    writeDailyStreak({
      lastPlayedDate: today,
      dailyStreak: newStreak,
      bestDailyStreak: newBest,
      history: alreadyLogged ? data.history : [...data.history, entry],
    });
    setDailyStreak(newStreak);

    // Save to Supabase (if logged in)
    const won = screen === "solved";
    saveGameResult({
      game: "roles",
      dateKey: today,
      solved: won,
      strikes,
      roundsUsed,
      timeSecs: totalTime,
    });
  }, [screen, strikes, totalTime, puzzleNumber, round, dateKey]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const flash = (letters: string[]) => {
    setJustRevealed(new Set(letters));
    setTimeout(() => setJustRevealed(new Set()), 900);
  };

  const flashEliminated = (letters: string[]) => {
    setJustEliminated(new Set(letters));
    setTimeout(() => setJustEliminated(new Set()), 900);
  };

  // Wheel-of-Fortune style: two-pass reveal
  // Pass 1: blink each position → light it up (amber glow)
  // (optional onLitComplete callback — e.g. show fanfare between passes)
  // Pass 2: reveal each position one at a time (show letter with pop)
  const staggerRevealLetter = (letter: string, onDone: () => void) => {
    const positions: { word: string; index: number }[] = [];
    puzzle.actor.split("").forEach((ch, i) => {
      if (normalizeLetter(ch) === letter) positions.push({ word: "actor", index: i });
    });
    puzzle.character.split("").forEach((ch, i) => {
      if (normalizeLetter(ch) === letter) positions.push({ word: "character", index: i });
    });
    if (positions.length === 0) { onDone(); return; }

    // Pass 1: Light up
    let lightIdx = 0;
    const lightUp = () => {
      if (lightIdx >= positions.length) {
        setTileBlinking(null);
        setTimeout(revealAll, 500);
        return;
      }
      const pos = positions[lightIdx];
      const key = `${pos.word}-${pos.index}`;
      setTileBlinking(key);
      lightIdx++;
      setTimeout(() => {
        setTileBlinking(null);
        setTilesLit(prev => { const n = new Set(prev); n.add(key); return n; });
        setTimeout(lightUp, 200);
      }, 350);
    };

    // Pass 2: Reveal (visual order: actor left→right, then character left→right)
    const revealOrder = [...positions].sort((a, b) => {
      if (a.word !== b.word) return a.word === "actor" ? -1 : 1;
      return a.index - b.index;
    });
    let revIdx = 0;
    const revealAll = () => {
      if (revIdx >= revealOrder.length) {
        setRevealed(p => { const n = new Set(p); n.add(letter); return n; });
        setTimeout(() => { setTilesPopping(new Set()); setTilesLit(new Set()); onDone(); }, 400);
        return;
      }
      const pos = revealOrder[revIdx];
      const key = `${pos.word}-${pos.index}`;
      setTilesLit(prev => { const n = new Set(prev); n.delete(key); return n; });
      setTilesPopping(prev => { const n = new Set(prev); n.add(key); return n; });
      revIdx++;
      setTimeout(revealAll, 250);
    };

    lightUp();
  };

  const advance =() => {
    if (screenRef.current !== "playing") return;
    setSolveMode(false); setSolveCursor(0); setSolveInputs({});
    setGuessResolving(false);
    setRoundKbLock(false); setGuessTime(BASE_TIME); setLostTurn(false);
    setLastGuess(null); setTileBlinking(null); setTilesPopping(new Set()); setTilesLit(new Set());
    const next = roundRef.current + 1;
    if (next >= MAX_ROUNDS) {
      if (totalRef.current) clearInterval(totalRef.current);
      if (guessRef.current) clearInterval(guessRef.current);
      setFinalSolveMode(true);
      setSolveAttempts(1);
      setGuessesRemaining(0);
      guessesRemainingRef.current = 0;
      setPhase("guessing");
      setSolveMode(true);
      return;
    }
    else {
      roundRef.current = next;
      setRound(next); setRollResult(null);
      setGuessesThisRound(1); setGuessesRemaining(1);
      guessesRemainingRef.current = 1;
      setTimeout(() => setPhase("pre-roll"), 400);
    }
  };

  const handleSpin = () => { autoRoll(round); };

  const restartGuessClock = () => {
    if (guessRef.current) clearInterval(guessRef.current);
    setGuessTimer(guessTime);
    guessRef.current = setInterval(() => {
      setGuessTimer(t => {
        if (t <= 1) { if (guessRef.current) clearInterval(guessRef.current); setTimeout(() => advance(), 300); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const consumeGuess = (): number => {
    const nextRemaining = Math.max(0, guessesRemainingRef.current - 1);
    guessesRemainingRef.current = nextRemaining;
    setGuessesRemaining(nextRemaining);

    if (nextRemaining > 0) {
      restartGuessClock();
    } else {
      if (guessRef.current) clearInterval(guessRef.current);
      setPhase("round-ending");
      setTimeout(() => advance(), 800);
    }
    return nextRemaining;
  };

  const spinLetter = (letter: string) => {
    const ng = new Set(guessedLetters); ng.add(letter); setGuessedLetters(ng);
    if (allLetters.has(letter)) {
      setRevealed(p => { const n = new Set(p); n.add(letter); return n; });
      flash([letter]);
      return true;
    } else {
      setWrongGuesses(p => [...p, letter]);
      flashEliminated([letter]);
      return false;
    }
  };

  // ─── PICK LETTERS ───
  const isPicking = phase === "pick-letters" || phase === "pick-double";
  const pickMax = phase === "pick-double" ? 2 : 3;

  const handlePickLetter = (letter: string) => {
    if (!isPicking || pickedLetters.length >= pickMax) return;
    const u = letter.toUpperCase();
    if (pickedLetters.includes(u)) return;
    // During double guess, can't pick already guessed/revealed letters
    if (phase === "pick-double" && (guessedLetters.has(u) || revealed.has(u))) return;
    const np = [...pickedLetters, u];
    setPickedLetters(np);
    if (np.length >= pickMax) {
      if (phase === "pick-double") setTimeout(() => revealDoubleGuess(np), 400);
      else setTimeout(() => revealPicked(np), 400);
    }
  };

  const handlePickBackspace = () => {
    if (!isPicking || pickedLetters.length === 0) return;
    setPickedLetters(prev => prev.slice(0, -1));
  };

  const revealPicked = (letters: string[]) => {
    setPhase("revealing-picks");

    // Mark all as guessed
    setGuessedLetters(prev => {
      const n = new Set(prev);
      letters.forEach(l => n.add(l));
      return n;
    });

    // Collect all hit positions in picked-letter order
    const allPositions: { word: string; index: number; letter: string }[] = [];
    for (const letter of letters) {
      if (!allLetters.has(letter)) continue;
      puzzle.actor.split("").forEach((ch, i) => {
        if (normalizeLetter(ch) === letter) allPositions.push({ word: "actor", index: i, letter });
      });
      puzzle.character.split("").forEach((ch, i) => {
        if (normalizeLetter(ch) === letter) allPositions.push({ word: "character", index: i, letter });
      });
    }

    // Mark misses immediately
    letters.filter(l => !allLetters.has(l)).forEach(l => {
      setWrongGuesses(p => [...p, l]);
    });

    // ── Pass 1: Light up each position one at a time ──
    let lightIdx = 0;
    let currentLetter: string | null = null;

    const lightUp = () => {
      if (lightIdx >= allPositions.length) {
        setTileBlinking(null);
        setTimeout(revealAll, 600);
        return;
      }
      const pos = allPositions[lightIdx];
      const key = `${pos.word}-${pos.index}`;

      // Track which picked letter we're on (for the 3-slot highlight)
      if (pos.letter !== currentLetter) {
        currentLetter = pos.letter;
        setRevealingIdx(letters.indexOf(pos.letter));
      }

      setTileBlinking(key);
      lightIdx++;
      setTimeout(() => {
        setTileBlinking(null);
        setTilesLit(prev => { const n = new Set(prev); n.add(key); return n; });
        setTimeout(lightUp, 200);
      }, 350);
    };

    // ── Pass 2: Reveal each position one at a time (visual order: top-left → bottom-right) ──
    const revealOrder = [...allPositions].sort((a, b) => {
      if (a.word !== b.word) return a.word === "actor" ? -1 : 1;
      return a.index - b.index;
    });
    let revIdx = 0;

    const revealAll = () => {
      if (revIdx >= revealOrder.length) {
        setRevealed(prev => {
          const n = new Set(prev);
          letters.forEach(l => { if (allLetters.has(l)) n.add(l); });
          return n;
        });
        setTimeout(() => {
          setTilesPopping(new Set()); setTilesLit(new Set());
          setRevealingIdx(-1);
          setTimeout(() => setPhase("pre-roll"), 600);
        }, 400);
        return;
      }
      const pos = revealOrder[revIdx];
      const key = `${pos.word}-${pos.index}`;
      setTilesLit(prev => { const n = new Set(prev); n.delete(key); return n; });
      setTilesPopping(prev => { const n = new Set(prev); n.add(key); return n; });
      revIdx++;
      setTimeout(revealAll, 250);
    };

    setTimeout(lightUp, 400);
  };

  const revealDoubleGuess = (letters: string[]) => {
    setPhase("round-ending");

    // Mark all as guessed
    setGuessedLetters(prev => {
      const n = new Set(prev);
      letters.forEach(l => n.add(l));
      return n;
    });

    // Collect all hit positions in picked-letter order
    const allPositions: { word: string; index: number; letter: string }[] = [];
    for (const letter of letters) {
      if (!allLetters.has(letter)) continue;
      puzzle.actor.split("").forEach((ch, i) => {
        if (normalizeLetter(ch) === letter) allPositions.push({ word: "actor", index: i, letter });
      });
      puzzle.character.split("").forEach((ch, i) => {
        if (normalizeLetter(ch) === letter) allPositions.push({ word: "character", index: i, letter });
      });
    }

    // Mark misses immediately
    letters.filter(l => !allLetters.has(l)).forEach(l => {
      setWrongGuesses(p => [...p, l]);
    });

    // Handle strikes for misses
    const missCount = letters.filter(l => !allLetters.has(l)).length;
    if (missCount > 0) setStrikes(s => s + missCount);

    // ── Pass 1: Light up each position one at a time ──
    let lightIdx = 0;
    let currentLetter: string | null = null;

    const lightUp = () => {
      if (lightIdx >= allPositions.length) {
        setTileBlinking(null);
        setTimeout(revealAll, 600);
        return;
      }
      const pos = allPositions[lightIdx];
      const key = `${pos.word}-${pos.index}`;

      if (pos.letter !== currentLetter) {
        currentLetter = pos.letter;
        setRevealingIdx(letters.indexOf(pos.letter));
      }

      setTileBlinking(key);
      lightIdx++;
      setTimeout(() => {
        setTileBlinking(null);
        setTilesLit(prev => { const n = new Set(prev); n.add(key); return n; });
        setTimeout(lightUp, 200);
      }, 350);
    };

    // ── Pass 2: Reveal each position (visual order: top-left → bottom-right) ──
    const revealOrder = [...allPositions].sort((a, b) => {
      if (a.word !== b.word) return a.word === "actor" ? -1 : 1;
      return a.index - b.index;
    });
    let revIdx = 0;

    const revealAll = () => {
      if (revIdx >= revealOrder.length) {
        setRevealed(prev => {
          const n = new Set(prev);
          letters.forEach(l => { if (allLetters.has(l)) n.add(l); });
          return n;
        });
        setTimeout(() => {
          setTilesPopping(new Set()); setTilesLit(new Set());
          setRevealingIdx(-1);
          // Fanfare with total count of hits
          const hitCount = allPositions.length;
          if (hitCount > 0) {
            fanfareKeyRef.current += 1;
            setFanfareLetter(letters.filter(l => allLetters.has(l)).join("+"));
            setFanfareCount(hitCount);
            setTimeout(() => { setFanfareLetter(null); setFanfareCount(0); }, 2400);
          }
          setTimeout(() => advance(), 800);
        }, 400);
        return;
      }
      const pos = revealOrder[revIdx];
      const key = `${pos.word}-${pos.index}`;
      setTilesLit(prev => { const n = new Set(prev); n.delete(key); return n; });
      setTilesPopping(prev => { const n = new Set(prev); n.add(key); return n; });
      revIdx++;
      setTimeout(revealAll, 250);
    };

    if (allPositions.length === 0) {
      // Both misses — just advance
      setTimeout(() => advance(), 800);
    } else {
      setTimeout(lightUp, 400);
    }
  };

  // ─── ROLE CALL (auto-triggered each round) ───
  // Price-is-Right style: pull up, then spin fast & decelerate to a stop
  const autoRoll = (roundIdx: number) => {
    setPhase("rolling"); setLastGuess(null); setRollResult(null);
    const eff = rollSeqRef.current[roundIdx];
    const n = CALL_SHEET.length;
    const total = 24 + Math.floor(rand.current() * 8);
    const effIdx = CALL_SHEET.indexOf(eff);

    // Calculate start so wind-up(-1) + spin(+total) lands on effIdx
    const startIdx = ((effIdx + 1 - total) % n + n) % n;

    // Phase 1: Show resting position
    windUpRef.current = true;
    setRollAnimIdx(startIdx);

    // Phase 2: Pull wheel UP one notch (like grabbing & pulling)
    setTimeout(() => {
      const upIdx = ((startIdx - 1) + n) % n;
      setRollAnimIdx(upIdx);

      // Phase 3: Pause at top of pull, then release into fast spin
      setTimeout(() => {
        windUpRef.current = false;
        let currentIdx = upIdx;
        let step = 0;

        const tick = () => {
          currentIdx = (currentIdx + 1) % n;
          setRollAnimIdx(currentIdx);
          step++;
          if (step >= total) {
            // Landed on the result — hold it briefly, then reveal
            setTimeout(() => {
              setRollAnimIdx(-1); setRollResult(eff); setPhase("reveal-flash");
              setTimeout(() => applyRollEffect(eff), 900);
            }, 350);
            return;
          }
          // Cubic ease: delay ramps from 50ms (fast) → 420ms (crawl)
          const progress = step / total;
          const eased = progress * progress * progress;
          const delay = 50 + eased * 370;
          setTimeout(tick, delay);
        };

        setTimeout(tick, 50);
      }, 220);
    }, 200);
  };

  const applyRollEffect = (roll: typeof CALL_SHEET[number]) => {
    const t = roll.type;

    if (t === "lose_turn") {
      setGuessResolving(false);
      setLostTurn(true);
      setLostRounds(prev => { const n = new Set(prev); n.add(roundRef.current); return n; });
      setTimeout(() => advance(), 1500);
      return;
    }
    if (t === "half_time") {
      setGuessResolving(false);
      setGuessTime(4);
      setTimeout(() => setPhase("guessing"), 400);
      return;
    }
    if (t === "kb_lock") {
      setGuessResolving(false);
      setRoundKbLock(true);
      setGuessTime(4);
      setTimeout(() => setPhase("guessing"), 400);
      return;
    }
    if (t === "bonus_time") {
      setGuessResolving(false);
      setGuessTime(BASE_TIME + 4);
      setTimeout(() => setPhase("guessing"), 400);
      return;
    }
    if (t === "double_guess") {
      setGuessResolving(false);
      setPickedLetters([]);
      setTimeout(() => setPhase("pick-double"), 400);
      return;
    }

    const isVowel = t === "vowel";
    const count = t === "double_letter" ? 2 : 1;

    const spunLetters = new Set<string>();
    const doSpin = (remaining: number) => {
      if (remaining <= 0) {
        setTimeout(() => setPhase("guessing"), 600);
        return;
      }
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
      let pool = alphabet.filter(l => !guessedLetters.has(l) && !spunLetters.has(l));
      if (isVowel) pool = pool.filter(l => "AEIOU".includes(l));
      if (pool.length === 0) {
        setTimeout(() => setPhase("guessing"), 400);
        return;
      }
      const letter = pool[Math.floor(rand.current() * pool.length)];
      spunLetters.add(letter);
      const isHit = allLetters.has(letter);
      if (isHit) {
        const count = (puzzle.actor + puzzle.character).split("").filter((c) => normalizeLetter(c) === letter).length;
        setLastGuess({ letter, correct: true, fromSpin: true });
        setGuessedLetters(prev => { const n = new Set(prev); n.add(letter); return n; });
        setTimeout(() => {
          staggerRevealLetter(letter, () => {
            // Fanfare after reveal, then continue
            fanfareKeyRef.current += 1;
            setFanfareLetter(letter);
            setFanfareCount(count);
            setTimeout(() => { setFanfareLetter(null); setFanfareCount(0); }, 2400);
            setLastGuess(null);
            setTimeout(() => doSpin(remaining - 1), 800);
          });
        }, 400);
      } else {
        spinLetter(letter);
        setLastGuess({ letter, correct: false, fromSpin: true });
        setTimeout(() => {
          setLastGuess(null);
          doSpin(remaining - 1);
        }, 1200);
      }
    };

    setTimeout(() => doSpin(count), 300);
  };

  // ─── GUESS ───
  const handleLetter = (letter: string) => {
    if (solveMode) { handleSolveType(letter); return; }
    if (phase !== "guessing" || kbLocked || guessResolving) return;
    const u = letter.toUpperCase();
    if (guessedLetters.has(u) || revealed.has(u)) return;
    setGuessResolving(true);

    const ng = new Set(guessedLetters); ng.add(u); setGuessedLetters(ng);
    const isCorrect = allLetters.has(u);
    const newStrikes = isCorrect ? strikes : strikes + 1;
    if (isCorrect) {
      // Pause timer, light up tiles, fanfare, THEN reveal
      if (guessRef.current) clearInterval(guessRef.current);
      const count = (puzzle.actor + puzzle.character).split("").filter((c) => normalizeLetter(c) === u).length;
      setLastGuess({ letter: u, correct: true });
      setTimeout(() => {
        staggerRevealLetter(u, () => {
          // Fanfare after reveal
          fanfareKeyRef.current += 1;
          setFanfareLetter(u);
          setFanfareCount(count);
          setTimeout(() => { setFanfareLetter(null); setFanfareCount(0); }, 2400);
          // Resume
          if (newStrikes >= MAX_STRIKES) {
            setLostRounds(prev => { const n = new Set(prev); n.add(roundRef.current); return n; });
            setTurnWarning("3 strikes \u2014 locked out!");
            setPhase("round-ending");
            lockoutTimer.current = setTimeout(() => { lockoutTimer.current = null; advance(); }, 2500);
            return;
          }
          consumeGuess();
          setGuessResolving(false);
        });
      }, 600);
      return;
    } else {
      setStrikes(newStrikes); setWrongGuesses(p => [...p, u]);
      setLastGuess({ letter: u, correct: false });
    }

    // Keyboard lockout from strikes — show strike first, then lockout
    if (newStrikes >= MAX_STRIKES) {
      if (guessRef.current) clearInterval(guessRef.current);
      setLostRounds(prev => { const n = new Set(prev); n.add(roundRef.current); return n; });
      setTimeout(() => {
        setTurnWarning("3 strikes \u2014 locked out!");
        setPhase("round-ending");
        lockoutTimer.current = setTimeout(() => { lockoutTimer.current = null; advance(); }, 2500);
      }, 1000);
      return;
    }

    consumeGuess();
    setGuessResolving(false);
  };

  // ─── SOLVE ───
  const enterSolveMode = () => {
    const mustUseLetterGuesses = guessesThisRound > 1 && guessesRemaining > 0;
    if (mustUseLetterGuesses || guessResolving) return;
    if (solveAttempts <= 0) return;
    if (guessRef.current) clearInterval(guessRef.current);
    if (lockoutTimer.current) { clearTimeout(lockoutTimer.current); lockoutTimer.current = null; }
    setSolveMode(true); setSolveCursor(0); setSolveInputs({});
  };

  const handleSolveType = (letter: string) => {
    if (!solveMode) return;
    const blanks = blankPositions;
    if (solveCursor >= blanks.length) return;
    const pos = blanks[solveCursor];
    const key = `${pos.word}-${pos.index}`;
    setSolveInputs(prev => ({ ...prev, [key]: letter.toUpperCase() }));
    setSolveCursor(Math.min(solveCursor + 1, blanks.length));
  };

  const handleSolveBackspace = () => {
    if (!solveMode || solveCursor <= 0) return;
    const prev = solveCursor - 1;
    const pos = blankPositions[prev];
    const key = `${pos.word}-${pos.index}`;
    setSolveInputs(p => { const n = { ...p }; delete n[key]; return n; });
    setSolveCursor(prev);
  };

  const handleTileClick = (word: string, index: number) => {
    if (!solveMode) return;
    const idx = blankPositions.findIndex(b => b.word === word && b.index === index);
    if (idx >= 0) setSolveCursor(idx);
  };

  const handleSolveSubmit = () => {
    if (!solveMode) return;
    const allFilled = blankPositions.every(p => solveInputs[`${p.word}-${p.index}`]);
    if (!allFilled) return;
    const actorG = puzzle.actor.split("").map((ch, i) =>
      !isGuessableChar(ch) ? ch : revealed.has(normalizeLetter(ch)) ? normalizeLetter(ch) : (solveInputs[`actor-${i}`] || "?")).join("");
    const charG = puzzle.character.split("").map((ch, i) =>
      !isGuessableChar(ch) ? ch : revealed.has(normalizeLetter(ch)) ? normalizeLetter(ch) : (solveInputs[`character-${i}`] || "?")).join("");
    if (actorG === normalizePhrase(puzzle.actor) && charG === normalizePhrase(puzzle.character)) {
      if (totalRef.current) clearInterval(totalRef.current); setScreen("solved");
    } else {
      if (finalSolveMode) {
        const nextStrikes = strikes + 1;
        setStrikes(nextStrikes);
        setShakeBoard(true); setTimeout(() => setShakeBoard(false), 500);
        setSolveInputs({}); setSolveCursor(0);
        if (nextStrikes >= MAX_STRIKES) { if (totalRef.current) clearInterval(totalRef.current); setScreen("failed"); }
        return;
      }
      const na = solveAttempts - 1; setSolveAttempts(na);
      setShakeBoard(true); setTimeout(() => setShakeBoard(false), 500);
      setSolveInputs({}); setSolveCursor(0);
      if (na <= 0) { if (totalRef.current) clearInterval(totalRef.current); setScreen("failed"); }
    }
  };

  const cancelSolve = () => {
    if (finalSolveMode) return;
    setSolveMode(false); setSolveCursor(0); setSolveInputs({});
    if (phase === "guessing") {
      guessRef.current = setInterval(() => {
        setGuessTimer(t => {
          if (t <= 1) { if (guessRef.current) clearInterval(guessRef.current); setTimeout(() => advance(), 300); return 0; }
          return t - 1;
        });
      }, 1000);
    }
  };

  // ─── TILES ───
  const renderTiles = (word: string, wordKey: string) => {
    const blanks = blankPositions;
    const cursorBlank = solveMode && solveCursor < blanks.length ? blanks[solveCursor] : null;
    const segments: { ch: string; idx: number }[][] = [];
    let current: { ch: string; idx: number }[] = [], idx = 0;
    for (const ch of word) {
      if (ch === " ") { if (current.length) segments.push(current); current = []; }
      else current.push({ ch, idx });
      idx++;
    }
    if (current.length) segments.push(current);

    return (
      <div className="flex flex-wrap gap-y-1.5 items-center">
        {segments.map((seg, si) => (
          <React.Fragment key={si}>
            <div className="flex gap-1">
              {seg.map(({ ch, idx: i }) => {
                const posKey = `${wordKey}-${i}`;
                const isBlink = tileBlinking === posKey;
                const isPop = tilesPopping.has(posKey);
                const isLit = tilesLit.has(posKey);
                const normalizedCh = normalizeLetter(ch);
                const guessable = isGuessableChar(ch);
                const show = !guessable || revealed.has(normalizedCh) || isOver || isPop;
                const isNew = guessable && justRevealed.has(normalizedCh) && !isOver;
                const solveKey = posKey;
                const solveVal = solveInputs[solveKey];
                const isCursor = solveMode && cursorBlank && cursorBlank.word === wordKey && cursorBlank.index === i;
                const isSolveTyped = solveMode && solveVal && !show;
                const clickable = solveMode && !show;

                let cls;
                if (isBlink) cls = "animate-tileBlink border-2 border-amber-400/60";
                else if (isLit && !isPop) cls = "bg-amber-500/15 border border-amber-400/40";
                else if (isPop && !revealed.has(normalizedCh)) cls = "bg-amber-500/30 text-amber-100 border-2 border-amber-400/60 animate-tilePop";
                else if (isNew) cls = "bg-amber-500/30 text-amber-100 border-2 border-amber-400/60 scale-110";
                else if (show) cls = screen === "solved" ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
                  : screen === "failed" ? "bg-red-500/10 text-red-300/80 border border-red-500/20"
                  : "bg-zinc-800 text-zinc-100 border border-zinc-600/40";
                else if (isCursor) cls = "bg-amber-500/10 border-2 border-amber-400/60";
                else if (isSolveTyped) cls = "bg-zinc-800/50 text-zinc-200 border border-zinc-500/40";
                else cls = "bg-zinc-800/50 border border-zinc-600/30";

                return (
                  <div key={i} onClick={() => clickable && handleTileClick(wordKey, i)}
                    className={`w-10 h-12 rounded flex items-center justify-center text-lg font-bold transition-all duration-200 ${cls} ${clickable ? "cursor-pointer" : ""}`}
                    style={{ fontFamily: "'DM Mono', monospace" }}>
                    {show ? ch : isSolveTyped ? solveVal : ""}
                  </div>
                );
              })}
            </div>
            {si < segments.length - 1 && <div className="w-4" />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const kbRows = [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["Z","X","C","V","B","N","M"],
  ];
  const allSolveFilled = blankPositions.every(p => solveInputs[`${p.word}-${p.index}`]);
  const mustUseLetterGuesses = guessesThisRound > 1 && guessesRemaining > 0;
  const strikesLeft = Math.max(0, MAX_STRIKES - strikes);

  // ─── START ───
  if (screen === "start") {
    return (
      <div className="h-dvh bg-cinematic text-zinc-100 flex flex-col items-center px-6 overflow-y-auto">
        <div className="text-center animate-slideUp max-w-sm my-auto">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <div className="w-2 h-2 rounded-full bg-amber-500/60" />
            <div className="w-2 h-2 rounded-full bg-amber-500/30" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500 mb-2">
            <span className="text-amber-400/70">Movie</span>Games
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-extrabold tracking-tight mb-1 text-zinc-100">
            ROLES
          </h1>
          <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-600 mb-2">
            Daily Puzzle &middot; #{puzzleNumber}
          </p>
          {dailyStreak > 0 && (
            <p className="text-sm text-amber-400 font-bold mb-6 animate-fadeIn">
              {"\u{1F525}"} {dailyStreak} day streak
            </p>
          )}
          {dailyStreak === 0 && <div className="mb-6" />}

          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-5 mb-7 text-left">
            <p className="text-sm text-zinc-300 leading-relaxed mb-4">
              Uncover the <span className="text-amber-400 font-semibold">Actor</span> and <span className="text-amber-400 font-semibold">Character</span> they played.
            </p>
            <div className="space-y-2.5 text-sm mb-4">
              <div className="flex gap-3 items-center">
                <span className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xs">{"\u{1F3AC}"}</span>
                <div><span className="text-zinc-200 font-medium">Role Call</span> <span className="text-zinc-500">effects auto-spins each round</span></div>
              </div>
              <div className="flex gap-3 items-center">
                <span className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/40 flex items-center justify-center text-xs">{"\u2328\uFE0F"}</span>
                <div><span className="text-zinc-200 font-medium">Guess or Solve</span> <span className="text-zinc-500">before time runs out</span></div>
              </div>
            </div>
            <div className="bg-zinc-800/30 rounded-lg p-3 mb-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Role Call effects</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <span className="text-emerald-400/80">{"\u{1F524}"} Letter Spin</span>
                <span className="text-red-400/80">{"\u23ED\uFE0F"} Lose a Turn</span>
                <span className="text-emerald-400/80">{"\u2728"} Double Spin</span>
                <span className="text-red-400/80">{"\u23F3"} Half Time</span>
                <span className="text-emerald-400/80">{"\u{1F170}\uFE0F"} Vowel Spin</span>
                <span className="text-red-400/80">{"\u{1F512}"} Keyboard Lock</span>
                <span className="text-emerald-400/80">{"\u{1F3AF}"} Double Guess</span>
                <span></span>
                <span className="text-emerald-400/80">{"\u23F1\uFE0F"} +4 Seconds</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 pt-3 border-t border-zinc-800/40">
              <span className="text-zinc-400 font-bold">{MAX_ROUNDS} rounds</span> &middot; <span className="text-zinc-400">{BASE_TIME}s to guess</span> &middot; <span className="text-zinc-400">{MAX_STRIKES} wrong = keyboard lock</span>
            </p>
          </div>

          <a href="https://getpasstime.app" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-2 mb-6 hover:border-indigo-400/40 transition-all group">
            <span className="text-sm font-bold text-indigo-400">Passtime</span>
            <span className="text-[11px] text-indigo-300/50">All your events in one place · for iOS</span>
            <span className="text-indigo-400/40 text-xs">↗</span>
          </a>

          <button onClick={startGame}
            className="w-full max-w-xs py-4 rounded-2xl bg-amber-500 text-zinc-950 font-bold text-sm tracking-widest uppercase hover:bg-amber-400 transition-all active:scale-[0.97] shadow-lg shadow-amber-500/20 cursor-pointer">
            Start Puzzle
          </button>

          <Link href="/" className="block mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            &larr; Back to Dashboard
          </Link>
        </div>

        {/* Already-played popup */}
        {alreadyPlayed && (
          <div className="fixed inset-0 z-40 flex items-center justify-center px-6">
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" onClick={() => setAlreadyPlayed(null)} />
            <div className="relative w-full max-w-sm animate-slideUp"
              style={{ background: "radial-gradient(ellipse at 50% 0%, #1c1917 0%, #0a0a0b 60%)" }}>
              <div className="rounded-2xl border border-zinc-800/60 overflow-hidden shadow-2xl shadow-black/60">
                <div className="p-6 text-center">
                  <div className="flex items-center justify-center gap-2.5 mb-3">
                    <span className="text-xl">{"\u{1F3AD}"}</span>
                    <h2 className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>ROLES</h2>
                    <span className="text-xs text-zinc-600">#{puzzleNumber}</span>
                  </div>
                  <p className={`text-sm font-bold mb-4 ${alreadyPlayed.solved ? "text-emerald-400" : "text-red-400/80"}`}>
                    {alreadyPlayed.solved ? "Solved" : "Not this time"} &middot; Today&apos;s puzzle complete
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    {[
                      { v: fmt(alreadyPlayed.timeSecs), l: "Time" },
                      { v: `${alreadyPlayed.strikes}/${MAX_STRIKES}`, l: "Strikes" },
                      { v: `${dailyStreak}`, l: "Streak", icon: "\u{1F525}" },
                    ].map((s, i) => (
                      <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl py-2.5">
                        <p className={`text-lg font-bold ${i === 2 ? "text-amber-400" : "text-zinc-100"}`}>{s.v}{s.icon ?? ""}</p>
                        <p className="text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5">{s.l}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setAlreadyPlayed(null); startGame(); }}
                      className="flex-1 py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm tracking-wide hover:bg-amber-400 transition-all active:scale-[0.97] shadow-lg shadow-amber-500/20 cursor-pointer">
                      Play Again
                    </button>
                    <button onClick={() => setAlreadyPlayed(null)}
                      className="flex-1 py-3 rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 text-sm font-medium tracking-wide hover:bg-zinc-700/60 transition-all active:scale-[0.97] cursor-pointer">
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── RESULTS ───
  if (isOver) {
    const won = screen === "solved";
    const roundsUsed = Math.min(MAX_ROUNDS, round + 1);
    const shareText = `\u{1F3AD} ROLES #${puzzleNumber}\n${won ? "\u2705 Solved" : "\u274C"} \u00B7 Round ${roundsUsed}/${MAX_ROUNDS}\n\u23F1 ${fmt(totalTime)} \u00B7 ${strikes}/${MAX_STRIKES} strikes${dailyStreak > 1 ? ` \u00B7 \u{1F525}${dailyStreak}` : ""}`;
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto">
          <div className="animate-slideUp w-full max-w-sm py-8">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{"\u{1F3AD}"}</span>
                <h1 className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>ROLES</h1>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-lg font-extrabold ${won ? "text-emerald-300" : "text-zinc-400"}`}
                  style={{ fontFamily: "'Playfair Display', serif" }}>{won ? "Solved" : "Not this time"}</span>
                <span className="text-sm text-zinc-500">#{puzzleNumber}</span>
              </div>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 mb-4 text-left space-y-2">
              <p className="text-[9px] uppercase tracking-[0.25em] text-zinc-500">Actor</p>
              {renderTiles(puzzle.actor, "actor")}
              <div className="border-t border-zinc-800/30 my-1" />
              <p className="text-[9px] uppercase tracking-[0.25em] text-zinc-500">Character</p>
              {renderTiles(puzzle.character, "character")}
              <div className="pt-2 border-t border-zinc-800/40">
                <p className="text-xs text-zinc-500"><span className="text-zinc-300 font-medium">{puzzle.movie}</span> ({puzzle.year})</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {[
                { v: fmt(totalTime), l: "Time" },
                { v: `${roundsUsed}/${MAX_ROUNDS}`, l: "Rounds" },
                { v: `${strikes}/${MAX_STRIKES}`, l: "Strikes" },
              ].map((s, i) => (
                <div key={i} className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl py-2.5">
                  <p className="text-lg font-bold text-zinc-100">{s.v}</p>
                  <p className="text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5">{s.l}</p>
                </div>
              ))}
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl py-2.5">
                <p className="text-lg font-bold text-amber-400">{dailyStreak}{"\u{1F525}"}</p>
                <p className="text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5">Streak</p>
              </div>
            </div>
            <div className="flex gap-3 mb-5">
              <button onClick={startGame} className="flex-1 py-3 rounded-xl bg-zinc-100 text-zinc-950 font-bold text-sm active:scale-[0.97] cursor-pointer">Play Again</button>
              <ShareButton text={shareText} />
            </div>

            <Link href="/games/thumbs/daily"
              className="flex items-center gap-3 bg-sky-500/10 border border-sky-400/30 rounded-xl px-5 py-4 hover:border-sky-400/50 hover:bg-sky-500/15 transition-all group text-left">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] uppercase tracking-[0.25em] text-sky-400/50 mb-1.5">Try another game</p>
                <div className="flex items-center gap-2">
                  <span className="text-base">{"\u{1F44D}"}</span>
                  <p className="text-base font-bold text-zinc-100 group-hover:text-sky-300 transition-colors">THUMBS</p>
                </div>
                <p className="text-xs text-zinc-400 mt-1">Guess Siskel &amp; Ebert&apos;s thumbs for 10 movies</p>
              </div>
              <span className="text-sky-400/40 group-hover:text-sky-300/70 transition-colors text-2xl">&rsaquo;</span>
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  // ─── PLAYING ───
  const timerPct = (guessTimer / guessTime) * 100;
  const urgent = guessTimer <= 3;

  return (
    <Shell>
      <div className="relative flex flex-col max-w-md mx-auto w-full flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
        {/* Header */}
        <div className="shrink-0 px-4 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{"\u{1F3AD}"}</span>
              <h1 className="text-lg font-extrabold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>ROLES</h1>
              <span className="text-xs text-zinc-500">#{puzzleNumber}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {Array.from({ length: MAX_STRIKES }).map((_, i) => (
                  <span key={i} className={`text-sm transition-all ${i < strikes ? "text-red-400" : "text-zinc-800"}`}>{"\u2715"}</span>
                ))}
              </div>
              {phase !== "pick-letters" && phase !== "revealing-picks" && (
                <span className="text-sm text-zinc-400 font-mono tabular-nums">{fmt(totalTime)}</span>
              )}
            </div>
          </div>
          <div className="flex gap-1 mt-0.5">
            {Array.from({ length: MAX_ROUNDS }).map((_, i) => {
              const turnsLeft = MAX_ROUNDS - round;
              const isUrgent = turnsLeft <= 3;
              const isCounting = i === round && phase === "guessing" && !solveMode && !lostTurn;
              if (isCounting) {
                return (
                  <div key={i} className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden relative">
                    <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-linear ${urgent ? "bg-red-400" : "bg-amber-400"}`}
                      style={{ width: `${timerPct}%`, transitionDuration: guessTimer === 0 ? "0ms" : "1000ms" }} />
                  </div>
                );
              }
              const blinkClass = turnsLeft === 1 ? "blink-fast" : turnsLeft === 2 ? "blink-med" : "blink-slow";
              return (
                <div key={i} className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                  lostRounds.has(i) ? "bg-red-500/70" :
                  i < round ? "bg-amber-400" :
                  i === round ? "bg-amber-400/50" :
                  isUrgent && i > round ? `bg-zinc-700 ${blinkClass}` :
                  "bg-zinc-800"}`} />
              );
            })}
          </div>
          {(() => {
            const turnsLeft = MAX_ROUNDS - round - 1;
            if (turnsLeft <= 0) return <p className="text-sm text-red-400 font-bold mt-1.5">Last round!</p>;
            if (turnsLeft <= 2) return <p className="text-sm text-amber-500/80 font-semibold mt-1.5">{turnsLeft + 1} rounds left</p>;
            return <p className="text-sm text-zinc-500 mt-1.5">Round {round + 1} of {MAX_ROUNDS}</p>;
          })()}
        </div>

        {/* Board */}
        <div className={`shrink-0 px-4 py-2 relative transition-all duration-200 ${shakeBoard ? "animate-shake" : ""} ${fanfareLetter ? "animate-boardPulse" : ""}`}>
          <div className="bg-zinc-900/60 border border-zinc-700/50 rounded-xl p-3.5 space-y-2">
            <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">Actor</p>
            {renderTiles(puzzle.actor, "actor")}
            <div className="border-t border-zinc-700/30" />
            <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">Character</p>
            {renderTiles(puzzle.character, "character")}
          </div>
          {/* (fanfare toast moved to keyboard area) */}
        </div>

        {/* Action zone — dedicated middle lane so keyboard stays docked */}
        <div className="relative flex-1 min-h-[120px] px-4 pb-2">
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-2">
            {(() => {
              const isPickStart = phase === "pick-letters" || phase === "revealing-picks";
              const isPickDouble = phase === "pick-double";
              const isPreRoll = phase === "pre-roll";
              const isGuessing = phase === "guessing" && !solveMode && !lostTurn;
              const isSolvePanel = solveMode;
              const showWheel = !isPickStart && !isPickDouble && !isPreRoll && !finalSolveMode;

              const isSpinning = phase === "rolling";
              const wheelActive = phase === "rolling" || phase === "reveal-flash" || lostTurn || phase === "guessing" || solveMode;
              const n = CALL_SHEET.length;
              const spinIdx = rollAnimIdx;
              const topEff = isSpinning ? CALL_SHEET[(spinIdx + 1) % n] : rollResult ? (rollSeqRef.current[round + 1] ?? null) : null;
              const centerEff = isSpinning ? (spinIdx >= 0 ? CALL_SHEET[spinIdx] : null) : rollResult;
              const bottomEff = isSpinning ? CALL_SHEET[((spinIdx - 1) + n) % n] : rollResult ? (rollSeqRef.current[round - 1] ?? null) : null;
              const settled = !isSpinning && !!rollResult;
              const centerColor = settled ? (rollResult!.good ? "text-emerald-300" : "text-red-400") : "text-zinc-400";
              const centerBg = settled ? (rollResult!.good ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20") : "bg-transparent border-transparent";
              const wheelDimmed = !wheelActive;

              return (
                <div className="w-full max-w-[320px] flex flex-col items-center">
                  {showWheel && (
                    <div className={`w-full transition-opacity duration-300 ${wheelDimmed ? "opacity-15" : "opacity-100"}`}>
                      <div className="rounded-xl border border-zinc-700/50 overflow-hidden bg-zinc-900/40 mx-auto max-w-[260px] sm:max-w-[280px]">
                        <div className="px-4 py-1.5 flex items-center justify-between opacity-35">
                          <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500" style={{ fontFamily: "'DM Mono', monospace" }}>{topEff ? topEff.label : "\u2014"}</span>
                          <span className="text-xs opacity-60">{topEff?.icon ?? ""}</span>
                        </div>
                        <div className="h-px bg-zinc-800/50" />
                        <div
                          key={isSpinning ? spinIdx : "settled"}
                          className={`px-4 py-2.5 flex items-center justify-between border-y border-transparent transition-colors duration-300 ${centerBg} ${isSpinning ? (windUpRef.current ? "wheel-tick-up" : "wheel-tick") : ""}`}
                        >
                          <div>
                            <p className={`text-base font-bold tracking-widest uppercase transition-colors duration-200 ${centerColor}`} style={{ fontFamily: "'DM Mono', monospace" }}>
                              {centerEff ? centerEff.label : "\u00B7  \u00B7  \u00B7"}
                            </p>
                            <p className={`text-sm mt-0.5 transition-opacity duration-300 ${settled ? "opacity-100" : "opacity-0"} ${rollResult?.good ? "text-emerald-400" : "text-red-400"}`}>
                              {rollResult?.desc ?? "\u00A0"}
                            </p>
                          </div>
                          <span className={`text-base transition-opacity duration-200 ${isSpinning ? "opacity-25" : settled ? "opacity-75" : "opacity-15"}`}>{centerEff?.icon ?? ""}</span>
                        </div>
                        <div className="h-px bg-zinc-800/50" />
                        <div className="px-4 py-1.5 flex items-center justify-between opacity-35">
                          <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500" style={{ fontFamily: "'DM Mono', monospace" }}>{bottomEff ? bottomEff.label : "\u2014"}</span>
                          <span className="text-xs opacity-60">{bottomEff?.icon ?? ""}</span>
                        </div>
                      </div>
                      {lostTurn && (
                        <p className="text-center text-sm text-red-400 font-bold mt-2 animate-fadeIn">{"\u23ED\uFE0F"} Turn lost &mdash; moving on...</p>
                      )}
                    </div>
                  )}

                  {isGuessing && (
                    <div className="animate-fadeIn mt-2 w-full pointer-events-auto">
                      <div className="flex items-center justify-center gap-3">
                        <span className={`font-mono text-base font-bold tabular-nums w-7 text-right ${urgent ? "text-red-400 animate-pulse" : "text-zinc-500"}`}>{guessTimer}s</span>
                        {!kbLocked ? (
                          <p className="text-base text-zinc-300">
                            Guess {guessesRemaining > 1 ? `${guessesRemaining} letters` : "a letter"}
                            {!mustUseLetterGuesses ? " or" : ""}
                          </p>
                        ) : (
                          <p className="text-base text-zinc-400">Keyboard locked &mdash;</p>
                        )}
                        <button
                          onClick={enterSolveMode}
                          disabled={solveAttempts <= 0 || mustUseLetterGuesses || guessResolving}
                          className={`px-5 py-2 rounded-lg font-bold text-sm tracking-wide transition-all active:scale-[0.97] cursor-pointer ${
                            solveAttempts > 0 && !mustUseLetterGuesses && !guessResolving
                              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                              : "bg-zinc-800/30 border border-zinc-800/30 text-zinc-700 cursor-not-allowed"
                          }`}
                        >
                          Solve{solveAttempts < 2 ? ` (${solveAttempts})` : ""}
                        </button>
                      </div>
                    </div>
                  )}

                  {isSolvePanel && (
                    <div className={`animate-fadeIn w-full pointer-events-auto ${finalSolveMode ? "mt-0" : "space-y-2 mt-2"}`}>
                      {finalSolveMode ? (
                        <div className="mx-auto flex w-full max-w-[300px] flex-col items-center gap-3 text-center">
                          <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-400/90">Solve or lose</p>
                          <p className="text-sm text-zinc-300">
                            Rounds over. Submit your final solve with ENTER. <span className="text-zinc-500">{strikesLeft} strike{strikesLeft === 1 ? "" : "s"} left</span>
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button onClick={cancelSolve} className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer">&larr; Back</button>
                          <p className="text-[11px] text-zinc-400">
                            Tap blanks to fill, then press ENTER{" \u00b7 "}
                            <span className="text-zinc-600">{solveAttempts} left</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {isPreRoll && (
                    <div className="mt-3 flex flex-col items-center animate-fadeIn pointer-events-auto">
                      <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-400 mb-2">Round {round + 1}</p>
                      <button
                        onClick={handleSpin}
                        className="px-8 py-3.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-base tracking-wide hover:bg-amber-400 transition-all active:scale-[0.97] shadow-lg shadow-amber-500/20 cursor-pointer"
                      >
                        Spin the Wheel
                      </button>
                    </div>
                  )}

                  {isPickDouble && (
                    <div className="animate-fadeIn flex flex-col items-center pointer-events-auto">
                      <p className="text-base font-bold uppercase tracking-[0.2em] text-amber-400 mb-1">Pick {2 - pickedLetters.length} Letter{2 - pickedLetters.length !== 1 ? "s" : ""}</p>
                      {pickedLetters.length > 0 && (
                        <p className="text-sm text-zinc-400">{pickedLetters.join(", ")} selected</p>
                      )}
                    </div>
                  )}

                  {isPickStart && (
                    <div className="animate-fadeIn flex flex-col items-center pointer-events-auto">
                      <p className="text-base font-bold uppercase tracking-[0.2em] text-amber-400 mb-3">
                        {phase === "revealing-picks" ? "Revealing..." : "Pick 3 Starting Letters"}
                      </p>
                      <div className="flex justify-center gap-3">
                        {Array.from({ length: 3 }).map((_, i) => {
                          const letter = pickedLetters[i];
                          const isHighlighted = phase === "revealing-picks" && revealingIdx >= i;
                          return (
                            <div
                              key={i}
                              className={`w-12 h-14 rounded-lg flex items-center justify-center text-xl font-bold border-2 transition-all duration-300 ${
                                isHighlighted
                                  ? "bg-amber-500/30 text-amber-200 border-amber-400/50 scale-110"
                                  : letter
                                    ? "bg-zinc-800 text-zinc-200 border-zinc-500/60"
                                    : "bg-zinc-800/30 border-zinc-500/40 border-dashed"
                              }`}
                              style={{ fontFamily: "'DM Mono', monospace" }}
                            >
                              {letter ?? ""}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        <div className="sticky bottom-0 z-30 bg-gradient-to-t from-zinc-950 via-zinc-950/96 to-transparent pt-2">
          {/* Float-up toasts — above keyboard */}
          <div className="shrink-0 relative h-0 overflow-visible z-20">
            {fanfareLetter && (
              <div key={fanfareKeyRef.current} className="absolute bottom-0 inset-x-0 flex justify-center pointer-events-none">
                <p className="animate-floatUp text-lg font-bold text-emerald-400 drop-shadow-lg">
                  There {fanfareCount === 1 ? "is" : "are"} {fanfareCount} {fanfareLetter}{fanfareCount > 1 ? "\u2019s" : ""}!
                </p>
              </div>
            )}
            {lastGuess && !lastGuess.correct && (
              <div key={lastGuess.letter} className="absolute bottom-0 inset-x-0 flex justify-center pointer-events-none">
                <p className="animate-floatUp text-lg font-bold drop-shadow-lg text-red-400">
                  {lastGuess.fromSpin
                    ? <>No &ldquo;{lastGuess.letter}&rdquo; in puzzle</>
                    : <>&ldquo;{lastGuess.letter}&rdquo; &mdash; strike!</>}
                </p>
              </div>
            )}
          </div>

          {/* Timer bar above keyboard */}
          {phase === "guessing" && !solveMode && !lostTurn && (
            <div className="shrink-0 px-3 pb-0.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ease-linear ${urgent ? "bg-red-400" : "bg-amber-400"}`}
                  style={{ width: `${timerPct}%`, transitionDuration: guessTimer === 0 ? "0ms" : "1000ms" }} />
              </div>
              <span className={`font-mono text-[11px] font-bold tabular-nums ${urgent ? "text-red-400 animate-pulse" : "text-zinc-500"}`}>{guessTimer}s</span>
            </div>
          )}

          {/* Keyboard — always visible, dimmed when inactive */}
          <div className={`shrink-0 px-1.5 pt-1.5 pb-4 transition-opacity duration-300 ${
            phase === "rolling" || phase === "reveal-flash" || phase === "pre-roll" || phase === "round-ending" || lostTurn ? "opacity-20 pointer-events-none" :
            guessResolving ? "opacity-30 pointer-events-none" :
            fanfareLetter && phase !== "guessing" ? "opacity-30 pointer-events-none" :
            kbLocked && !solveMode ? "opacity-30 pointer-events-none" : "opacity-100"}`}
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
            {kbRows.map((row, ri) => (
              <div key={ri} className="flex justify-center gap-[clamp(3px,0.7vh,6px)] mb-[clamp(3px,0.7vh,6px)]">
                {ri === 2 && (
                  <button onClick={() => solveMode ? handleSolveSubmit() : undefined}
                    disabled={solveMode && !allSolveFilled}
                    className={`border rounded-lg flex-[1.5] h-[clamp(44px,7vh,58px)] text-[clamp(9px,1.6vh,10px)] font-bold tracking-wide flex items-center justify-center ${
                      solveMode && allSolveFilled
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/30"
                        : solveMode
                          ? "bg-zinc-800/30 text-zinc-600 border-zinc-800/30"
                          : "bg-zinc-800/30 text-zinc-600 border-zinc-800/30"
                    }`}>ENTER</button>
                )}
                {row.map(letter => {
                  const isRev = revealed.has(letter);
                  const isWrong = wrongGuesses.includes(letter);
                  const isPicking = phase === "pick-letters" || phase === "pick-double";
                  const isPicked = isPicking && pickedLetters.includes(letter);
                  const isJustElim = justEliminated.has(letter);
                  let canTap = false;
                  if (isPicking) canTap = !isPicked && !(phase === "pick-double" && (guessedLetters.has(letter) || revealed.has(letter)));
                  else if (solveMode) canTap = true;
                  else if (phase === "guessing" && !kbLocked && !guessResolving) canTap = !isRev && !isWrong;

                  let cls = "bg-zinc-800/40 text-zinc-600 border-zinc-800/30";
                  if (isPicking) cls = isPicked ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : canTap ? "bg-zinc-700/60 text-zinc-100 border-zinc-600/40 hover:bg-zinc-600/60" : "bg-zinc-800/40 text-zinc-600 border-zinc-800/30";
                  else if (solveMode) cls = "bg-zinc-700/60 text-zinc-100 border-zinc-600/40 hover:bg-zinc-600/60";
                  else if (isJustElim) cls = "bg-red-500/20 text-red-300 border-red-500/30";
                  else if (isRev) cls = "bg-emerald-500/15 text-emerald-400/80 border-emerald-500/20";
                  else if (isWrong) cls = "bg-red-500/10 text-red-400/40 border-red-500/15";
                  else if (canTap) cls = "bg-zinc-700/60 text-zinc-100 border-zinc-600/40 hover:bg-zinc-600/60 active:bg-amber-500/20";

                  return (
                    <button key={letter}
                      onClick={() => canTap && (isPicking ? handlePickLetter(letter) : handleLetter(letter))}
                      disabled={!canTap}
                      className={`${cls} border rounded-lg flex-1 h-[clamp(44px,7vh,58px)] text-[clamp(13px,2.1vh,15px)] font-bold transition-colors duration-150 disabled:cursor-default cursor-pointer flex items-center justify-center`}>
                      {letter}
                    </button>
                  );
                })}
                {ri === 2 && (
                  <button onClick={() => solveMode ? handleSolveBackspace() : (phase === "pick-letters" || phase === "pick-double") ? handlePickBackspace() : undefined}
                    className={`border rounded-lg flex-[1.5] h-[clamp(44px,7vh,58px)] text-sm font-bold flex items-center justify-center ${
                      solveMode || ((phase === "pick-letters" || phase === "pick-double") && pickedLetters.length > 0)
                        ? "bg-zinc-700/60 text-zinc-300 border-zinc-600/40 cursor-pointer hover:bg-zinc-600/60"
                        : "bg-zinc-800/30 text-zinc-600 border-zinc-800/30"
                    }`}>{"\u232B"}</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Turn warning popup */}
      {turnWarning && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className={`pop-warning bg-zinc-900/95 border rounded-2xl px-8 py-4 text-center shadow-2xl shadow-black/50 ${turnWarning.toLowerCase().includes("locked") ? "border-red-500/40" : "border-amber-500/40"}`}>
            <p className={`font-extrabold text-xl tracking-wide ${turnWarning.toLowerCase().includes("locked") ? "text-red-400" : "text-amber-400"}`}>{turnWarning}</p>
            <p className="text-zinc-500 text-xs mt-1">{turnWarning.toLowerCase().includes("locked") ? "moving on..." : "keep going!"}</p>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-dvh bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden"
      style={{ minHeight: "100svh", fontFamily: "'DM Sans', sans-serif", background: "radial-gradient(ellipse at 50% 0%, #1c1a17 0%, #0f0f11 60%)" }}>
      <RolesStyles />
      <div className="film-grain" />
      {children}
    </div>
  );
}

function RolesStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700&family=DM+Mono:wght@400;500&family=Playfair+Display:wght@700;800&display=swap');
      @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes shake { 0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)} }
      @keyframes wheelTick { 0% { opacity: 0.15; transform: translateY(8px) scale(0.97); } 60% { opacity: 1; transform: translateY(-1px) scale(1.01); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes wheelTickUp { 0% { opacity: 0.15; transform: translateY(-10px) scale(0.97); } 60% { opacity: 1; transform: translateY(2px) scale(1.01); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes popWarn { 0% { opacity:0; transform:scale(0.75); } 15% { opacity:1; transform:scale(1.05); } 25% { transform:scale(1); } 70% { opacity:1; } 100% { opacity:0; transform:scale(0.95); } }
      .pop-warning { animation: popWarn 2s ease-out forwards; }
      @keyframes blink { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
      .blink-slow { animation: blink 1.5s ease-in-out infinite; }
      .blink-med { animation: blink 0.9s ease-in-out infinite; }
      .blink-fast { animation: blink 0.45s ease-in-out infinite; }
      .animate-fadeIn { animation: fadeIn 0.3s ease-out both; }
      .animate-slideUp { animation: slideUp 0.4s ease-out both; }
      .animate-shake { animation: shake 0.4s ease-in-out; }
      @keyframes boardPulse { 0%,100% { border-color: rgba(113,113,122,0.5); } 25%,75% { border-color: rgba(251,191,36,0.5); } 50% { border-color: rgba(251,191,36,0.7); } }
      .animate-boardPulse { animation: boardPulse 0.8s ease-in-out; }
      @keyframes floatUp { 0% { opacity: 1; transform: translateY(0) scale(1); } 50% { opacity: 1; transform: translateY(-40px) scale(1.05); } 100% { opacity: 0; transform: translateY(-90px) scale(1); } }
      .animate-floatUp { animation: floatUp 2.4s ease-out forwards; }
      @keyframes tileBlink { 0% { background: rgba(251,191,36,0.05); } 50% { background: rgba(251,191,36,0.35); box-shadow: 0 0 12px rgba(251,191,36,0.3); } 100% { background: rgba(251,191,36,0.1); } }
      .animate-tileBlink { animation: tileBlink 0.38s ease-in-out; }
      @keyframes tilePop { 0% { transform: scale(1); } 40% { transform: scale(1.18); } 100% { transform: scale(1); } }
      .animate-tilePop { animation: tilePop 0.35s ease-out; }
      .wheel-tick { animation: wheelTick 0.12s ease-out both; }
      .wheel-tick-up { animation: wheelTickUp 0.2s ease-out both; }
      .film-grain { position: fixed; inset: 0; pointer-events: none; opacity: 0.025; z-index: 50;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
    `}</style>
  );
}
