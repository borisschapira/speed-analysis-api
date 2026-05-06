import prompts from "prompts";
import { getMonitoringList, getMonitoringReports } from "../lib/api.js";
import { extractMetrics } from "./budget-set.js";
import {
  loadBudgets,
  getBudgetFile,
  getEffectiveBudget,
  checkMetric,
  METRIC_DEFINITIONS,
} from "../lib/budget.js";
import { writeTSV } from "../lib/export.js";

const onCancel = () => {
  console.error("Aborted.");
  process.exit(1);
};

const ICON = { success: "🟢", progress: "🟡", critical: "🔴" };

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

  const { lastDays, complianceGoal } = await prompts(
    [
      {
        type: "number",
        name: "lastDays",
        message: "Number of days to analyze:",
        initial: 30,
        validate: (v) => v > 0 || "Must be a positive number.",
      },
      {
        type: "number",
        name: "complianceGoal",
        message: "Compliance goal (% of reports that must meet the threshold):",
        initial: 90,
        validate: (v) => (v > 0 && v <= 100) || "Must be between 1 and 100.",
      },
    ],
    { onCancel },
  );

  const monitorings = await getMonitoringList(baseURL, accessToken);

  console.log(
    `\nAnalyzing ${monitorings.length} monitoring(s) over the last ${lastDays} day(s)` +
      ` (compliance goal: ${complianceGoal}%)...\n`,
  );

  const rows = [];
  let countCritical = 0;
  let countProgress = 0;

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

    process.stdout.write(`${monitoringData.length} report(s)\n`);

    const budget = getEffectiveBudget(config, m.id);
    const row = {
      id: m.id,
      name: m.name,
      url: m.url,
      reports: monitoringData.length,
    };

    const metricResults = [];
    let monitoringHasCritical = false;
    let monitoringHasProgress = false;

    for (const def of METRIC_DEFINITIONS) {
      const budgetEntry = budget[def.key];
      if (!budgetEntry) {
        row[`${def.key}_budget_pct`] = "N/A";
        row[`${def.key}_goal_pct`] = "N/A";
        row[`${def.key}_status`] = "N/A";
        continue;
      }

      let nSuccess = 0,
        nProgress = 0,
        nCritical = 0,
        nMeasurable = 0;

      for (const report of monitoringData) {
        const value = extractMetrics(report)[def.key];
        const result = checkMetric(def, value, budgetEntry);
        if (result === null) continue;
        nMeasurable++;
        if (result.status === "success") nSuccess++;
        else if (result.status === "progress") nProgress++;
        else nCritical++;
      }

      if (nMeasurable === 0) {
        row[`${def.key}_budget_pct`] = "N/A";
        row[`${def.key}_goal_pct`] = "N/A";
        row[`${def.key}_status`] = "N/A";
        continue;
      }

      const budgetPct = ((nSuccess + nProgress) / nMeasurable) * 100;
      const goalPct = (nSuccess / nMeasurable) * 100;

      const status =
        budgetPct < complianceGoal
          ? "critical"
          : goalPct >= complianceGoal
            ? "success"
            : "progress";

      if (status === "critical") monitoringHasCritical = true;
      if (status === "progress") monitoringHasProgress = true;

      row[`${def.key}_budget_pct`] = budgetPct.toFixed(1);
      row[`${def.key}_goal_pct`] = goalPct.toFixed(1);
      row[`${def.key}_status`] = status.toUpperCase();

      metricResults.push({
        def,
        status,
        budgetPct,
        goalPct,
        nSuccess,
        nProgress,
        nCritical,
        nMeasurable,
      });
    }

    if (monitoringHasCritical) countCritical++;
    else if (monitoringHasProgress) countProgress++;

    for (const {
      def,
      status,
      budgetPct,
      goalPct,
      nSuccess,
      nProgress,
      nCritical,
      nMeasurable,
    } of metricResults) {
      const bPct = `${budgetPct.toFixed(1)}%`.padStart(7);
      const gPct = `${goalPct.toFixed(1)}%`.padStart(7);
      console.log(
        `  ${ICON[status]} ${def.label.padEnd(14)}` +
          `  budget: ${bPct}  goal: ${gPct}` +
          `  (🟢${nSuccess} 🟡${nProgress} 🔴${nCritical}/${nMeasurable})`,
      );
    }
    console.log();
    rows.push(row);
  }

  const countSuccess = rows.length - countCritical - countProgress;
  console.log(
    `Summary: 🟢 ${countSuccess} on track  ` +
      `🟡 ${countProgress} progressing  ` +
      `🔴 ${countCritical} critical  ` +
      `(out of ${rows.length} analyzed)`,
  );

  if (outputFile && rows.length > 0) writeTSV(outputFile, rows);
  if (countCritical > 0) process.exitCode = 1;
}
