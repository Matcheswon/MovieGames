import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_INPUT = "Siskel and Ebert database and directory.xlsx - movies.csv";
const DEFAULT_OUTPUT = "src/data/ratings.json";

function parseArgs(argv) {
  let input = DEFAULT_INPUT;
  let output = DEFAULT_OUTPUT;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if ((arg === "--input" || arg === "-i") && argv[i + 1]) {
      input = argv[i + 1];
      i += 1;
      continue;
    }

    if ((arg === "--output" || arg === "-o") && argv[i + 1]) {
      output = argv[i + 1];
      i += 1;
    }
  }

  return { input, output };
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        const nextChar = content[i + 1];
        if (nextChar === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function parseIntSafe(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const result = Number.parseInt(trimmed, 10);
  return Number.isNaN(result) ? null : result;
}

function parseThumb(value) {
  const parsed = parseIntSafe(value);
  return parsed === 0 || parsed === 1 ? parsed : null;
}

function toIsoDate(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) {
    return trimmed;
  }

  const month = Number.parseInt(match[1], 10);
  const day = Number.parseInt(match[2], 10);
  let year = Number.parseInt(match[3], 10);

  if (year < 100) {
    year += year >= 30 ? 1900 : 2000;
  }

  if (
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return trimmed;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function pickValue(row, indexByHeader, names) {
  for (const name of names) {
    const index = indexByHeader[name];
    if (index !== undefined) {
      return row[index] ?? "";
    }
  }
  return "";
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), input);
  const outputPath = path.resolve(process.cwd(), output);

  const source = await fs.readFile(inputPath, "utf8");
  const rows = parseCsv(source);

  if (rows.length < 2) {
    throw new Error("CSV file has no data rows.");
  }

  const headerRow = rows[0].map((value) => normalizeHeader(value));
  const indexByHeader = Object.fromEntries(headerRow.map((name, index) => [name, index]));

  const idCounter = new Map();
  const imported = [];
  let skippedNoThumbs = 0;
  let skippedNoTitle = 0;

  for (const row of rows.slice(1)) {
    if (row.length === 1 && String(row[0]).trim() === "") {
      continue;
    }

    const title = String(pickValue(row, indexByHeader, ["title"]).trim());
    const year = parseIntSafe(pickValue(row, indexByHeader, ["year"]));
    const director = String(pickValue(row, indexByHeader, ["director"]).trim());
    const show = String(pickValue(row, indexByHeader, ["show"]).trim());
    const airdateRaw = String(pickValue(row, indexByHeader, ["airdate"]).trim());
    const ebertThumb = parseThumb(pickValue(row, indexByHeader, ["ebert_thumb"]));
    const siskelThumb = parseThumb(pickValue(row, indexByHeader, ["siskel_thumb"]));

    if (!title) {
      skippedNoTitle += 1;
      continue;
    }

    if (ebertThumb === null || siskelThumb === null) {
      skippedNoThumbs += 1;
      continue;
    }

    const fallbackYear = year ?? 0;
    const baseId = `${slugify(title) || "movie"}-${fallbackYear || "unknown"}`;
    const nextCount = (idCounter.get(baseId) ?? 0) + 1;
    idCounter.set(baseId, nextCount);
    const id = nextCount === 1 ? baseId : `${baseId}-${nextCount}`;

    const entry = {
      id,
      title,
      year: fallbackYear,
      director,
      show,
      airdate: toIsoDate(airdateRaw),
      ebert_thumb: ebertThumb,
      siskel_thumb: siskelThumb,
      video_link: normalizeUrl(pickValue(row, indexByHeader, ["video_link"])),
      ebert_link: normalizeUrl(pickValue(row, indexByHeader, ["ebert_link"])),
      siskel_link: normalizeUrl(pickValue(row, indexByHeader, ["siskel_link"]))
    };

    imported.push(
      Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined && value !== ""))
    );
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(imported, null, 2)}\n`, "utf8");

  console.log(`Imported ${imported.length} rows to ${output}.`);
  console.log(`Skipped ${skippedNoThumbs} rows without valid thumbs.`);
  console.log(`Skipped ${skippedNoTitle} rows without title.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
