import prompts from "prompts";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
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
    run: (baseURL, accessToken, outputFile, nameRegex, projectId) =>
      runList(baseURL, accessToken, outputFile, nameRegex, projectId),
  },
  averages: {
    label: "Average report data over X days",
    defaultFile: "monitoring-averages",
    run: (baseURL, accessToken, outputFile, nameRegex, projectId) =>
      runAverages(baseURL, accessToken, outputFile, nameRegex, projectId),
  },
  regression: {
    label: "Detect regressions vs baseline",
    defaultFile: "monitoring-regression",
    run: (baseURL, accessToken, outputFile, nameRegex, projectId) =>
      runRegression(baseURL, accessToken, outputFile, nameRegex, projectId),
  },
  comparison: {
    label: "Compare two time periods",
    defaultFile: "monitoring-comparison",
    run: (baseURL, accessToken, outputFile, nameRegex, projectId) =>
      runComparison(baseURL, accessToken, outputFile, nameRegex, projectId),
  },
  "budget-set": {
    label: "Set performance budgets",
    noExport: true,
    run: (baseURL, accessToken, _outputFile, nameRegex, projectId) =>
      runBudgetSet(baseURL, accessToken, nameRegex, projectId),
  },
  "budget-check": {
    label: "Check performance budgets",
    defaultFile: "monitoring-budget",
    run: (baseURL, accessToken, outputFile, nameRegex, projectId) =>
      runBudgetCheck(baseURL, accessToken, outputFile, nameRegex, projectId),
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

const STATE_FILE = ".cli-state.json";

async function askNameFilter() {
  // Load previously saved regex (if any) and prefill the prompt
  let initial = "";
  try {
    if (existsSync(STATE_FILE)) {
      const data = JSON.parse(readFileSync(STATE_FILE, "utf-8") || "{}");
      if (data.lastNameRegex) initial = data.lastNameRegex;
    }
  } catch (err) {
    // ignore errors reading state file
  }

  const { nameRegex } = await prompts(
    {
      type: "text",
      name: "nameRegex",
      message: "Filter monitors by name (regex, leave empty for no filter):",
      initial,
      validate: (v) => {
        if (!v || v.trim() === "") return true;
        try {
          // eslint-disable-next-line no-new
          new RegExp(v);
          return true;
        } catch (err) {
          return `Invalid regex: ${err.message}`;
        }
      },
    },
    { onCancel },
  );

  const raw = typeof nameRegex === "string" ? nameRegex : "";
  const trimmed = raw.trim();
  const value = trimmed !== "" ? raw : null;

  try {
    if (trimmed !== "") {
      // Save the entered regex
      const prev = existsSync(STATE_FILE)
        ? JSON.parse(readFileSync(STATE_FILE, "utf-8") || "{}")
        : {};
      prev.lastNameRegex = raw;
      writeFileSync(STATE_FILE, JSON.stringify(prev, null, 2) + "\n", "utf-8");
    } else {
      // User cleared the prompt — remove saved regex if present
      if (existsSync(STATE_FILE)) {
        const prev = JSON.parse(readFileSync(STATE_FILE, "utf-8") || "{}");
        if (prev && Object.prototype.hasOwnProperty.call(prev, "lastNameRegex")) {
          delete prev.lastNameRegex;
          if (Object.keys(prev).length === 0) {
            try {
              unlinkSync(STATE_FILE);
            } catch (unlinkErr) {
              // fallback to writing empty object
              writeFileSync(STATE_FILE, JSON.stringify({}, null, 2) + "\n", "utf-8");
            }
          } else {
            writeFileSync(STATE_FILE, JSON.stringify(prev, null, 2) + "\n", "utf-8");
          }
        }
      }
    }
  } catch (err) {
    console.error(`Warning: could not update regex state: ${err.message}`);
  }

  return value;
}

async function main() {
  try {
    const mode = await askMode();
    const credentials = await askCredentials();
    const command = COMMANDS[mode];

    // Ask name filter (regex) after credential reuse decision and before TSV export
    const nameFilter = await askNameFilter();

    const outputFile = command.noExport
      ? null
      : await askExport(command.defaultFile, credentials.projectId);
    const { accessToken, baseURL } = await getAccessToken(credentials);

    await command.run(baseURL, accessToken, outputFile, nameFilter, credentials.projectId);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
