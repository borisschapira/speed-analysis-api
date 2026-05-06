import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export function getBudgetFile(projectId) {
  const name = projectId ? String(projectId) : "default";
  return `budgets/${name}.json`;
}

// Lighthouse "Good" thresholds and industry references.
// Load Time has no widely accepted threshold and is excluded.
// Weight goal is the 2025 median page weight from
// https://almanac.httparchive.org/en/2025/page-weight (~2.6 MB)
export const LIGHTHOUSE_GOALS = {
  score: { min: 90 }, // Lighthouse: Good ≥ 90
  lcp: { max: 2500 }, // Core Web Vitals: Good ≤ 2.5s
  tbt: { max: 200 }, // Lighthouse: Good ≤ 200ms
  cls: { max: 0.1 }, // Core Web Vitals: Good ≤ 0.10
  speedIndex: { max: 3400 }, // Lighthouse: Good ≤ 3.4s
  fcp: { max: 1800 }, // Lighthouse: Good ≤ 1.8s
  weight: { max: 2662 }, // HTTP Archive 2025 median (~2.6 MB = 2662 KB)
};

export const METRIC_DEFINITIONS = [
  { key: "score", label: "Score", higherIsBetter: true, unit: "", decimals: 0 },
  { key: "lcp", label: "LCP", higherIsBetter: false, unit: " ms", decimals: 0 },
  { key: "tbt", label: "TBT", higherIsBetter: false, unit: " ms", decimals: 0 },
  { key: "cls", label: "CLS", higherIsBetter: false, unit: "", decimals: 2 },
  {
    key: "speedIndex",
    label: "Speed Index",
    higherIsBetter: false,
    unit: " ms",
    decimals: 0,
  },
  {
    key: "loadTime",
    label: "Load Time",
    higherIsBetter: false,
    unit: " ms",
    decimals: 0,
  },
  {
    key: "weight",
    label: "Weight",
    higherIsBetter: false,
    unit: " KB",
    decimals: 0,
  },
  { key: "fcp", label: "FCP", higherIsBetter: false, unit: " ms", decimals: 0 },
];

export function loadBudgets(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

export function saveBudgets(config, filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
  console.log(`\nBudgets saved to ${filePath}.`);
}

export function getEffectiveBudget(config, monitoringId) {
  const defaults = config.defaults ?? {};
  const overrides = config.monitorings?.[String(monitoringId)] ?? {};
  const merged = { ...defaults };
  for (const [key, val] of Object.entries(overrides)) {
    merged[key] = { ...(defaults[key] ?? {}), ...val };
  }
  return merged;
}

// Returns { status: "success" | "progress" | "critical", value, goal, budget }
// or null if no budget entry or value is available for this metric.
// - success:  value meets the Lighthouse goal
// - progress: value is within the data-driven budget but below goal
// - critical: value exceeds the budget
export function checkMetric(metric, value, budgetEntry) {
  if (value == null || !budgetEntry) return null;

  const { goal, budget } = budgetEntry;

  if (metric.higherIsBetter) {
    if (budget != null && value < budget)
      return { status: "critical", value, goal, budget };
    if (goal != null && value >= goal)
      return { status: "success", value, goal, budget };
    return { status: "progress", value, goal, budget };
  } else {
    if (budget != null && value > budget)
      return { status: "critical", value, goal, budget };
    if (goal != null && value <= goal)
      return { status: "success", value, goal, budget };
    return { status: "progress", value, goal, budget };
  }
}

export function formatMetricValue(metric, value) {
  if (value == null) return "N/A";
  return `${value.toFixed(metric.decimals)}${metric.unit}`;
}
