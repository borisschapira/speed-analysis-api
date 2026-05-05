import prompts from "prompts";
import dotenv from "dotenv";
import { writeFileSync } from "fs";

dotenv.config({ quiet: true });

const ENV_FILE = ".env";

const onCancel = () => {
  console.error("Aborted.");
  process.exit(1);
};

function loadSavedCredentials() {
  const clientId = process.env.CS_CLIENT_ID;
  const clientSecret = process.env.CS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const projectId = process.env.CS_PROJECT_ID
    ? Number(process.env.CS_PROJECT_ID)
    : null;

  return { projectId, clientId, clientSecret };
}

function saveCredentials({ projectId, clientId, clientSecret }) {
  const lines = [];
  if (projectId) lines.push(`CS_PROJECT_ID=${projectId}`);
  lines.push(`CS_CLIENT_ID=${clientId}`);
  lines.push(`CS_CLIENT_SECRET=${clientSecret}`);
  writeFileSync(ENV_FILE, lines.join("\n") + "\n", "utf-8");
  console.log(`Credentials saved to ${ENV_FILE}.`);
}

function maskValue(value, visible = 8) {
  if (!value) return "";
  return `${value.slice(0, visible)}...`;
}

export async function askCredentials() {
  const saved = loadSavedCredentials();

  if (saved) {
    const summary = [
      saved.projectId ? `projectId: ${saved.projectId}` : null,
      `clientId: ${maskValue(saved.clientId)}`,
      `clientSecret: ****`,
    ]
      .filter(Boolean)
      .join(", ");

    const { reuse } = await prompts(
      {
        type: "toggle",
        name: "reuse",
        message: `Reuse saved credentials? (${summary})`,
        initial: true,
        active: "yes",
        inactive: "no",
      },
      { onCancel },
    );

    if (reuse) return saved;
  }

  const credentials = await prompts(
    [
      {
        type: "number",
        name: "projectId",
        message: "Project ID (leave empty for project-level credentials):",
        validate: (v) => v >= 0 || "Must be a positive number.",
      },
      {
        type: "text",
        name: "clientId",
        message: "Client ID:",
        validate: (v) => v.trim().length > 0 || "Client ID is required.",
      },
      {
        type: "password",
        name: "clientSecret",
        message: "Client Secret:",
        validate: (v) => v.trim().length > 0 || "Client Secret is required.",
      },
    ],
    { onCancel },
  );

  const { persist } = await prompts(
    {
      type: "toggle",
      name: "persist",
      message: `Save credentials to ${ENV_FILE} for next time?`,
      initial: false,
      active: "yes",
      inactive: "no",
    },
    { onCancel },
  );

  if (persist) saveCredentials(credentials);

  return credentials;
}

export async function getAccessToken({ projectId, clientId, clientSecret }) {
  const authEndpoint = "https://api.contentsquare.com/v1/oauth/token";
  const response = await fetch(authEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      ...(projectId ? { project_id: projectId } : {}),
      scope: "speed-analysis",
    }),
  });

  const data = await response.json();

  if (!data.access_token) {
    throw new Error(
      `Authentication failed: ${data.error_description || data.error || "Unknown error"}`,
    );
  }
  if (!data.endpoint) {
    throw new Error("Authentication response is missing endpoint.");
  }

  console.log(
    `\nAuthenticated successfully. Token expires in ${data.expires_in}s.`,
  );
  console.log(`Base URL: ${data.endpoint}\n`);

  return { accessToken: data.access_token, baseURL: data.endpoint };
}
