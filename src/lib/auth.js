import prompts from "prompts";

const onCancel = () => {
  console.error("Aborted.");
  process.exit(1);
};

export async function askCredentials() {
  return prompts(
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
    { onCancel },
  );
}

export async function getAccessToken({ projectId, clientId, clientSecret }) {
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
  console.log(`Base URL: ${data.endpoint}\n`);

  return { accessToken: data.access_token, baseURL: data.endpoint };
}
