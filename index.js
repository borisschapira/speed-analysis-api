import prompts from "prompts";
import { askCredentials, getAccessToken } from "./src/lib/auth.js";
import { runList } from "./src/commands/list.js";
import { runAverages } from "./src/commands/averages.js";
import { runRegression } from "./src/commands/regression.js";
import { runComparison } from "./src/commands/comparison.js";
import { runBudgetSet } from "./src/commands/budget-set.js";
import { runBudgetCheck } from "./src/commands/budget-check.js";
import { isoDatetime } from "./src/lib/export.js";

const EXPORTS_DIR = "exports";

const COMMANDS = {
  list: {
    label: "List monitorings",
    defaultFile: "monitoring-list",
    run: (baseURL, accessToken, outputFile) =>
      runList(baseURL, accessToken, outputFile),
  },
  averages: {
    label: "Average report data over X days",
    defaultFile: "monitoring-averages",
    run: (baseURL, accessToken, outputFile) =>
      runAverages(baseURL, accessToken, outputFile),
  },
  regression: {
    label: "Detect regressions vs baseline",
    defaultFile: "monitoring-regression",
    run: (baseURL, accessToken, outputFile) =>
      runRegression(baseURL, accessToken, outputFile),
  },
  comparison: {
    label: "Compare two time periods",
    defaultFile: "monitoring-comparison",
    run: (baseURL, accessToken, outputFile) =>
      runComparison(baseURL, accessToken, outputFile),
  },
  "budget-set": {
    label: "Set performance budgets",
    noExport: true,
    run: (baseURL, accessToken, _outputFile, projectId) =>
      runBudgetSet(baseURL, accessToken, projectId),
  },
  "budget-check": {
    label: "Check performance budgets",
    defaultFile: "monitoring-budget",
    run: (baseURL, accessToken, outputFile, projectId) =>
      runBudgetCheck(baseURL, accessToken, outputFile, projectId),
  },
};

const onCancel = () => {
  console.error("Aborted.");
  process.exit(1);
};

async function askMode() {
  const { mode } = await prompts(
    {
      type: "select",
      name: "mode",
      message: "What do you want to do?",
      choices: Object.entries(COMMANDS).map(([value, { label }]) => ({
        title: label,
        value,
      })),
    },
    { onCancel },
  );
  return mode;
}

async function askExport(defaultFile, projectId) {
  const prefix = projectId ? `${projectId}-` : "";
  const suggested = `${EXPORTS_DIR}/${prefix}${defaultFile}-${isoDatetime()}.tsv`;

  const { exportTSV } = await prompts(
    {
      type: "toggle",
      name: "exportTSV",
      message: "Export results to a TSV file?",
      initial: false,
      active: "yes",
      inactive: "no",
    },
    { onCancel },
  );

  if (!exportTSV) return null;

  const { outputFile } = await prompts(
    {
      type: "text",
      name: "outputFile",
      message: "Output filename:",
      initial: suggested,
      validate: (v) => v.trim().length > 0 || "Filename cannot be empty.",
    },
    { onCancel },
  );

  return outputFile;
}

async function main() {
  try {
    const mode = await askMode();
    const credentials = await askCredentials();
    const command = COMMANDS[mode];
    const outputFile = command.noExport
      ? null
      : await askExport(command.defaultFile, credentials.projectId);
    const { accessToken, baseURL } = await getAccessToken(credentials);

    await command.run(baseURL, accessToken, outputFile, credentials.projectId);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
