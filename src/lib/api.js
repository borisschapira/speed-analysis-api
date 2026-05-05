async function apiPost(baseURL, accessToken, path, body = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `API call to ${path} failed: ${response.status} ${response.statusText}\n` +
        `Error: ${errorData.errorMessage || "Unknown"} (${errorData.errorCode || "N/A"})`,
    );
  }

  const data = await response.json();
  if (!data.success) throw new Error(`API returned success: false for ${path}`);

  return data.payload;
}

export async function getMonitoringList(baseURL, accessToken) {
  const payload = await apiPost(
    baseURL,
    accessToken,
    "/v1/speed-analysis/monitoring/list",
  );
  return payload.monitorings;
}

export async function getMonitoringReports(
  baseURL,
  accessToken,
  monitoringId,
  lastDays,
) {
  const payload = await apiPost(
    baseURL,
    accessToken,
    "/v1/speed-analysis/monitoring/reports",
    {
      monitoringId,
      lastDays,
      limit: 0,
      error: false,
    },
  );

  return {
    reportCount: payload.monitoringData?.length ?? 0,
    statistics: payload.statistics ?? {},
  };
}
