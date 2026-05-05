import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  getBudgetFile,
  getEffectiveBudget,
  checkMetric,
  formatMetricValue,
  loadBudgets,
  saveBudgets,
} from "../../../src/lib/budget.js";
import { sampleConfig } from "../../fixtures/budget-config.js";

const metric = { key: "lcp", higherIsBetter: false, unit: " ms", decimals: 0 };
const scoreMetric = {
  key: "score",
  higherIsBetter: true,
  unit: "",
  decimals: 0,
};

describe("getBudgetFile", () => {
  it("returns project-scoped path when projectId is provided", () => {
    expect(getBudgetFile(390)).toBe("budgets/390.json");
  });

  it("returns default path when projectId is falsy", () => {
    expect(getBudgetFile(null)).toBe("budgets/default.json");
    expect(getBudgetFile(undefined)).toBe("budgets/default.json");
    expect(getBudgetFile(0)).toBe("budgets/default.json");
  });
});

describe("getEffectiveBudget", () => {
  it("returns default values when no per-monitoring override exists", () => {
    const budget = getEffectiveBudget(sampleConfig, "999");
    expect(budget.lcp).toEqual({ max: 4000 });
    expect(budget.tbt).toEqual({ max: 500 });
  });

  it("overrides defaults with per-monitoring values", () => {
    const budget = getEffectiveBudget(sampleConfig, "101");
    expect(budget.lcp).toEqual({ max: 2500 }); // overridden
    expect(budget.tbt).toEqual({ max: 500 }); // inherited from defaults
  });

  it("handles missing defaults gracefully", () => {
    const config = { monitorings: { 101: { lcp: { max: 3000 } } } };
    const budget = getEffectiveBudget(config, "101");
    expect(budget.lcp).toEqual({ max: 3000 });
  });
});

describe("checkMetric", () => {
  it("passes when value is within budget (lower is better)", () => {
    const result = checkMetric(metric, 3000, { lcp: { max: 4000 } });
    expect(result.pass).toBe(true);
    expect(result.limit).toBe(4000);
  });

  it("fails when value exceeds budget (lower is better)", () => {
    const result = checkMetric(metric, 5000, { lcp: { max: 4000 } });
    expect(result.pass).toBe(false);
  });

  it("passes when value is within budget (higher is better)", () => {
    const result = checkMetric(scoreMetric, 80, { score: { min: 70 } });
    expect(result.pass).toBe(true);
  });

  it("fails when value is below minimum (higher is better)", () => {
    const result = checkMetric(scoreMetric, 60, { score: { min: 70 } });
    expect(result.pass).toBe(false);
  });

  it("returns null when value is null", () => {
    expect(checkMetric(metric, null, { lcp: { max: 4000 } })).toBeNull();
  });

  it("returns null when no budget is defined for the metric", () => {
    expect(checkMetric(metric, 3000, {})).toBeNull();
  });

  it("returns null when threshold key is missing", () => {
    expect(checkMetric(metric, 3000, { lcp: {} })).toBeNull();
  });
});

describe("formatMetricValue", () => {
  it("formats with unit and correct decimals", () => {
    expect(formatMetricValue(metric, 1234)).toBe("1234 ms");
    expect(
      formatMetricValue({ key: "cls", unit: "", decimals: 2 }, 0.123),
    ).toBe("0.12");
  });

  it("returns N/A for null values", () => {
    expect(formatMetricValue(metric, null)).toBe("N/A");
  });
});

describe("loadBudgets / saveBudgets", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `budget-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null when file does not exist", () => {
    expect(loadBudgets(join(tmpDir, "missing.json"))).toBeNull();
  });

  it("loads a valid JSON budget file", () => {
    const filePath = join(tmpDir, "390.json");
    writeFileSync(filePath, JSON.stringify(sampleConfig), "utf-8");
    expect(loadBudgets(filePath)).toEqual(sampleConfig);
  });

  it("saves and reloads a budget config", () => {
    const filePath = join(tmpDir, "nested/390.json");
    saveBudgets(sampleConfig, filePath);
    expect(loadBudgets(filePath)).toEqual(sampleConfig);
  });

  it("creates intermediate directories when saving", () => {
    const filePath = join(tmpDir, "a/b/c/390.json");
    expect(() => saveBudgets(sampleConfig, filePath)).not.toThrow();
  });
});
