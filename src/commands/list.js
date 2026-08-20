import { getMonitoringList, getMonitoringLastReport, getReportById } from "../lib/api.js";
import { writeTSV, flattenObject } from "../lib/export.js";

function toRow(m) {
  return {
    ...flattenObject(m),
    raw_json: JSON.stringify(m),
    // enrichment placeholders (may be empty strings)
    lang: m.lang ?? "",
    screen_width: m.screen_width ?? "",
    screen_height: m.screen_height ?? "",
    bandwidth_downstream: m.bandwidth_downstream ?? "",
    bandwidth_upstream: m.bandwidth_upstream ?? "",
  };
}

function extractReportIdFromLastReport(lastReport) {
  // Try common fields first
  const rpt = lastReport?.report;
  if (!rpt) return null;
  if (rpt.id) return String(rpt.id);
  if (rpt.reportId) return String(rpt.reportId);
  // Try extracting from publicReportUrl: .../report/<reportId>
  if (typeof rpt.publicReportUrl === "string") {
    const m = rpt.publicReportUrl.match(/\/report\/(.+)$/);
    if (m) return m[1];
  }
  return null;
}

export async function runList(baseURL, accessToken, outputFile = null) {
  const monitorings = await getMonitoringList(baseURL, accessToken);

  console.log(`Found ${monitorings.length} monitoring(s):\n`);

  const rows = [];

  for (const m of monitorings) {
    console.log(`- [${m.id}] ${m.name}`);
    console.log(`  URL:       ${m.url}`);
    console.log(`  State:     ${m.state}`);
    console.log(`  Enabled:   ${m.enabled}`);
    console.log(`  Frequency: every ${m.frequency} min`);
    if (m.errorMessage) console.log(`  Error:     ${m.errorMessage}`);

    // Default enrichment values
    let lang = "";
    let screen_width = "";
    let screen_height = "";
    let bandwidth_downstream = "";
    let bandwidth_upstream = "";

    try {
      const lastReportPayload = await getMonitoringLastReport(baseURL, accessToken, m.id);
      if (lastReportPayload?.report) {
        // Prefer fetching full report by reportId when available
        const reportId = extractReportIdFromLastReport(lastReportPayload);
        let report = null;
        if (reportId) {
          report = await getReportById(baseURL, accessToken, reportId);
        }
        // fall back to the lastReport payload report if fetching by id failed
        report = report ?? lastReportPayload.report;

        lang = report?.lang ?? report?.config?.lang ?? "";
        const screen = report?.config?.screen ?? {};
        screen_width = screen.width ?? screen.w ?? "";
        screen_height = screen.height ?? screen.h ?? "";
        const bandwidth = report?.config?.bandwidth ?? {};
        bandwidth_downstream = bandwidth.downstream ?? bandwidth.down ?? "";
        bandwidth_upstream = bandwidth.upstream ?? bandwidth.up ?? "";

        console.log(`  Lang:      ${lang}`);
        if (screen_width || screen_height)
          console.log(`  Screen:    ${screen_width}x${screen_height}`);
        if (bandwidth_downstream || bandwidth_upstream)
          console.log(`  Bandwidth: down=${bandwidth_downstream} up=${bandwidth_upstream}`);
      } else {
        console.log("  No last report available.");
      }
    } catch (err) {
      console.log(`  Warning: could not fetch last report: ${err.message}`);
    }

    // Build enriched row for TSV export
    const enriched = {
      ...toRow(m),
      lang,
      screen_width,
      screen_height,
      bandwidth_downstream,
      bandwidth_upstream,
    };

    rows.push(enriched);
    console.log();
  }

  if (outputFile) {
    writeTSV(outputFile, rows);
  }
}
