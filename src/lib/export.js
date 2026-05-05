import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

/**
 * Converts an array of flat objects to a TSV string.
 */
export function toTSV(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join("\t"),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] ?? "";
          return String(val).includes("\t") ? `"${val}"` : String(val);
        })
        .join("\t"),
    ),
  ];
  return lines.join("\n");
}

export function writeTSV(filePath, rows) {
  // Create the destination folder if it does not exist
  mkdirSync(dirname(filePath), { recursive: true });

  const content = toTSV(rows);
  writeFileSync(filePath, content, "utf-8");
  console.log(`\nExported to ${filePath} (${rows.length} row(s)).`);
}

/**
 * Returns a filesystem-safe ISO datetime string: 2026-05-05T15-43
 */
export function isoDatetime() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hours = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  return `${date}T${hours}-${mins}`;
}
