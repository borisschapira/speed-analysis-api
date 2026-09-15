const isVerboseDebug = () => process.env.DEBUG === "verbose";

async function apiPost(baseURL, accessToken, path, body = {}) {
  const url = `${baseURL}${path}`;
  if (isVerboseDebug()) {
    console.info("[DEBUG] API request", { method: "POST", url, body });
  }

  const response = await fetch(`${baseURL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let data;
  try {
    data = await response.json();
  } catch (error) {
    if (response.ok) throw error;
    data = {};
  }
  if (isVerboseDebug()) {
    console.info("[DEBUG] API response", { url, status: response.status, data });
  }

  if (!response.ok) {
    throw new Error(
      `API call to ${path} failed: ${response.status} ${response.statusText}\n` +
        `Error: ${data.errorMessage || "Unknown"} (${data.errorCode || "N/A"})`,
    );
  }

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
  options = {},
) {
  const payload = await apiPost(
    baseURL,
    accessToken,
    "/v1/speed-analysis/monitoring/last-report",
    { monitoringId, metricsOnly: true, ...options },
  );
  return payload ?? null;
}

/**
 * Fetch a report by its reportId using the analysis/report endpoint.
 * Returns the payload.report object when present, otherwise null.
 */
export async function getReportById(
  baseURL,
  accessToken,
  reportId,
  options = {},
) {
  if (!reportId) return null;
  const payload = await apiPost(
    baseURL,
    accessToken,
    "/v1/speed-analysis/analysis/report",
    {
      reportId,
      metricsOnly: true,
      getUniqueIDsForTips: false,
      ...options,
    },
  );
  // The analysis/report endpoint returns payload.report in the sample API; return payload.report for convenience
  return payload?.report ?? null;
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
