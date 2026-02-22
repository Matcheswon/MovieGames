/**
 * seed-puzzles.mjs
 *
 * Calls Claude Haiku to generate new puzzle entries for a game data file.
 * Sends the existing entries so nothing is repeated.
 *
 * Usage:
 *   node scripts/seed-puzzles.mjs roles
 *   node scripts/seed-puzzles.mjs roles --count=30
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
      "Only include pairings that most casual movie fans would recognize",
      "The character name must be the character's actual name, not a title (e.g. \"TONY MONTANA\" not \"SCARFACE\")",
      "Mix eras: classic Hollywood, 70s-80s, 90s, 2000s, 2010s-2020s",
      "Mix genres: drama, action, comedy, horror, sci-fi, romance",
      "Mix genders and nationalities",
      "Avoid superhero alter-egos (e.g. no SPIDER-MAN, prefer PETER PARKER)",
      "Each entry must be unique — a different actor AND character than any existing entry",
    ],
    schema: [
      { field: "actor", type: "string", note: "Full name, ALL CAPS" },
      { field: "character", type: "string", note: "Character name, ALL CAPS" },
      { field: "movie", type: "string", note: "Movie title, normal casing" },
      { field: "year", type: "number", note: "Release year" },
    ],
    dedupeKey: (e) => `${e.actor}|${e.character}`,
    existingSummary: (entries) => entries.map(e => `${e.actor} as ${e.character} (${e.movie})`).join("\n"),
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

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await loadEnv();

  const args = process.argv.slice(2);
  const gameName = args.find((a) => !a.startsWith("-"));
  const countFlag = args.find((a) => a.startsWith("--count="));
  const count = countFlag ? parseInt(countFlag.split("=")[1], 10) : 20;

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

  // Build prompt
  const schemaDesc = config.schema
    .map((f) => `  "${f.field}": ${f.type}  // ${f.note}`)
    .join("\n");

  const existingBlock = existing.length > 0
    ? `DO NOT include any of the following already-existing entries:\n${config.existingSummary(existing)}`
    : "No existing entries yet.";

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

  console.log(`Calling claude-haiku to generate ${count} new entries for "${gameName}"...`);

  // Call API directly via fetch (no SDK dependency needed)
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
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

  // Deduplicate against existing
  const existingKeys = new Set(existing.map(config.dedupeKey));
  const fresh = generated.filter((e) => !existingKeys.has(config.dedupeKey(e)));
  const skipped = generated.length - fresh.length;

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
