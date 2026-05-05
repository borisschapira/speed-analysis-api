import { getMonitoringList, getMonitoringLastReport } from "../lib/api.js";
import {
  loadBudgets,
  getBudgetFile,
  getEffectiveBudget,
  checkMetric,
  formatMetricValue,
  METRIC_DEFINITIONS,
} from "../lib/budget.js";
import { writeTSV } from "../lib/export.js";

export function extractCurrentMetrics(lastReport) {
  const r = lastReport.report;
  return {
    score: r.summary?.score,
    lcp: r.timings?.largestContentfulPaint,
    tbt: r.timings?.totalBlockingTime,
    cls: r.timings?.cumulativeLayoutShift,
    speedIndex: r.timings?.speedIndex,
    loadTime: r.summary?.loadTime,
    weight: r.summary?.weight != null ? r.summary.weight / 1024 : null,
    fcp: r.timings?.firstContentfulPaint,
  };
}

export async function runBudgetCheck(
  baseURL,
  accessToken,
  outputFile = null,
  projectId,
) {
  const budgetFile = getBudgetFile(projectId);
  const config = loadBudgets(budgetFile);

  if (!config) {
    console.error(
      `No ${budgetFile} found. Run "Set performance budgets" first.`,
    );
    process.exit(1);
  }

  const monitorings = await getMonitoringList(baseURL, accessToken);

  console.log(
    `\nChecking ${monitorings.length} monitoring(s) against ${budgetFile}...\n`,
  );

  const rows = [];
  let totalViolations = 0;
  let monitoringsOverBudget = 0;

  for (const m of monitorings) {
    process.stdout.write(`Checking [${m.id}] ${m.name}... `);

    const lastReport = await getMonitoringLastReport(
      baseURL,
      accessToken,
      m.id,
    );

    if (!lastReport?.report) {
      process.stdout.write("skipped (no report)\n");
      continue;
    }

    const currentMetrics = extractCurrentMetrics(lastReport);
    const budget = getEffectiveBudget(config, m.id);
    const violations = [];
    const row = { id: m.id, name: m.name, url: m.url };

    for (const def of METRIC_DEFINITIONS) {
      const value = currentMetrics[def.key];
      const result = checkMetric(def, value, budget);

      row[`${def.key}_value`] =
        value != null ? +value.toFixed(def.decimals) : "";
      row[`${def.key}_budget`] = budget[def.key]
        ? ((def.higherIsBetter ? budget[def.key].min : budget[def.key].max) ??
          "")
        : "";
      row[`${def.key}_pass`] =
        result == null ? "N/A" : result.pass ? "yes" : "NO";

      if (result && !result.pass) {
        const pct = Math.abs(
          ((value - result.limit) / result.limit) * 100,
        ).toFixed(1);
        const direction = def.higherIsBetter ? "-" : "+";
        violations.push({ def, value, limit: result.limit, pct, direction });
      }
    }

    if (violations.length > 0) {
      process.stdout.write(`⚠  ${violations.length} violation(s)\n`);
      for (const { def, value, limit, pct, direction } of violations) {
        const valStr = formatMetricValue(def, value).padStart(12);
        const limStr = formatMetricValue(def, limit).padStart(12);
        console.log(
          `    ${def.label.padEnd(14)} ${valStr}  (budget: ${limStr})  ${direction}${pct}%`,
        );
      }
      totalViolations += violations.length;
      monitoringsOverBudget++;
    } else {
      process.stdout.write("✓ OK\n");
    }

    rows.push(row);
  }

  console.log(
    `\n${monitoringsOverBudget} monitoring(s) over budget, ${totalViolations} total violation(s) out of ${rows.length} checked.`,
  );

  if (outputFile && rows.length > 0) {
    writeTSV(outputFile, rows);
  }

  if (totalViolations > 0) {
    process.exitCode = 1;
  }
}
