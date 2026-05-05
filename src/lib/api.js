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

export async function getMonitoringLastReport(
  baseURL,
  accessToken,
  monitoringId,
) {
  const payload = await apiPost(
    baseURL,
    accessToken,
    "/v1/speed-analysis/monitoring/last-report",
    { monitoringId, metricsOnly: true },
  );
  return payload ?? null;
}

// options: { lastDays?, dateFrom?, dateTo?, limit?, error? }
export async function getMonitoringReports(
  baseURL,
  accessToken,
  monitoringId,
  options = {},
) {
  const payload = await apiPost(
    baseURL,
    accessToken,
    "/v1/speed-analysis/monitoring/reports",
    {
      monitoringId,
      ...options,
    },
  );

  return {
    reportCount: payload.monitoringData?.length ?? 0,
    statistics: payload.statistics ?? {},
    monitoringData: payload.monitoringData ?? [], // exposed for budget-set worst-value computation
  };
}
