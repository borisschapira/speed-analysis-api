import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export function getBudgetFile(projectId) {
  const name = projectId ? String(projectId) : "default";
  return `budgets/${name}.json`;
}

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

export function checkMetric(metric, value, budget) {
  if (value == null) return null;
  const threshold = budget[metric.key];
  if (!threshold) return null;

  if (metric.higherIsBetter) {
    if (threshold.min == null) return null;
    return { pass: value >= threshold.min, value, limit: threshold.min };
  } else {
    if (threshold.max == null) return null;
    return { pass: value <= threshold.max, value, limit: threshold.max };
  }
}

export function formatMetricValue(metric, value) {
  if (value == null) return "N/A";
  return `${value.toFixed(metric.decimals)}${metric.unit}`;
}
