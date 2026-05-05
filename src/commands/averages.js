import prompts from "prompts";
import { getMonitoringList, getMonitoringReports } from "../lib/api.js";
import { writeTSV } from "../lib/export.js";

function formatMs(value) {
  return value != null ? `${Math.round(value)} ms` : "N/A";
}

function printAverages(monitoring, reportCount, statistics) {
  const t = statistics?.averageTimings ?? {};

  console.log(`┌─ [${monitoring.id}] ${monitoring.name}`);
  console.log(`│  URL:              ${monitoring.url}`);
  console.log(`│  Reports averaged: ${reportCount}`);
  console.log(`│`);
  console.log(`│  Score:            ${statistics?.averageScore ?? "N/A"}`);
  console.log(`│  Load time:        ${formatMs(statistics?.averageLoadTime)}`);
  console.log(`│  Requests:         ${statistics?.averageRequests ?? "N/A"}`);
  console.log(
    `│  Weight:           ${statistics?.averageWeight != null ? `${Math.round(statistics.averageWeight / 1024)} KB` : "N/A"}`,
  );
  console.log(`│`);
  console.log(`│  Key timings (averages):`);
  console.log(`│    First Byte:               ${formatMs(t.firstByte)}`);
  console.log(`│    Start Render:             ${formatMs(t.startRender)}`);
  console.log(
    `│    First Contentful Paint:   ${formatMs(t.firstContentfulPaint)}`,
  );
  console.log(
    `│    Largest Contentful Paint: ${formatMs(t.largestContentfulPaint)}`,
  );
  console.log(`│    Speed Index:              ${formatMs(t.speedIndex)}`);
  console.log(
    `│    Total Blocking Time:      ${formatMs(t.totalBlockingTime)}`,
  );
  console.log(
    `│    Cumulative Layout Shift:  ${t.cumulativeLayoutShift ?? "N/A"}`,
  );
  console.log(`│    DOM Interactive:          ${formatMs(t.domInteractive)}`);
  console.log(`│    Visually Complete:        ${formatMs(t.visuallyComplete)}`);
  console.log(`└${"─".repeat(50)}`);
  console.log();
}

function toRow(monitoring, reportCount, statistics) {
  const t = statistics?.averageTimings ?? {};
  return {
    id: monitoring.id,
    name: monitoring.name,
    url: monitoring.url,
    report_count: reportCount,
    avg_score: statistics?.averageScore ?? "",
    avg_load_time_ms:
      statistics?.averageLoadTime != null
        ? Math.round(statistics.averageLoadTime)
        : "",
    avg_requests: statistics?.averageRequests ?? "",
    avg_weight_kb:
      statistics?.averageWeight != null
        ? Math.round(statistics.averageWeight / 1024)
        : "",
    avg_first_byte_ms: t.firstByte != null ? Math.round(t.firstByte) : "",
    avg_start_render_ms: t.startRender != null ? Math.round(t.startRender) : "",
    avg_fcp_ms:
      t.firstContentfulPaint != null ? Math.round(t.firstContentfulPaint) : "",
    avg_lcp_ms:
      t.largestContentfulPaint != null
        ? Math.round(t.largestContentfulPaint)
        : "",
    avg_speed_index_ms: t.speedIndex != null ? Math.round(t.speedIndex) : "",
    avg_tbt_ms:
      t.totalBlockingTime != null ? Math.round(t.totalBlockingTime) : "",
    avg_cls: t.cumulativeLayoutShift ?? "",
    avg_dom_interactive_ms:
      t.domInteractive != null ? Math.round(t.domInteractive) : "",
    avg_visually_complete_ms:
      t.visuallyComplete != null ? Math.round(t.visuallyComplete) : "",
  };
}

export async function runAverages(baseURL, accessToken, outputFile = null) {
  const { lastDays } = await prompts(
    {
      type: "number",
      name: "lastDays",
      message: "Number of days to average:",
      validate: (v) =>
        (v > 0 && Number.isInteger(v)) || "Must be a positive integer.",
    },
    {
      onCancel: () => {
        console.error("Aborted.");
        process.exit(1);
      },
    },
  );

  const monitorings = await getMonitoringList(baseURL, accessToken);

  console.log(
    `Found ${monitorings.length} monitoring(s). Fetching averages over the last ${lastDays} day(s)...\n`,
  );

  const results = [];
  for (const m of monitorings) {
    process.stdout.write(`Fetching [${m.id}] ${m.name}... `);
    const { reportCount, statistics } = await getMonitoringReports(
      baseURL,
      accessToken,
      m.id,
      { lastDays, limit: 0, error: false },
    );
    process.stdout.write(`done (${reportCount} report(s))\n`);
    results.push({ monitoring: m, reportCount, statistics });
  }

  console.log();

  const rows = [];

  for (const { monitoring, reportCount, statistics } of results) {
    if (reportCount === 0) {
      console.log(
        `⚠ [${monitoring.id}] ${monitoring.name}: no successful reports in the last ${lastDays} day(s).\n`,
      );
    } else {
      printAverages(monitoring, reportCount, statistics);
      rows.push(toRow(monitoring, reportCount, statistics));
    }
  }

  if (outputFile && rows.length > 0) {
    writeTSV(outputFile, rows);
  }
}
