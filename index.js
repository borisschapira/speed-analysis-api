import prompts from "prompts";
import { askCredentials, getAccessToken } from "./src/lib/auth.js";
import { runList } from "./src/commands/list.js";
import { runAverages } from "./src/commands/averages.js";
import { isoDatetime } from "./src/lib/export.js";

const EXPORTS_DIR = "exports";

const COMMANDS = {
  list: {
    label: "List monitorings",
    defaultFile: "monitoring-list",
    run: runList,
  },
  averages: {
    label: "Average report data over X days",
    defaultFile: "monitoring-averages",
    run: runAverages,
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
    const outputFile = await askExport(
      COMMANDS[mode].defaultFile,
      credentials.projectId,
    );
    const { accessToken, baseURL } = await getAccessToken(credentials);

    await COMMANDS[mode].run(baseURL, accessToken, outputFile);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
