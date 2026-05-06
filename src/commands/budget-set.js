import prompts from "prompts";
import { getMonitoringList, getMonitoringReports } from "../lib/api.js";
import {
  METRIC_DEFINITIONS,
  LIGHTHOUSE_GOALS,
  saveBudgets,
  getBudgetFile,
} from "../lib/budget.js";

export function extractMetrics(report) {
  return {
    score: report.summary?.score,
    lcp: report.timings?.largestContentfulPaint,
    tbt: report.timings?.totalBlockingTime,
    cls: report.timings?.cumulativeLayoutShift,
    speedIndex: report.timings?.speedIndex,
    loadTime: report.summary?.loadTime,
    weight:
      report.summary?.weight != null ? report.summary.weight / 1024 : null,
    fcp: report.timings?.firstContentfulPaint,
  };
}

export function worstValue(values, higherIsBetter) {
  const valid = values.filter((v) => v != null && !isNaN(v));
  if (valid.length === 0) return null;
  return higherIsBetter ? Math.min(...valid) : Math.max(...valid);
}

function computePercentile(values, p) {
  const sorted = values
    .filter((v) => v != null && !isNaN(v))
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// Budget = 90th percentile for lower-is-better metrics (90% of runs at or below this)
//        = 10th percentile for higher-is-better metrics (90% of runs at or above this)
function computeBudget(values, higherIsBetter) {
  return computePercentile(values, higherIsBetter ? 10 : 90);
}

function goalFor(def) {
  const entry = LIGHTHOUSE_GOALS[def.key];
  if (!entry) return null;
  return def.higherIsBetter ? entry.min : entry.max;
}

export async function runBudgetSet(baseURL, accessToken, projectId) {
  const { lastDays, outputFile } = await prompts(
    [
      {
        type: "number",
        name: "lastDays",
        message: "Number of days to compute budgets from:",
        initial: 30,
        validate: (v) => v > 0 || "Must be a positive number.",
      },
      {
        type: "text",
        name: "outputFile",
        message: "Save budgets to:",
        initial: getBudgetFile(projectId),
        validate: (v) => v.trim().length > 0 || "Filename cannot be empty.",
      },
    ],
    {
      onCancel: () => {
        console.error("Aborted.");
        process.exit(1);
      },
    },
  );

  const monitorings = await getMonitoringList(baseURL, accessToken);

  console.log(
    `\nComputing 90th-percentile budgets for ${monitorings.length} monitoring(s)` +
      ` over the last ${lastDays} day(s)...\n`,
  );

  const config = { defaults: {}, monitorings: {} };
  const globalValues = Object.fromEntries(
    METRIC_DEFINITIONS.map((m) => [m.key, []]),
  );

  for (const m of monitorings) {
    process.stdout.write(`Fetching [${m.id}] ${m.name}... `);

    const { monitoringData } = await getMonitoringReports(
      baseURL,
      accessToken,
      m.id,
      { lastDays, limit: 0, error: false },
    );

    if (!monitoringData || monitoringData.length === 0) {
      process.stdout.write("skipped (no data)\n");
      continue;
    }

    const perMonitoringValues = Object.fromEntries(
      METRIC_DEFINITIONS.map((m) => [m.key, []]),
    );

    for (const report of monitoringData) {
      const metrics = extractMetrics(report);
      for (const def of METRIC_DEFINITIONS) {
        const val = metrics[def.key];
        if (val != null) {
          perMonitoringValues[def.key].push(val);
          globalValues[def.key].push(val);
        }
      }
    }

    const monitoringBudget = {};
    for (const def of METRIC_DEFINITIONS) {
      const budget = computeBudget(
        perMonitoringValues[def.key],
        def.higherIsBetter,
      );
      const goal = goalFor(def);
      if (budget != null) {
        monitoringBudget[def.key] = {
          ...(goal != null ? { goal } : {}),
          budget: def.higherIsBetter ? Math.floor(budget) : Math.ceil(budget),
        };
      }
    }

    if (Object.keys(monitoringBudget).length > 0) {
      config.monitorings[String(m.id)] = monitoringBudget;
    }

    process.stdout.write(`done (${monitoringData.length} report(s))\n`);
  }

  for (const def of METRIC_DEFINITIONS) {
    const budget = computeBudget(globalValues[def.key], def.higherIsBetter);
    const goal = goalFor(def);
    if (budget != null) {
      config.defaults[def.key] = {
        ...(goal != null ? { goal } : {}),
        budget: def.higherIsBetter ? Math.floor(budget) : Math.ceil(budget),
      };
    }
  }

  saveBudgets(config, outputFile);
  console.log(
    "Goals  → Lighthouse / Core Web Vitals standards (hardcoded).\n" +
      "Budgets → 90th percentile of your observed data.\n" +
      "Review and tighten budgets as performance improves.\n" +
      "Commit to version control to make this a team-level contract.",
  );
}
