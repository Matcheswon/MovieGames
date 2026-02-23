/**
 * check-runway.mjs
 *
 * Checks how many days of puzzles remain before the cycle repeats.
 * Exit code 0 = needs generation (runway < threshold)
 * Exit code 1 = runway is fine
 *
 * Usage:
 *   node scripts/check-runway.mjs          # default 30-day threshold
 *   node scripts/check-runway.mjs --threshold=60
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const ROLES_EPOCH = "2026-02-17";

const args = process.argv.slice(2);
const thresholdFlag = args.find((a) => a.startsWith("--threshold="));
const threshold = thresholdFlag ? parseInt(thresholdFlag.split("=")[1], 10) : 30;

const dataPath = path.resolve(process.cwd(), "src/data/roles.json");
const raw = await fs.readFile(dataPath, "utf8");
const puzzles = JSON.parse(raw);

const epoch = new Date(ROLES_EPOCH + "T12:00:00");
const now = new Date();
// Use NY timezone date key like the app does
const dateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(now);
const today = new Date(dateKey + "T12:00:00");
const daysElapsed = Math.round((today.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
const runway = puzzles.length - daysElapsed;

console.log(`Puzzles: ${puzzles.length}`);
console.log(`Days elapsed since epoch: ${daysElapsed}`);
console.log(`Runway: ${runway} days`);
console.log(`Threshold: ${threshold} days`);

if (runway < threshold) {
  console.log(`\n⚠ Runway is below threshold — generation needed.`);
  process.exit(0);
} else {
  console.log(`\n✓ Runway is fine.`);
  process.exit(1);
}
