import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

/**
 * Flattens an object recursively using dot notation for nested objects.
 * Arrays are serialized as JSON strings and primitives are kept as-is.
 * null and undefined become empty strings. Empty objects are represented as "{}".
 */
export function flattenObject(value, prefix = "", result = {}) {
  if (value === null || value === undefined) {
    if (prefix) result[prefix] = "";
    return result;
  }

  if (Array.isArray(value)) {
    // Keep arrays as JSON in one cell
    if (prefix) result[prefix] = JSON.stringify(value);
    return result;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value);

    if (entries.length === 0 && prefix) {
      result[prefix] = "{}";
      return result;
    }

    for (const [key, childValue] of entries) {
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      flattenObject(childValue, childPrefix, result);
    }

    return result;
  }

  // primitive (string, number, boolean)
  if (prefix) result[prefix] = value;
  return result;
}

/**
 * Converts an array of flat objects to a TSV string.
 * - Headers are the union of keys across all rows (order preserved by first occurrence)
 * - null/undefined become empty cells
 * - Values containing tabs, newlines or quotes are quoted with double quotes and internal quotes are doubled
 */
export function toTSV(rows) {
  if (rows.length === 0) return "";

  // Build union of keys preserving first-seen order
  const seen = new Set();
  const headers = [];
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        headers.push(k);
      }
    }
  }

  const escapeCell = (val) => {
    if (val === null || val === undefined || val === "") return "";
    const s = String(val);
    // If contains tab, newline or double quote, quote the entire cell and escape internal quotes by doubling
    if (s.includes("\t") || s.includes("\n") || s.includes("\r") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.join("\t"),
    ...rows.map((row) =>
      headers
        .map((h) => escapeCell(row[h] ?? ""))
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
