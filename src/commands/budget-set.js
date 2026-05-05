import prompts from "prompts";
import { getMonitoringList, getMonitoringReports } from "../lib/api.js";
import {
  METRIC_DEFINITIONS,
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

export async function runBudgetSet(baseURL, accessToken, projectId) {
  const { lastDays, outputFile } = await prompts(
    [
      {
        type: "number",
        name: "lastDays",
        message: "Number of days to compute worst values from:",
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
    `\nComputing worst values for ${monitorings.length} monitoring(s) over the last ${lastDays} day(s)...\n`,
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
      {
        lastDays,
        limit: 0,
        error: false,
      },
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
      const worst = worstValue(
        perMonitoringValues[def.key],
        def.higherIsBetter,
      );
      if (worst != null) {
        monitoringBudget[def.key] = def.higherIsBetter
          ? { min: Math.floor(worst) }
          : { max: Math.ceil(worst) };
      }
    }

    if (Object.keys(monitoringBudget).length > 0) {
      config.monitorings[String(m.id)] = monitoringBudget;
    }

    process.stdout.write(`done (${monitoringData.length} report(s))\n`);
  }

  for (const def of METRIC_DEFINITIONS) {
    const worst = worstValue(globalValues[def.key], def.higherIsBetter);
    if (worst != null) {
      config.defaults[def.key] = def.higherIsBetter
        ? { min: Math.floor(worst) }
        : { max: Math.ceil(worst) };
    }
  }

  saveBudgets(config, outputFile);
  console.log(
    "Review the file and tighten thresholds manually as your performance improves.\n" +
      "Commit it to version control to make budgets a team-level contract.",
  );
}
