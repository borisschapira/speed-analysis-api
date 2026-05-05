import prompts from "prompts";

async function askCredentials() {
  const response = await prompts(
    [
      {
        type: "number",
        name: "projectId",
        message: "Project ID (leave empty for project-level credentials):",
      },
      {
        type: "password",
        name: "clientId",
        message: "Client ID:",
        validate: (v) => v.length > 0 || "Client ID is required.",
      },
      {
        type: "password",
        name: "clientSecret",
        message: "Client Secret:",
        validate: (v) => v.length > 0 || "Client Secret is required.",
      },
    ],
    {
      onCancel: () => {
        console.error("Aborted.");
        process.exit(1);
      },
    },
  );

  return response;
}

async function getAccessToken({ projectId, clientId, clientSecret }) {
  const response = await fetch("https://api.contentsquare.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
      scope: "speed-analysis",
      ...(projectId && { project_id: projectId }),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Authentication failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (!data.access_token || !data.endpoint) {
    throw new Error(
      "Authentication response is missing access_token or endpoint.",
    );
  }

  console.log(
    `\nAuthenticated successfully. Token expires in ${data.expires_in}s.`,
  );
  console.log(`Base URL: ${data.endpoint}`);

  return { accessToken: data.access_token, baseURL: data.endpoint };
}

async function getMonitoringList(baseURL, accessToken) {
  const response = await fetch(`${baseURL}/v1/speed-analysis/monitoring/list`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to fetch monitoring list: ${response.status} ${response.statusText}\n` +
        `Error: ${errorData.errorMessage || "Unknown"} (${errorData.errorCode || "N/A"})`,
    );
  }

  const data = await response.json();
  if (!data.success) throw new Error("API returned success: false");

  return data.payload.monitorings;
}

async function main() {
  try {
    const credentials = await askCredentials();
    const { accessToken, baseURL } = await getAccessToken(credentials);
    const monitorings = await getMonitoringList(baseURL, accessToken);

    console.log(`\nFound ${monitorings.length} monitoring(s):\n`);
    monitorings.forEach((m) => {
      console.log(`- [${m.id}] ${m.name}`);
      console.log(`  URL:       ${m.url}`);
      console.log(`  State:     ${m.state}`);
      console.log(`  Enabled:   ${m.enabled}`);
      console.log(`  Frequency: every ${m.frequency} min`);
      if (m.errorMessage) console.log(`  Error:     ${m.errorMessage}`);
      console.log();
    });
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main();
