"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ThumbWarsMovie } from "@/lib/types";

type Screen = "start" | "playing" | "results";
type ScoreEntry = { siskelOk: number; ebertOk: number };
type ThumbResult = "correct" | "wrong" | null;

type ThumbWarsGameProps = {
  movies: ThumbWarsMovie[];
  mode?: "random" | "daily";
  dateKey?: string;
};

// ─── Daily streak persistence ───
const DAILY_STORAGE_KEY = "moviegames:thumbwars:daily";

type DailyStreakData = {
  lastPlayedDate: string | null;
  dailyStreak: number;
  bestDailyStreak: number;
};

const EMPTY_STREAK: DailyStreakData = { lastPlayedDate: null, dailyStreak: 0, bestDailyStreak: 0 };

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

function ThumbBtn({
  type,
  selected,
  onClick,
  result,
  disabled
}: {
  type: "up" | "down";
  selected: boolean;
  onClick: () => void;
  result: ThumbResult;
  disabled: boolean;
}) {
  const emoji = type === "up" ? "\u{1F44D}" : "\u{1F44E}";
  let cls = "border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-700/50 grayscale";

  if (result === "correct") cls = "border-emerald-400/70 bg-emerald-500/20 scale-110 grayscale-0";
  else if (result === "wrong") cls = "border-red-400/50 bg-red-500/15 opacity-40 scale-95 grayscale-0";
  else if (selected) cls = "border-amber-400/70 bg-amber-500/20 scale-105 grayscale-0";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${cls} border rounded-2xl w-14 h-14 md:w-20 md:h-20 text-xl md:text-3xl flex items-center justify-center transition-all duration-200 active:scale-95 disabled:cursor-default cursor-pointer`}
    >
      {emoji}
    </button>
  );
}

function ScorePip({ status }: { status: "perfect" | "half" | "miss" | "upcoming" }) {
  const color =
    status === "perfect" ? "bg-emerald-400" :
    status === "half" ? "bg-amber-400" :
    status === "miss" ? "bg-red-400/60" :
    "bg-zinc-800 border border-zinc-700/40";
  return <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${color}`} />;
}

function CriticRow({
  name,
  initials,
  pick,
  setPick,
  revealed,
  result,
  movie,
  criticKey
}: {
  name: string;
  initials: string;
  pick: 0 | 1 | null;
  setPick: (v: 0 | 1) => void;
  revealed: boolean;
  result: ThumbResult;
  movie: ThumbWarsMovie | undefined;
  criticKey: "siskel" | "ebert";
}) {
  const actual = movie?.[criticKey];
  return (
    <div className="flex items-center justify-between animate-fadeIn">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 md:w-12 md:h-12 rounded-full bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-[11px] md:text-sm font-bold text-zinc-400">
          {initials}
        </div>
        <div>
          <p className="text-sm md:text-base font-semibold text-zinc-200">{name}</p>
          {revealed && (
            <p className={`text-[10px] md:text-xs font-bold tracking-wider animate-fadeIn ${result === "correct" ? "text-emerald-400" : "text-red-400"}`}>
              {result === "correct" ? "CORRECT" : `NOPE \u2014 ${actual === 1 ? "\u{1F44D}" : "\u{1F44E}"}`}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 md:gap-3">
        <ThumbBtn type="up" selected={pick === 1} onClick={() => !revealed && setPick(1)}
          result={revealed ? (pick === 1 ? result : (actual === 1 ? "correct" : null)) : null} disabled={revealed} />
        <ThumbBtn type="down" selected={pick === 0} onClick={() => !revealed && setPick(0)}
          result={revealed ? (pick === 0 ? result : (actual === 0 ? "correct" : null)) : null} disabled={revealed} />
      </div>
    </div>
  );
}

export function ThumbWarsGame({ movies, mode = "random", dateKey }: ThumbWarsGameProps) {
  const ROUND_SIZE = movies.length;

  const [screen, setScreen] = useState<Screen>("start");
  const [shuffledMovies, setShuffledMovies] = useState<ThumbWarsMovie[]>([]);
  const [index, setIndex] = useState(0);
  const [siskelPick, setSiskelPick] = useState<0 | 1 | null>(null);
  const [ebertPick, setEbertPick] = useState<0 | 1 | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timer, setTimer] = useState(0);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [bestDailyStreak, setBestDailyStreak] = useState(0);
  const dailyRecorded = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const movie = shuffledMovies[index];
  const totalCorrect = scores.reduce((s, r) => s + r.siskelOk + r.ebertOk, 0);
  const totalPossible = scores.length * 2;
  const perfectRounds = scores.filter(r => r.siskelOk && r.ebertOk).length;

  function shuffleArray(arr: ThumbWarsMovie[]) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const startGame = useCallback(() => {
    if (nextTimeoutRef.current) clearTimeout(nextTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    dailyRecorded.current = false;
    setShuffledMovies(mode === "daily" ? movies : shuffleArray(movies));
    setIndex(0);
    setScores([]);
    setStreak(0);
    setBestStreak(0);
    setSiskelPick(null);
    setEbertPick(null);
    setRevealed(false);
    setTimer(0);
    setPosterLoaded(false);
    setScreen("playing");
  }, [movies, mode]);

  // Load daily streak from localStorage
  useEffect(() => {
    if (mode !== "daily") return;
    const data = readDailyStreak();
    // If last played was yesterday or today, show current streak
    if (data.lastPlayedDate && dateKey) {
      if (data.lastPlayedDate === dateKey || isYesterday(data.lastPlayedDate, dateKey)) {
        setDailyStreak(data.dailyStreak);
      }
    }
    setBestDailyStreak(data.bestDailyStreak);
  }, [mode, dateKey]);

  // Record daily streak when game ends
  useEffect(() => {
    if (screen !== "results" || mode !== "daily" || !dateKey || dailyRecorded.current) return;
    dailyRecorded.current = true;
    const data = readDailyStreak();
    if (data.lastPlayedDate === dateKey) {
      // Already recorded today — just sync state
      setDailyStreak(data.dailyStreak);
      setBestDailyStreak(data.bestDailyStreak);
      return;
    }
    const newStreak = data.lastPlayedDate && isYesterday(data.lastPlayedDate, dateKey)
      ? data.dailyStreak + 1
      : 1;
    const newBest = Math.max(newStreak, data.bestDailyStreak);
    writeDailyStreak({ lastPlayedDate: dateKey, dailyStreak: newStreak, bestDailyStreak: newBest });
    setDailyStreak(newStreak);
    setBestDailyStreak(newBest);
  }, [screen, mode, dateKey]);

  useEffect(() => {
    if (screen === "playing") {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [screen]);

  useEffect(() => {
    if (siskelPick !== null && ebertPick !== null && !revealed && screen === "playing") {
      const timeout = setTimeout(() => handleReveal(), 300);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siskelPick, ebertPick]);

  const handleReveal = () => {
    if (!movie) return;
    const siskelOk = siskelPick === movie.siskel ? 1 : 0;
    const ebertOk = ebertPick === movie.ebert ? 1 : 0;
    const perfect = siskelOk && ebertOk;
    const newScores = [...scores, { siskelOk, ebertOk }];
    setScores(newScores);
    setRevealed(true);
    const newStreak = perfect ? streak + 1 : 0;
    setStreak(newStreak);
    if (newStreak > bestStreak) setBestStreak(newStreak);
    nextTimeoutRef.current = setTimeout(() => {
      if (index + 1 >= ROUND_SIZE) {
        if (timerRef.current) clearInterval(timerRef.current);
        setScreen("results");
      } else {
        setIndex(i => i + 1);
        setSiskelPick(null);
        setEbertPick(null);
        setRevealed(false);
        setPosterLoaded(false);
      }
    }, 1200);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const getSiskelResult = (): ThumbResult => !revealed ? null : siskelPick === movie?.siskel ? "correct" : "wrong";
  const getEbertResult = (): ThumbResult => !revealed ? null : ebertPick === movie?.ebert ? "correct" : "wrong";

  // ─── START SCREEN ───
  if (screen === "start") {
    return (
      <div className="min-h-screen bg-cinematic text-zinc-100 flex flex-col items-center justify-center px-6">
        <div className="text-center animate-slideUp">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <div className="w-2 h-2 rounded-full bg-amber-500/60" />
            <div className="w-2 h-2 rounded-full bg-amber-500/30" />
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mb-1">
            <span className="text-amber-400">Movie</span><span className="text-zinc-300">Games</span>
          </h1>
          <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500 mb-2">
            {mode === "daily" ? `Daily Challenge \u00B7 ${dateKey ?? ""}` : "Thumb Wars"}
          </p>
          {mode === "daily" && dailyStreak > 0 && (
            <p className="text-sm text-amber-400 font-bold mb-6 animate-fadeIn">
              {"\u{1F525}"} {dailyStreak} day streak
            </p>
          )}
          {mode !== "daily" && <div className="mb-6" />}

          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-6 mb-8 max-w-sm mx-auto text-left">
            <p className="text-sm text-zinc-300 leading-relaxed mb-4">
              You&apos;ll see <span className="text-amber-400 font-semibold">{ROUND_SIZE} movies</span> that Siskel &amp; Ebert reviewed.
            </p>
            <p className="text-sm text-zinc-300 leading-relaxed mb-4">
              For each movie, guess: did each critic give it a <span className="text-xl align-middle">{"\u{1F44D}"}</span> or a <span className="text-xl align-middle">{"\u{1F44E}"}</span>?
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Pick both thumbs and the round auto-advances. Go fast &mdash; your time is tracked.
            </p>
          </div>

          <div className="flex items-center gap-3 mb-6 justify-center text-xs text-zinc-600">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Both right</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> One right</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400/60 inline-block" /> Both wrong</span>
          </div>

          <button onClick={startGame}
            className="w-full max-w-xs py-4 rounded-2xl bg-amber-500 text-zinc-950 font-bold text-sm tracking-widest uppercase hover:bg-amber-400 transition-all active:scale-[0.97] shadow-lg shadow-amber-500/20 cursor-pointer">
            Start Round
          </button>

          <Link href="/" className="block mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            &larr; Back to Dashboard
          </Link>

          <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-6 opacity-40 hover:opacity-60 transition-opacity">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/tmdb_logo.svg" alt="TMDB" className="h-3" />
          </a>
        </div>
      </div>
    );
  }

  // ─── RESULTS SCREEN ───
  if (screen === "results") {
    const pct = Math.round((totalCorrect / totalPossible) * 100);
    const grade = pct >= 90 ? "S" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 40 ? "C" : "D";
    const gradeColor = pct >= 90 ? "text-amber-300" : pct >= 75 ? "text-emerald-300" : pct >= 60 ? "text-blue-300" : pct >= 40 ? "text-zinc-300" : "text-red-300";
    const flavorText = pct >= 90 ? "You belong in the balcony." : pct >= 75 ? "Two thumbs up for you." : pct >= 60 ? "Not bad \u2014 you know your critics." : pct >= 40 ? "Ebert would be gentle. Siskel\u2026 less so." : "Maybe stick to reading the reviews.";
    const shareText = `\u{1F3AC} MovieGames Thumb Wars${mode === "daily" ? ` \u00B7 ${dateKey}` : ""}\n${scores.map(s => s.siskelOk && s.ebertOk ? "\u{1F7E9}" : s.siskelOk || s.ebertOk ? "\u{1F7E8}" : "\u{1F7E5}").join(" ")}\n${totalCorrect}/${totalPossible} \u00B7 ${formatTime(timer)} \u00B7 ${perfectRounds} perfect rounds${mode === "daily" && dailyStreak > 1 ? ` \u00B7 \u{1F525}${dailyStreak}` : ""}`;

    return (
      <div className="min-h-screen bg-cinematic text-zinc-100 flex flex-col items-center justify-center px-6">
        <div className="text-center animate-slideUp w-full max-w-md">
          <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-600 mb-2">Round Complete</p>
          <div className={`text-6xl md:text-7xl font-extrabold ${gradeColor} mb-1 font-display`}>{grade}</div>
          <p className="text-sm text-zinc-400 mb-6 italic">{flavorText}</p>

          <div className="flex justify-center gap-1.5 mb-6">
            {scores.map((s, i) => {
              const st = s.siskelOk && s.ebertOk ? "perfect" : s.siskelOk || s.ebertOk ? "half" : "miss";
              return <ScorePip key={i} status={st} />;
            })}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl py-3">
              <p className="text-xl font-bold text-zinc-100">{totalCorrect}<span className="text-zinc-600 text-sm">/{totalPossible}</span></p>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Correct</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl py-3">
              <p className="text-xl font-bold text-zinc-100">{formatTime(timer)}</p>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Time</p>
            </div>
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl py-3">
              {mode === "daily" ? (
                <>
                  <p className="text-xl font-bold text-amber-400">{dailyStreak}{"\u{1F525}"}</p>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Day Streak</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-zinc-100">{bestStreak}</p>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Best Streak</p>
                </>
              )}
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-3 mb-6 text-left space-y-1.5 max-h-48 overflow-y-auto">
            {shuffledMovies.slice(0, ROUND_SIZE).map((m, i) => {
              const s = scores[i];
              const status = s?.siskelOk && s?.ebertOk ? "perfect" : s?.siskelOk || s?.ebertOk ? "half" : "miss";
              const color = status === "perfect" ? "bg-emerald-400" : status === "half" ? "bg-amber-400" : "bg-red-400/60";
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                  <span className="text-zinc-400 truncate flex-1">{m.title}</span>
                  <span className="text-zinc-600 shrink-0">S:{m.siskel === 1 ? "\u{1F44D}" : "\u{1F44E}"} E:{m.ebert === 1 ? "\u{1F44D}" : "\u{1F44E}"}</span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button onClick={startGame}
              className="flex-1 py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-sm tracking-wide hover:bg-amber-400 transition-all active:scale-[0.97] shadow-lg shadow-amber-500/20 cursor-pointer">
              Play Again
            </button>
            <button onClick={() => navigator.clipboard?.writeText(shareText)}
              className="flex-1 py-3 rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 text-sm font-medium tracking-wide hover:bg-zinc-700/60 transition-all active:scale-[0.97] cursor-pointer">
              Copy Result
            </button>
          </div>

          <Link href="/" className="block mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            &larr; Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ─── PLAYING SCREEN ───
  if (!movie) return null;

  const siskelResult = getSiskelResult();
  const ebertResult = getEbertResult();
  const bothCorrect = revealed && siskelResult === "correct" && ebertResult === "correct";

  const progressBar = (gap = "gap-1", height = "h-1") => (
    <div className={`flex ${gap}`}>
      {Array.from({ length: ROUND_SIZE }).map((_, i) => {
        let status = "upcoming";
        if (i < scores.length) {
          const s = scores[i];
          status = s.siskelOk && s.ebertOk ? "perfect" : s.siskelOk || s.ebertOk ? "half" : "miss";
        } else if (i === index) status = "current";
        return (
          <div key={i} className={`${height} flex-1 rounded-full transition-all duration-300 ${
            status === "perfect" ? "bg-emerald-400" :
            status === "half" ? "bg-amber-400" :
            status === "miss" ? "bg-red-400/60" :
            status === "current" ? "bg-zinc-500" : "bg-zinc-800"
          }`} />
        );
      })}
    </div>
  );

  const posterCard = (objectFit: "object-contain" | "object-cover") => (
    <>
      {!posterLoaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%]"
          style={{ animation: "shimmer 1.5s ease-in-out infinite" }} />
      )}
      {movie.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={movie.poster} alt={movie.title}
          className={`w-full h-full ${objectFit} transition-opacity duration-400 ${posterLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setPosterLoaded(true)} />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600 text-5xl">
          {"\u{1F3AC}"}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent">
        <h2 className="font-display text-2xl font-bold leading-tight text-zinc-100 animate-fadeIn">
          {movie.title}
        </h2>
        <div className="flex gap-2 text-sm text-zinc-400 mt-0.5">
          <span>{movie.year}</span>
          <span className="text-zinc-600">&middot;</span>
          <span>{movie.director}</span>
        </div>
      </div>
      {revealed && (
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
          bothCorrect ? "bg-emerald-400/5" : "bg-red-400/5"
        }`} />
      )}
    </>
  );

  return (
    <div className="h-screen bg-cinematic text-zinc-100 flex flex-col overflow-hidden">

      {/* ── MOBILE LAYOUT ── */}
      <div className="flex flex-col h-full md:hidden">
        {/* Top bar */}
        <div className="shrink-0 px-4 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
              <span className="text-amber-400 font-semibold">Movie</span>Games
            </p>
            <div className="flex items-center gap-3">
              {streak >= 2 && <span className="text-xs text-amber-400 font-bold animate-fadeIn">{"\u{1F525}"} {streak}</span>}
              <span className="text-xs text-zinc-500 font-mono tabular-nums">{formatTime(timer)}</span>
            </div>
          </div>
          {progressBar()}
          <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
            <span><span className="text-amber-400 font-bold">{index + 1}</span> of {ROUND_SIZE}</span>
            <span>{totalCorrect} correct</span>
          </div>
        </div>

        {/* Poster: fills available space */}
        <div className="flex-1 min-h-0 px-4 py-2" key={`poster-${index}`}>
          <div className={`relative h-full rounded-2xl overflow-hidden border transition-all duration-500 ${
            revealed
              ? bothCorrect ? "border-emerald-500/40 shadow-lg shadow-emerald-500/10" : "border-red-500/30 shadow-lg shadow-red-500/10"
              : "border-zinc-800/60"
          }`}>
            {posterCard("object-contain")}
          </div>
        </div>

        {/* Voting controls */}
        <div className="shrink-0 px-4 pb-4 pt-2" key={`vote-${index}`}>
          <div className="space-y-3">
            <CriticRow name="Siskel" initials="GS" pick={siskelPick} setPick={setSiskelPick}
              revealed={revealed} result={siskelResult} movie={movie} criticKey="siskel" />
            <CriticRow name="Ebert" initials="RE" pick={ebertPick} setPick={setEbertPick}
              revealed={revealed} result={ebertResult} movie={movie} criticKey="ebert" />
          </div>
        </div>
      </div>

      {/* ── DESKTOP LAYOUT ── */}
      <div className="hidden md:flex flex-col h-full">
        {/* Desktop top bar */}
        <div className="shrink-0 px-8 pt-5 pb-2 max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-600">
              <span className="text-amber-400 font-semibold">Movie</span>Games
            </p>
            <div className="flex items-center gap-4">
              {streak >= 2 && <span className="text-sm text-amber-400 font-bold animate-fadeIn">{"\u{1F525}"} {streak}</span>}
              <span className="text-sm text-zinc-500 font-mono tabular-nums">{formatTime(timer)}</span>
            </div>
          </div>
          {progressBar("gap-1.5", "h-1.5")}
        </div>

        {/* Desktop main: poster + controls side by side */}
        <div className="flex-1 min-h-0 flex items-center justify-center px-8 gap-8 max-w-5xl mx-auto w-full">
          {/* Left: poster */}
          <div className="h-full max-h-[520px] py-4 shrink-0" style={{ width: "340px" }} key={`dposter-${index}`}>
            <div className={`relative h-full rounded-2xl overflow-hidden border transition-all duration-500 ${
              revealed
                ? bothCorrect ? "border-emerald-500/40 shadow-lg shadow-emerald-500/10" : "border-red-500/30 shadow-lg shadow-red-500/10"
                : "border-zinc-800/60"
            }`}>
              {posterCard("object-cover")}
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex flex-col justify-center max-w-md flex-1" key={`dvote-${index}`}>
            <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 mb-1">
              {index + 1} of {ROUND_SIZE}
            </p>
            <p className="text-sm text-zinc-400 mb-8">What were their thumbs?</p>
            <div className="space-y-7">
              <CriticRow name="Siskel" initials="GS" pick={siskelPick} setPick={setSiskelPick}
                revealed={revealed} result={siskelResult} movie={movie} criticKey="siskel" />
              <CriticRow name="Ebert" initials="RE" pick={ebertPick} setPick={setEbertPick}
                revealed={revealed} result={ebertResult} movie={movie} criticKey="ebert" />
            </div>
            <div className="flex items-center gap-5 mt-10 pt-6 border-t border-zinc-800/40 text-xs text-zinc-600">
              <span>{totalCorrect} correct</span>
              <span>{perfectRounds} perfect</span>
              {streak >= 2 && <span className="text-amber-400 font-bold">{"\u{1F525}"} {streak} streak</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
