/**
 * seed-puzzles.mjs
 *
 * Calls Claude Haiku to generate new puzzle entries for a game data file.
 * Sends the existing entries so nothing is repeated.
 *
 * Usage:
 *   node scripts/seed-puzzles.mjs roles
 *   node scripts/seed-puzzles.mjs roles --count=30
 *   node scripts/seed-puzzles.mjs roles --score-all   (backfill unscored entries + retag difficulty)
 *   node scripts/seed-puzzles.mjs roles --rescore-all (re-score ALL entries with current prompts + retag)
 *
 * Requires ANTHROPIC_API_KEY in .env.local or environment.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

// ─── Game configs ─────────────────────────────────────────────────────────────
//
// To add a new game:
//   1. Add an entry here
//   2. Create (or let this script create) the data file at `dataFile`
//
const GAME_CONFIGS = {
  roles: {
    dataFile: "src/data/roles.json",
    description: "iconic movie actor/character pairings for a daily word-guessing puzzle",
    rules: [
      "Actor and character names MUST be in ALL CAPS (e.g. \"JODIE FOSTER\", \"CLARICE STARLING\")",
      "The \"actor\" field must be a real ACTOR or ACTRESS — never a director, writer, or producer",
      "The \"character\" field must be the name of the CHARACTER they played in that movie — fictional or real (for biopics)",
      "POPULARITY MIX: Roughly HALF (not all!) of the entries should be mainstream crowd-pleasers — big blockbusters, beloved comedies, huge franchises. The other half should be moderately well-known — recognizable to regular moviegoers but not universally iconic. Do NOT make every entry a mega-blockbuster; variety in difficulty is important for the game.",
      "AVOID PRESTIGE BIAS: Do NOT over-index on Oscar-bait dramas, arthouse films, or prestige actors (Meryl Streep, Cate Blanchett, Tilda Swinton, etc.). If you include a prestige actor, pick their most ICONIC mainstream role (e.g. Kate Winslet → Rose from Titanic or Clementine from Eternal Sunshine, NOT some obscure period drama).",
      "Only include pairings that most casual movie fans would recognize",
      "The character name must be the character's actual name, not a title (e.g. \"TONY MONTANA\" not \"SCARFACE\")",
      "DIFFICULTY — unique letters: Count the total number of DISTINCT letters across the actor name AND character name (ignoring spaces). Aim for 14 or fewer (normal difficulty). 15-18 unique is OK for well-known pairings — these will be auto-tagged as \"hard\" puzzles with extra rounds. Never exceed 18 unique letters.",
      "DIFFICULTY — total letters: The total letter count (actor + character, no spaces) should be between 10 and 32. Aim for 14-28 (normal). 29-32 is OK for well-known pairings (will be auto-tagged as hard).",
      "DIFFICULTY — character recognition: The character name must be one that a casual moviegoer would recognize or be able to guess from partial letters. Avoid deep-cut character names that only hardcore fans know (e.g. C.C. BAXTER, NICK CHEVOTAREVICH, AILEEN WUORNOS are too obscure).",
      "ERA RULE: Primarily use films from 1980 onward. The only exception for pre-1980 films is truly iconic pairings that the mass majority of people would still recognize today — from ANY era. Examples: Sean Connery as James Bond, Bela Lugosi as Dracula, Boris Karloff as Frankenstein's Monster, Clint Eastwood as Blondie. If a pre-1980 pairing isn't something most people on the street would know, skip it.",
      "Mix eras: 80s, 90s, 2000s, 2010s-2020s (with rare iconic pre-1980 exceptions)",
      "Mix genres: drama, action, comedy, horror, sci-fi, romance",
      "Mix genders and nationalities",
      "Avoid superhero alter-egos (e.g. no SPIDER-MAN, prefer PETER PARKER)",
      "ACTOR CAP: No actor should appear more than 3 times total across all entries (existing + new). If an actor already appears 3 times in the existing entries list, do NOT add another entry for them.",
      "MOVIE CAP: No movie should appear more than 2 times total across all entries. If a movie already has 2 entries, do NOT add another character from that movie.",
      "Each entry must be unique — a different actor AND character than any existing entry",
      "Double-check your work: verify that each actor ACTUALLY played the listed character in the listed movie. Do not guess or hallucinate pairings.",
    ],
    schema: [
      { field: "actor", type: "string", note: "Full name, ALL CAPS" },
      { field: "character", type: "string", note: "Character name, ALL CAPS" },
      { field: "movie", type: "string", note: "Movie title, normal casing" },
      { field: "year", type: "number", note: "Release year" },
    ],
    maxTokens: 4096,
    dedupeKey: (e) => `${e.actor}|${e.character}`,
    existingSummary: (entries) => entries.map(e => `${e.actor} as ${e.character} (${e.movie})`).join("\n"),
    validate: (entry) => {
      const issues = [];
      const actorLetters = entry.actor.replace(/[^A-Z]/gi, "");
      const charLetters = entry.character.replace(/[^A-Z]/gi, "");
      const totalLetters = actorLetters.length + charLetters.length;
      const uniqueLetters = new Set((actorLetters + charLetters).toUpperCase()).size;

      // Hard reject — truly impossible puzzles
      if (uniqueLetters > 18) {
        issues.push(`${uniqueLetters} unique letters (max 18)`);
      }
      if (totalLetters > 32) {
        issues.push(`${totalLetters} total letters (max 32)`);
      }
      if (totalLetters < 10) {
        issues.push(`${totalLetters} total letters (min 10)`);
      }
      if (entry.actor !== entry.actor.toUpperCase()) {
        issues.push("actor name not ALL CAPS");
      }
      if (entry.character !== entry.character.toUpperCase()) {
        issues.push("character name not ALL CAPS");
      }

      // Auto-tag difficulty (not a rejection — sets the field on the entry)
      // Factor in letter frequency: common letters (ETAOINSHRL) are guessed
      // early and reveal more tiles, making puzzles easier even with high unique counts.
      // Also factor in popularity: obscure pairings are harder for players.
      if (issues.length === 0) {
        const COMMON = new Set("ETAOINSHRL");
        const uniqueSet = new Set((actorLetters + charLetters).toUpperCase());
        const uncommon = [...uniqueSet].filter(l => !COMMON.has(l)).length;
        const pop = entry.popularity ?? 10; // assume popular if not scored yet
        const charPop = entry.characterPopularity ?? pop; // fall back to overall popularity

        const isHard =
          // Very short puzzles — few letters means less info per guess, mechanically hard
          totalLetters < 14 ||
          // Popularity override: pop >= 8 means everyone knows the names,
          // so letter mechanics alone shouldn't make it "hard"
          pop < 8 && (
          // High unique + enough uncommon letters to be genuinely hard
          (uniqueLetters >= 15 && uncommon >= 5) ||
          // Very long puzzles
          totalLetters >= 29 ||
          // Short but brutal (high unique-to-total ratio)
          (totalLetters < 20 && uniqueLetters > 12)) ||
          // Moderate unique but heavily uncommon (most guesses miss) — exempt if very popular
          (uniqueLetters >= 13 && uncommon >= 7 && pop < 8) ||
          // Borderline letter difficulty + low popularity → tips to hard
          (uniqueLetters >= 13 && pop <= 5) ||
          (uncommon >= 5 && pop <= 4) ||
          // Obscure overall — hard to guess if you don't recognize the names
          pop <= 5 ||
          // Obscure character name — even if movie/actor are known
          charPop <= 4;

        if (isHard) {
          entry.difficulty = "hard";
        }

      }

      return issues;
    },
  },

  degrees: {
    dataFile: "src/data/degrees.json",
    description: "Six Degrees–style chain puzzles connecting two famous actors through shared movies",
    maxTokens: 8192,
    rules: [
      "Each puzzle connects a START actor to an END actor via a chain of movies and actors",
      "The chain MUST alternate: movie → actor → movie → actor → movie (always starts and ends with a movie)",
      "Chain length MUST be exactly 5 pieces (movie-actor-movie-actor-movie) — this gives 3 degrees of separation",
      "Every connection must be REAL and VERIFIABLE: the start actor must have actually appeared in chain movie 1, chain actor 1 must have appeared in BOTH chain movie 1 AND chain movie 2, and so on, with the end actor having actually appeared in the final chain movie",
      "Use well-known, mainstream actors and movies — primarily from 1980 to present. Iconic pre-1980 films are OK sparingly",
      "Each chain piece needs: type (\"movie\" or \"actor\"), id (unique lowercase slug), name (normal casing), and year (for movies only)",
      "IDs must be unique lowercase slugs — movie titles as condensed lowercase (e.g. \"darkknightrises\", \"apollo13\"), actors as last name (e.g. \"hathaway\", \"bacon\"). If an id might collide with another puzzle's piece, append a number (e.g. \"deniro2\", \"hackman2\")",
      "Include exactly 4 herrings (decoys): 2 movies and 2 actors",
      "Herrings should be THEMATICALLY RELATED to the chain (same era, genre, or commonly associated co-stars) to make them tempting — but they must NOT actually connect to the chain",
      "Herring actors must NOT have appeared in ANY chain movie, and must NOT be the start or end actor. Herring movies must NOT feature ANY chain actor, the start actor, or the end actor",
      "Start and end actors should be household names — people any casual moviegoer would recognize",
      "Mix eras (80s, 90s, 2000s, 2010s-2020s), genres (drama, action, comedy, thriller, sci-fi), genders, and nationalities across puzzles",
      "No repeat start/end actor pairs (even if reversed). Minimize reusing the same actor or movie across different puzzles' chains",
      "CRITICAL: Double-check ALL connections by mentally walking through each actor's filmography. Verify that Actor X actually appeared in Movie Y before including that link. This is the most common source of errors — do not guess or assume filmographies",
    ],
    schema: [
      { field: "start", type: "object", note: '{ "name": "Actor Name" } — the starting actor' },
      { field: "end", type: "object", note: '{ "name": "Actor Name" } — the ending actor' },
      { field: "chain", type: "array", note: '5 objects alternating movie/actor/movie/actor/movie. Each: { "type": "movie"|"actor", "id": "slug", "name": "Display Name", "year": 1994 (movies only) }' },
      { field: "herrings", type: "array", note: '4 objects (2 movies + 2 actors). Same shape as chain pieces' },
    ],
    dedupeKey: (e) => [e.start?.name, e.end?.name].sort().join("|"),
    existingSummary: (entries) => entries.map(e =>
      `${e.start.name} → ${e.end.name} via [${e.chain.map(c => c.name).join(" → ")}]`
    ).join("\n"),
    validate: (entry) => {
      const issues = [];

      // Structure checks
      if (!entry.start?.name) issues.push("missing start.name");
      if (!entry.end?.name) issues.push("missing end.name");

      if (!Array.isArray(entry.chain)) {
        issues.push("chain is not an array");
        return issues;
      }

      // Chain length must be 5
      if (entry.chain.length !== 5) {
        issues.push(`chain length is ${entry.chain.length} (must be 5)`);
      }

      // Chain must alternate movie/actor/movie/actor/movie
      const expectedTypes = ["movie", "actor", "movie", "actor", "movie"];
      for (let i = 0; i < Math.min(entry.chain.length, 5); i++) {
        if (entry.chain[i]?.type !== expectedTypes[i]) {
          issues.push(`chain[${i}] should be ${expectedTypes[i]}, got ${entry.chain[i]?.type}`);
        }
      }

      // All chain pieces must have id + name
      for (let i = 0; i < entry.chain.length; i++) {
        const piece = entry.chain[i];
        if (!piece.id) issues.push(`chain[${i}] missing id`);
        if (!piece.name) issues.push(`chain[${i}] missing name`);
        if (piece.type === "movie" && !piece.year) issues.push(`chain[${i}] (movie) missing year`);
      }

      // Herrings checks
      if (!Array.isArray(entry.herrings)) {
        issues.push("herrings is not an array");
        return issues;
      }
      if (entry.herrings.length !== 4) {
        issues.push(`herrings length is ${entry.herrings.length} (must be 4)`);
      }
      const herringMovies = entry.herrings.filter(h => h.type === "movie").length;
      const herringActors = entry.herrings.filter(h => h.type === "actor").length;
      if (herringMovies !== 2 || herringActors !== 2) {
        issues.push(`herrings should be 2 movies + 2 actors, got ${herringMovies}m + ${herringActors}a`);
      }
      for (let i = 0; i < entry.herrings.length; i++) {
        const h = entry.herrings[i];
        if (!h.id) issues.push(`herrings[${i}] missing id`);
        if (!h.name) issues.push(`herrings[${i}] missing name`);
        if (h.type === "movie" && !h.year) issues.push(`herrings[${i}] (movie) missing year`);
      }

      // Check for duplicate IDs within the puzzle
      const allIds = [...(entry.chain || []), ...(entry.herrings || [])].map(p => p.id).filter(Boolean);
      const idSet = new Set();
      for (const id of allIds) {
        if (idSet.has(id)) issues.push(`duplicate id "${id}"`);
        idSet.add(id);
      }

      return issues;
    },
  },
};

// ─── Load .env.local ──────────────────────────────────────────────────────────
async function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const content = await fs.readFile(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const key = match[1];
      const val = match[2].replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env.local not present — rely on environment
  }
}

// ─── Popularity scoring ──────────────────────────────────────────────────────
async function scorePopularity(entries, apiKey) {
  if (entries.length === 0) return;
  console.log(`\nScoring popularity for ${entries.length} entries...`);

  // Batch into groups of 25 for more consistent scoring
  const BATCH = 25;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const list = batch
      .map((e, j) => `${j + 1}. ${e.actor} as ${e.character} in "${e.movie}" (${e.year})`)
      .join("\n");

    const prompt = `Rate each actor/movie combination on a POPULARITY score from 1-10.

This measures how well-known the ACTOR is to everyday people AND how mainstream the MOVIE is. Focus primarily on the actor's fame — a household-name actor in a lesser-known movie still scores higher than an unknown actor in a blockbuster.

CALIBRATION EXAMPLES (use these as anchors — match these scores):
10 = Household name + mega-hit: Tom Hanks in Forrest Gump, Leonardo DiCaprio in Titanic, Arnold Schwarzenegger in The Terminator, Robin Williams in Aladdin
 9 = A-list celebrity + very well-known movie: Brad Pitt in Fight Club, Jim Carrey in The Truman Show, Samuel L. Jackson in Pulp Fiction, Angelina Jolie in Tomb Raider, Ryan Gosling in Drive, John Travolta in Pulp Fiction, Hugh Jackman in Logan, Julia Roberts in Pretty Woman
 8 = Famous actor + well-known movie: Christian Bale in American Psycho, Joaquin Phoenix in Walk the Line, Cameron Diaz in There's Something About Mary, Jamie Lee Curtis in Halloween, Timothée Chalamet in Dune, Liam Neeson in Schindler's List
 7 = Recognizable actor OR famous actor in a lesser film: Russell Crowe in Gladiator, Orlando Bloom in Pirates of the Caribbean, Jeff Bridges in The Big Lebowski, Renée Zellweger in Bridget Jones's Diary
 5-6 = Known to regular moviegoers: Saoirse Ronan in Little Women, Frances McDormand in Fargo, Vera Farmiga in The Conjuring
 3-4 = Niche: Peter O'Toole in Lawrence of Arabia, Kate Beckinsale in Underworld
 1-2 = Very obscure

IMPORTANT: Most A-list actors (Brad Pitt, Angelina Jolie, Jim Carrey, Ryan Gosling, Samuel L. Jackson, Johnny Depp, Will Smith, Tom Cruise, etc.) should be 9+ regardless of which movie. Do NOT underrate famous actors because a specific movie is less mainstream.

Return ONLY a JSON array of integers, one per entry, in order. Example: [10, 8, 7]

${list}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.warn(`⚠ Popularity scoring failed (${res.status}) — skipping scores for this batch`);
      continue;
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    try {
      const match = text.match(/\[[\s\S]*\]/);
      const scores = JSON.parse(match?.[0] ?? text);
      if (Array.isArray(scores) && scores.length === batch.length) {
        for (let j = 0; j < batch.length; j++) {
          const score = Math.max(1, Math.min(10, Math.round(scores[j])));
          batch[j].popularity = score;
          console.log(`  ${score}/10  ${batch[j].actor} / ${batch[j].character} (${batch[j].movie})`);
        }
      } else {
        console.warn(`⚠ Unexpected score count (got ${scores?.length}, expected ${batch.length}) — skipping`);
      }
    } catch {
      console.warn("⚠ Failed to parse popularity scores — skipping");
    }
  }
}

// ─── Character name recognition scoring ──────────────────────────────────────
async function scoreCharacterPopularity(entries, apiKey) {
  if (entries.length === 0) return;
  console.log(`\nScoring character name recognition for ${entries.length} entries...`);

  const BATCH = 25;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const list = batch
      .map((e, j) => `${j + 1}. "${e.character}" (from ${e.movie})`)
      .join("\n");

    const prompt = `Rate each CHARACTER NAME on how recognizable it is to a CASUAL moviegoer on a scale of 1-10.

This measures the character NAME specifically — would a casual moviegoer recognize or recall this name?

CALIBRATION EXAMPLES (use these as anchors — match these scores):
10 = Universally iconic — everyone knows: FORREST GUMP, DARTH VADER, JAMES BOND, HARRY POTTER, INDIANA JONES, PRINCESS LEIA, LUKE SKYWALKER
 9 = Extremely well-known: TONY STARK, ROCKY BALBOA, KATNISS EVERDEEN, JACK SPARROW, FREDDIE MERCURY, WILLY WONKA, HANNIBAL LECTER
 8 = Very recognizable: TYLER DURDEN, VINCENT VEGA, ROSE (Titanic), ELLE WOODS, PATRICK BATEMAN, LARA CROFT, JOHN MCCLANE
 7 = Well-known to regular moviegoers: FURIOSA, MAXIMUS, LOGAN, BRIDGET JONES, CLARICE STARLING, CATWOMAN, JASON BOURNE
 5-6 = Moderately known — you might recall if prompted: MARTIN RIGGS, AXEL FOLEY, PETER VENKMAN, MIRANDA PRIESTLY, JACK TORRANCE
 3-4 = Hard to recall by name even if you saw the movie: CHRIS GARDNER, ANNIE REED, ALONZO HARRIS, GRACIE HART
 1-2 = Very obscure — almost nobody remembers: SHEBA HART, EILIS LACEY, ADAM BELL, LUKE GLANTON

IMPORTANT: Characters whose name IS the movie title (FORREST GUMP, ROCKY, BRIDGET JONES, ERIN BROCKOVICH) should always score HIGH. Franchise characters (KATNISS, JACK SPARROW, TONY STARK) should score HIGH. Characters from famous movies whose names nobody actually remembers should score LOW.

Return ONLY a JSON array of integers, one per entry, in order. Example: [10, 6, 3]

${list}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.warn(`⚠ Character scoring failed (${res.status}) — skipping`);
      continue;
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    try {
      const match = text.match(/\[[\s\S]*\]/);
      const scores = JSON.parse(match?.[0] ?? text);
      if (Array.isArray(scores) && scores.length === batch.length) {
        for (let j = 0; j < batch.length; j++) {
          const score = Math.max(1, Math.min(10, Math.round(scores[j])));
          batch[j].characterPopularity = score;
          console.log(`  ${score}/10  ${batch[j].character} (${batch[j].movie})`);
        }
      } else {
        console.warn(`⚠ Unexpected score count (got ${scores?.length}, expected ${batch.length}) — skipping`);
      }
    } catch {
      console.warn("⚠ Failed to parse character scores — skipping");
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await loadEnv();

  const args = process.argv.slice(2);
  const gameName = args.find((a) => !a.startsWith("-"));
  const countFlag = args.find((a) => a.startsWith("--count="));
  const count = countFlag ? parseInt(countFlag.split("=")[1], 10) : 10;
  const scoreAll = args.includes("--score-all");
  const rescoreAll = args.includes("--rescore-all");

  if (!gameName || !GAME_CONFIGS[gameName]) {
    console.error("Usage: node scripts/seed-puzzles.mjs <game> [--count=N]");
    console.error(`Available games: ${Object.keys(GAME_CONFIGS).join(", ")}`);
    process.exit(1);
  }

  const config = GAME_CONFIGS[gameName];
  const dataPath = path.resolve(process.cwd(), config.dataFile);

  // Load existing entries
  let existing = [];
  try {
    const raw = await fs.readFile(dataPath, "utf8");
    existing = JSON.parse(raw);
    console.log(`Loaded ${existing.length} existing entries from ${config.dataFile}`);
  } catch {
    console.log(`No existing data file found — will create ${config.dataFile}`);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY is not set.");
    console.error("Add it to .env.local or export it before running this script.");
    process.exit(1);
  }

  // ─── --score-all / --rescore-all: score popularity on existing entries ──────
  if (scoreAll || rescoreAll) {
    if (gameName !== "roles") {
      console.error("--score-all/--rescore-all is only supported for roles");
      process.exit(1);
    }
    const toScore = rescoreAll ? existing : existing.filter((e) => e.popularity == null);
    if (toScore.length === 0) {
      console.log("All entries already have popularity scores.");
    } else {
      if (rescoreAll) console.log("Re-scoring ALL entries with updated prompts...");
      await scorePopularity(toScore, apiKey);
    }
    const toScoreChar = rescoreAll ? existing : existing.filter((e) => e.characterPopularity == null);
    if (toScoreChar.length === 0) {
      console.log("All entries already have character popularity scores.");
    } else {
      await scoreCharacterPopularity(toScoreChar, apiKey);
    }
    // Re-tag difficulty for ALL entries using updated formula
    let retagged = 0;
    for (const entry of existing) {
      const oldDiff = entry.difficulty;
      delete entry.difficulty;
      config.validate(entry); // re-runs auto-tagging with popularity
      const label = `${entry.actor} / ${entry.character}`;
      if (entry.difficulty !== oldDiff) {
        if (entry.difficulty === "hard" && !oldDiff) {
          console.log(`  ↑ Now hard: ${label}`);
          retagged++;
        } else if (!entry.difficulty && oldDiff === "hard") {
          console.log(`  ↓ No longer hard: ${label}`);
          retagged++;
        } else if (!entry.difficulty && oldDiff === "easy") {
          console.log(`  ↑ No longer easy: ${label}`);
          retagged++;
        }
      }
    }
    await fs.writeFile(dataPath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
    console.log(`\n✓ Scored ${toScore.length} entries. Re-tagged ${retagged} difficulty changes.`);
    console.log(`✓ ${config.dataFile} saved with ${existing.length} entries.`);
    return;
  }

  // Build prompt
  const schemaDesc = config.schema
    .map((f) => `  "${f.field}": ${f.type}  // ${f.note}`)
    .join("\n");

  // For roles, send a compact summary instead of the full entry list to save tokens.
  // The programmatic dedup step catches exact duplicates after generation anyway.
  let existingBlock;
  if (gameName === "roles" && existing.length > 0) {
    // Compact: actor/movie counts (for cap awareness) + actor|character pairs (for dedup hints)
    const actorCounts = {};
    const movieCounts = {};
    for (const e of existing) {
      actorCounts[e.actor] = (actorCounts[e.actor] || 0) + 1;
      movieCounts[e.movie] = (movieCounts[e.movie] || 0) + 1;
    }
    const cappedActors = Object.entries(actorCounts)
      .filter(([, c]) => c >= 2)
      .map(([a, c]) => `${a} (${c})`)
      .join(", ");
    const cappedMovies = Object.entries(movieCounts)
      .filter(([, c]) => c >= 2)
      .map(([m, c]) => `${m} (${c})`)
      .join(", ");
    const pairList = existing.map(e => `${e.actor} / ${e.character}`).join(", ");

    existingBlock = `There are ${existing.length} existing entries. Do NOT duplicate any of these actor/character pairs: ${pairList}

Actors near or at the cap (max 3): ${cappedActors || "none"}
Movies at the cap (max 2): ${cappedMovies || "none"}`;
  } else if (existing.length > 0) {
    existingBlock = `DO NOT include any of the following already-existing entries:\n${config.existingSummary(existing)}`;
  } else {
    existingBlock = "No existing entries yet.";
  }

  const prompt = `You are generating data for a daily mobile puzzle game app.

Task: Generate ${count} new entries for the "${gameName}" game.
Game description: ${config.description}

Rules:
${config.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Each entry must match this JSON schema:
{
${schemaDesc}
}

${existingBlock}

Return ONLY a valid JSON array containing exactly ${count} objects. No explanation, no markdown fences, no extra text.`;

  // Use Sonnet for generation (better factual accuracy), Haiku for scoring
  const generationModel = "claude-sonnet-4-5-20250929";
  console.log(`Calling ${generationModel} to generate ${count} new entries for "${gameName}"...`);

  // Call API directly via fetch (no SDK dependency needed)
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: generationModel,
      max_tokens: config.maxTokens || 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`API error ${response.status}: ${body}`);
    process.exit(1);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";

  // Parse response
  let generated;
  try {
    const match = text.match(/\[[\s\S]*\]/);
    generated = JSON.parse(match?.[0] ?? text);
  } catch {
    console.error("Failed to parse response as JSON. Raw response:");
    console.error(text);
    process.exit(1);
  }

  if (!Array.isArray(generated)) {
    console.error("Response was not a JSON array. Raw response:");
    console.error(text);
    process.exit(1);
  }

  // ─── Verification pass: ask the model to fact-check its own pairings ────────
  if (gameName === "roles" && generated.length > 0) {
    console.log(`Verifying ${generated.length} entries...`);
    const verifyList = generated
      .map((e, i) => `${i + 1}. ${e.actor} as ${e.character} in "${e.movie}" (${e.year})`)
      .join("\n");

    const verifyPrompt = `You are a movie fact-checker. For each actor/character/movie combination below, verify:
1. Did this actor ACTUALLY play this character in this movie?
2. Is the character name spelled correctly and the commonly known name?
3. Is this a real movie (not a TV show)?
4. Is the year correct?

Return ONLY a JSON array of integers — the 1-based indices of entries that are WRONG or questionable. If all entries are correct, return an empty array [].

Be strict — if you're not confident an actor played that exact character in that exact movie, flag it.

${verifyList}`;

    const verifyRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: generationModel,
        max_tokens: 1024,
        messages: [{ role: "user", content: verifyPrompt }],
      }),
    });

    if (verifyRes.ok) {
      const verifyData = await verifyRes.json();
      const verifyText = verifyData.content?.[0]?.text ?? "";
      try {
        const flagMatch = verifyText.match(/\[[\s\S]*\]/);
        const flagged = JSON.parse(flagMatch?.[0] ?? verifyText);
        if (Array.isArray(flagged) && flagged.length > 0) {
          const flagSet = new Set(flagged.map((i) => i - 1)); // convert to 0-based
          const beforeVerify = generated.length;
          generated = generated.filter((_, i) => {
            if (flagSet.has(i)) {
              const e = generated[i];
              console.warn(`  ✗ Verification failed: ${e.actor} / ${e.character} (${e.movie})`);
              return false;
            }
            return true;
          });
          const removed = beforeVerify - generated.length;
          if (removed > 0) console.log(`⚠ Verification removed ${removed} suspicious entries.`);
        } else {
          console.log("✓ All entries passed verification.");
        }
      } catch {
        console.warn("⚠ Could not parse verification response — skipping verification");
      }
    } else {
      console.warn(`⚠ Verification call failed (${verifyRes.status}) — skipping`);
    }
  }

  // Deduplicate against existing
  const existingKeys = new Set(existing.map(config.dedupeKey));
  let fresh = generated.filter((e) => !existingKeys.has(config.dedupeKey(e)));
  const dupeSkipped = generated.length - fresh.length;

  // ─── Popularity scoring (before validation so difficulty formula has scores) ───
  if (gameName === "roles" && fresh.length > 0) {
    await scorePopularity(fresh, apiKey);
    await scoreCharacterPopularity(fresh, apiKey);
  }

  // ─── Actor cap: max 3 entries per actor across existing + new ───────────────
  if (gameName === "roles") {
    const actorCounts = {};
    for (const e of existing) {
      actorCounts[e.actor] = (actorCounts[e.actor] || 0) + 1;
    }
    const beforeCap = fresh.length;
    fresh = fresh.filter((e) => {
      const current = actorCounts[e.actor] || 0;
      if (current >= 3) {
        console.warn(`  ✗ Actor cap: ${e.actor} already has ${current} entries — skipping ${e.character}`);
        return false;
      }
      actorCounts[e.actor] = current + 1;
      return true;
    });
    const capped = beforeCap - fresh.length;
    if (capped > 0) console.log(`⚠ Actor cap removed ${capped} entries.`);

    // Movie cap: max 2 entries per movie across existing + new
    const movieCounts = {};
    for (const e of existing) {
      movieCounts[e.movie] = (movieCounts[e.movie] || 0) + 1;
    }
    const beforeMovieCap = fresh.length;
    fresh = fresh.filter((e) => {
      const current = movieCounts[e.movie] || 0;
      if (current >= 2) {
        console.warn(`  ✗ Movie cap: "${e.movie}" already has ${current} entries — skipping ${e.actor} / ${e.character}`);
        return false;
      }
      movieCounts[e.movie] = current + 1;
      return true;
    });
    const movieCapped = beforeMovieCap - fresh.length;
    if (movieCapped > 0) console.log(`⚠ Movie cap removed ${movieCapped} entries.`);

    // Quality gate: reject obscure character names nobody will guess
    const beforeQuality = fresh.length;
    fresh = fresh.filter((e) => {
      const cp = e.characterPopularity ?? 5;
      const p = e.popularity ?? 5;
      if (cp <= 2) {
        console.warn(`  ✗ Too obscure: ${e.actor} / ${e.character} (charPop ${cp}) — nobody will know this character`);
        return false;
      }
      if (cp <= 3 && p <= 6) {
        console.warn(`  ✗ Too niche: ${e.actor} / ${e.character} (pop ${p}, charPop ${cp}) — obscure actor + obscure character`);
        return false;
      }
      return true;
    });
    const qualityRejected = beforeQuality - fresh.length;
    if (qualityRejected > 0) console.log(`⚠ Quality gate removed ${qualityRejected} too-obscure entries.`);
  }

  // Validate entries (runs after scoring so popularity-based difficulty tagging works)
  if (config.validate) {
    const beforeCount = fresh.length;
    let hardCount = 0;
    fresh = fresh.filter((e) => {
      const issues = config.validate(e);
      if (issues.length > 0) {
        // Format label based on game
        const label = gameName === "roles"
          ? `${e.actor} / ${e.character}`
          : gameName === "degrees"
          ? `${e.start?.name} → ${e.end?.name}`
          : `entry`;
        console.warn(`  ✗ Rejected: ${label} — ${issues.join(", ")}`);
        return false;
      }
      if (e.difficulty === "hard") {
        const al = e.actor?.replace(/[^A-Z]/gi, "").length ?? 0;
        const cl = e.character?.replace(/[^A-Z]/gi, "").length ?? 0;
        const ul = new Set(((e.actor ?? "") + (e.character ?? "")).replace(/[^A-Z]/gi, "").toUpperCase()).size;
        console.log(`  ★ Hard: ${e.actor} / ${e.character} (${al + cl} total, ${ul} unique, pop ${e.popularity ?? "?"})`);
        hardCount++;
      }
      return true;
    });
    const rejected = beforeCount - fresh.length;
    if (rejected > 0) console.log(`⚠ Rejected ${rejected} entries that failed validation.`);
    if (hardCount > 0) console.log(`★ Tagged ${hardCount} entries as hard.`);

    // Warn if batch is too niche
    if (gameName === "roles" && fresh.length > 0) {
      const popular = fresh.filter((e) => (e.popularity ?? 0) >= 7).length;
      const pct = Math.round((popular / fresh.length) * 100);
      console.log(`\n📊 Popularity breakdown: ${popular}/${fresh.length} entries (${pct}%) are popularity 7+`);
      if (pct < 50) {
        console.warn(`⚠ Less than half the batch is mainstream (${pct}%). Consider re-running for better results.`);
      }
    }
  }

  const skipped = dupeSkipped + (generated.length - dupeSkipped - fresh.length);

  const merged = [...existing, ...fresh];
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  console.log(`✓ Added ${fresh.length} new entries${skipped > 0 ? ` (${skipped} skipped as duplicates)` : ""}.`);
  console.log(`✓ ${config.dataFile} now has ${merged.length} total entries.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
