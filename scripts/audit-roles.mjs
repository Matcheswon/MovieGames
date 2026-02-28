/**
 * audit-roles.mjs
 *
 * Audits roles puzzle difficulty distribution and schedule risk.
 *
 * Usage:
 *   node scripts/audit-roles.mjs
 *   node scripts/audit-roles.mjs --date=2026-02-27 --future=21 --past=14
 *   node scripts/audit-roles.mjs --letters=TREAIOSLDMN --hard-low=2 --hard-high=3
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const NY_TIMEZONE = "America/New_York";
const ROLES_EPOCH = "2026-02-17";
const MIN_NORMAL_BETWEEN_HARD = 3;

function getArg(name, fallback) {
  const flag = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  if (!flag) return fallback;
  return flag.slice(name.length + 3);
}

function getNyDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toDateFromKey(key) {
  return new Date(`${key}T12:00:00Z`);
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function normalizeLetters(value) {
  const cleaned = (value ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return [...new Set(cleaned.split(""))];
}

function uniqueLetters(value) {
  return normalizeLetters(value);
}

function ratioCovered(chars, guesses) {
  if (chars.length === 0) return 1;
  let hit = 0;
  for (const ch of chars) {
    if (guesses.has(ch)) hit += 1;
  }
  return hit / chars.length;
}

function puzzleIndexForDateKey(dateKey, length) {
  if (length <= 0) return -1;
  const epoch = new Date(`${ROLES_EPOCH}T12:00:00`);
  const date = new Date(`${dateKey}T12:00:00`);
  const daysSinceEpoch = Math.round((date.getTime() - epoch.getTime()) / 86400000);
  return ((daysSinceEpoch % length) + length) % length;
}

function styleRisk(entry, guessSet) {
  const actorU = uniqueLetters(entry.actor);
  const charU = uniqueLetters(entry.character);
  const comboU = uniqueLetters(`${entry.actor} ${entry.character}`);
  const actorCov = ratioCovered(actorU, guessSet);
  const charCov = ratioCovered(charU, guessSet);
  const comboCov = ratioCovered(comboU, guessSet);

  const pop = entry.popularity ?? 5;
  const charPop = entry.characterPopularity ?? 5;

  const score =
    (1 - actorCov) * 0.5 +
    (1 - charCov) * 0.25 +
    (1 - comboCov) * 0.1 +
    (charPop <= 4 ? 0.2 : 0) +
    (pop <= 6 ? 0.1 : 0);

  return {
    actorCov,
    charCov,
    comboCov,
    score,
  };
}

function getNotFunReason(entry, riskScore) {
  const pop = entry.popularity ?? 8;
  const charPop = entry.characterPopularity ?? pop;

  if (charPop <= 2 && pop <= 7) {
    return `character is too obscure (charPop ${charPop}, pop ${pop})`;
  }
  if (charPop + pop <= 7 && charPop <= 3) {
    return `combined recognition is too low (combined ${charPop + pop})`;
  }
  if (riskScore >= 0.62 && charPop <= 4) {
    return `too punishing for letter flow (style risk ${riskScore.toFixed(3)})`;
  }
  if (riskScore >= 0.67) {
    return `extreme style risk (${riskScore.toFixed(3)})`;
  }

  return null;
}

function hardRuns(puzzles) {
  const runs = [];
  let i = 0;
  while (i < puzzles.length) {
    const isHard = puzzles[i]?.difficulty === "hard";
    let j = i + 1;
    while (j < puzzles.length && (puzzles[j]?.difficulty === "hard") === isHard) j += 1;
    runs.push({ start: i + 1, end: j, length: j - i, isHard });
    i = j;
  }
  return runs
    .filter((r) => r.isHard)
    .sort((a, b) => b.length - a.length || a.start - b.start);
}

function weekWindowCounts(puzzles) {
  const counts = [];
  const n = puzzles.length;
  if (n === 0) return counts;
  for (let start = 0; start < n; start += 1) {
    let hard = 0;
    for (let j = 0; j < 7; j += 1) {
      if (puzzles[(start + j) % n]?.difficulty === "hard") hard += 1;
    }
    counts.push({ start: start + 1, hard });
  }
  return counts;
}

function histogram(values) {
  const map = new Map();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

function hardSpacingViolations(puzzles, minNormalsBetweenHard) {
  const violations = [];
  for (let i = 0; i < puzzles.length; i += 1) {
    if (puzzles[i]?.difficulty !== "hard") continue;
    for (let gap = 1; gap <= minNormalsBetweenHard; gap += 1) {
      const prev = i - gap;
      if (prev < 0) break;
      if (puzzles[prev]?.difficulty === "hard") {
        violations.push({ current: i + 1, prev: prev + 1 });
        break;
      }
    }
  }
  return violations;
}

async function main() {
  const dataPath = path.resolve(process.cwd(), "src/data/roles.json");
  const raw = await fs.readFile(dataPath, "utf8");
  const puzzles = JSON.parse(raw);

  const hardLow = Number(getArg("hard-low", "1"));
  const hardHigh = Number(getArg("hard-high", "2"));
  const past = Number(getArg("past", "14"));
  const future = Number(getArg("future", "14"));
  const letters = getArg("letters", "TREAIOSLDMN");
  const guessLetters = normalizeLetters(letters);
  const guessSet = new Set(guessLetters);

  const dateArg = getArg("date", "");
  const refDateKey = dateArg || getNyDateKey();
  const refDate = toDateFromKey(refDateKey);
  const todayIndex = puzzleIndexForDateKey(refDateKey, puzzles.length);

  const total = puzzles.length;
  const hardCount = puzzles.filter((p) => p.difficulty === "hard").length;
  const hardPct = total > 0 ? (hardCount / total) * 100 : 0;

  console.log("Roles Difficulty Audit");
  console.log("=====================");
  console.log(`File: ${dataPath}`);
  console.log(`Reference date: ${refDateKey}`);
  console.log(`Puzzle count: ${total}`);
  console.log(`Hard count: ${hardCount} (${hardPct.toFixed(1)}%)`);
  console.log(`Target hard/week: ${hardLow}-${hardHigh}`);
  console.log(`Guess letters: ${guessLetters.join("")}`);

  if (todayIndex >= 0) {
    const p = puzzles[todayIndex];
    console.log(
      `Today: #${todayIndex + 1} ${p.actor} / ${p.character} [${p.difficulty ?? "normal"}]`
    );
  }

  const windows = weekWindowCounts(puzzles);
  if (windows.length > 0) {
    const hardVals = windows.map((w) => w.hard);
    const min = Math.min(...hardVals);
    const max = Math.max(...hardVals);
    const avg = hardVals.reduce((s, v) => s + v, 0) / hardVals.length;
    const over = windows.filter((w) => w.hard > hardHigh);
    const under = windows.filter((w) => w.hard < hardLow);

    console.log("");
    console.log("Weekly Window Stats");
    console.log("-------------------");
    console.log(`7-day min/avg/max hard: ${min}/${avg.toFixed(2)}/${max}`);
    console.log(`Windows over budget (> ${hardHigh}): ${over.length}`);
    console.log(`Windows under budget (< ${hardLow}): ${under.length}`);
    const spacingIssues = hardSpacingViolations(puzzles, MIN_NORMAL_BETWEEN_HARD);
    console.log(`Hard spacing violations (< ${MIN_NORMAL_BETWEEN_HARD} normals between hards): ${spacingIssues.length}`);
    console.log("Histogram (hard per 7-day window):");
    for (const [count, freq] of histogram(hardVals)) {
      console.log(`  ${count}: ${freq}`);
    }
  }

  const runs = hardRuns(puzzles);
  console.log("");
  console.log("Hard Streaks");
  console.log("------------");
  if (runs.length === 0) {
    console.log("No hard streaks.");
  } else {
    for (const run of runs.slice(0, 10)) {
      console.log(`  #${run.start}-#${run.end} (${run.length} in a row)`);
    }
  }

  const scored = puzzles.map((p, i) => {
    const risk = styleRisk(p, guessSet);
    const notFunReason = getNotFunReason(p, risk.score);
    return {
      index: i + 1,
      label: p.difficulty ?? "normal",
      popularity: p.popularity ?? 0,
      charPopularity: p.characterPopularity ?? 0,
      actor: p.actor,
      character: p.character,
      movie: p.movie,
      notFunReason,
      ...risk,
    };
  });

  const hardestByStyle = [...scored].sort((a, b) => b.score - a.score).slice(0, 20);
  console.log("");
  console.log("Top Style-Risk Puzzles");
  console.log("----------------------");
  for (const p of hardestByStyle) {
    console.log(
      `  #${p.index} ${p.label} score=${p.score.toFixed(3)} ` +
      `P${p.popularity}/C${p.charPopularity} ` +
      `A${(p.actorCov * 100).toFixed(0)} C${(p.charCov * 100).toFixed(0)} ` +
      `${p.actor} / ${p.character}`
    );
  }

  const hardButLikelyEasy = scored
    .filter((p) => p.label === "hard" && p.score < 0.45 && p.popularity >= 8 && p.charPopularity >= 5)
    .sort((a, b) => a.score - b.score)
    .slice(0, 15);
  const normalButLikelyHard = scored
    .filter((p) => p.label === "normal" && p.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  console.log("");
  console.log("Relabel Candidates");
  console.log("------------------");
  console.log(`Hard -> Normal candidates: ${hardButLikelyEasy.length}`);
  for (const p of hardButLikelyEasy) {
    console.log(
      `  #${p.index} score=${p.score.toFixed(3)} P${p.popularity}/C${p.charPopularity} ` +
      `${p.actor} / ${p.character}`
    );
  }
  console.log(`Normal -> Hard candidates: ${normalButLikelyHard.length}`);
  for (const p of normalButLikelyHard) {
    console.log(
      `  #${p.index} score=${p.score.toFixed(3)} P${p.popularity}/C${p.charPopularity} ` +
      `${p.actor} / ${p.character}`
    );
  }

  const notFun = scored
    .filter((p) => p.notFunReason)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);

  console.log("");
  console.log("Not-Fun Candidates");
  console.log("------------------");
  console.log(`Count: ${notFun.length} (top 25 shown)`);
  for (const p of notFun) {
    console.log(
      `  #${p.index} score=${p.score.toFixed(3)} P${p.popularity}/C${p.charPopularity} ` +
      `${p.actor} / ${p.character} — ${p.notFunReason}`
    );
  }

  console.log("");
  console.log("Schedule Around Reference Date");
  console.log("------------------------------");
  for (let offset = -past; offset <= future; offset += 1) {
    const d = addDays(refDate, offset);
    const key = toDateKey(d);
    const idx = puzzleIndexForDateKey(key, puzzles.length);
    const p = puzzles[idx];
    const tag = offset === 0 ? "<- today" : "";
    console.log(
      `  ${key}  #${idx + 1}  ${(p.difficulty ?? "normal").padEnd(6)}  ${p.actor} / ${p.character} ${tag}`
    );
  }

  const targetPctLow = (hardLow / 7) * 100;
  const targetPctHigh = (hardHigh / 7) * 100;
  console.log("");
  console.log("Budget Check");
  console.log("------------");
  console.log(
    `Hard percent target for ${hardLow}-${hardHigh}/week: ${targetPctLow.toFixed(1)}%-${targetPctHigh.toFixed(1)}%`
  );
  if (hardPct < targetPctLow) {
    console.log("Status: BELOW target range (likely too easy overall).");
  } else if (hardPct > targetPctHigh) {
    console.log("Status: ABOVE target range (likely too hard overall).");
  } else {
    console.log("Status: Within target range.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
