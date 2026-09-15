import prompts from "prompts";
import {
  getMonitoringList,
  getMonitoringLastReport,
  getMonitoringReports,
  getReportById,
} from "../lib/api.js";
import { writeTSV } from "../lib/export.js";

const onCancel = () => {
  console.error("Aborted.");
  process.exit(1);
};

export function extractReportId(report) {
  if (!report || typeof report !== "object") return null;
  for (const key of ["reportId", "id"]) {
    if (report[key] != null && report[key] !== "") return String(report[key]);
  }
  if (typeof report.publicReportUrl === "string") {
    const match = report.publicReportUrl.match(/\/report\/([^/?#]+)(?:[/?#]|$)/);
    if (match) return match[1];
  }
  return null;
}

export function getTipKey(tip) {
  for (const key of ["id", "tipId", "uniqueId", "uniqueID"]) {
    if (tip?.[key] != null && tip[key] !== "") return `id:${tip[key]}`;
  }
  return tip?.name ? `name:${tip.name}` : null;
}

function firstValue(object, keys) {
  for (const key of keys) {
    if (object?.[key] != null && object[key] !== "") return object[key];
  }
  return "";
}

function metricValues(report) {
  const summary = report?.summary ?? {};
  const timings = report?.timings ?? {};
  return {
    score: firstValue(summary, ["score"]) || firstValue(report, ["score"]),
    load_time_ms: firstValue(summary, ["loadTime"]) || firstValue(report, ["loadTime"]),
    weight_bytes: firstValue(summary, ["weight"]) || firstValue(report, ["weight"]),
    requests: firstValue(summary, ["requestsCount", "requests"]) || firstValue(report, ["requests"]),
    lcp_ms: timings.largestContentfulPaint ?? "",
    fcp_ms: timings.firstContentfulPaint ?? "",
    tbt_ms: timings.totalBlockingTime ?? "",
    cls: timings.cumulativeLayoutShift ?? "",
  };
}

function addNumeric(values, value) {
  if (typeof value === "number" && Number.isFinite(value)) values.push(value);
}

function metricSummary(values) {
  if (values.length === 0) return { count: 0, average: "", min: "", max: "" };
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    average: total / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function tipImpact(tip) {
  return {
    value: firstValue(tip, ["value", "measuredValue"]),
    savings_ms: firstValue(tip, ["savings", "potentialSavings", "savingsMs", "timeSavings"]),
    savings_bytes: firstValue(tip, ["savingsBytes", "potentialSavingsBytes", "weightSavings"]),
    technical_location: firstValue(tip, [
      "resourceUrl",
      "resourceURL",
      "url",
      "filename",
      "file",
      "selector",
      "domPath",
      "element",
    ]),
  };
}

export function aggregateTips(reportContexts) {
  const groups = new Map();

  for (const context of reportContexts) {
    const reports = context.report ? [context] : [{ report: context }];
    for (const reportContext of reports) {
      for (const tip of reportContext.report?.tips ?? []) {
        const key = getTipKey(tip);
        if (!key) continue;
        const scopeKey = `${reportContext.monitoring?.id ?? ""}|${key}`;
        let group = groups.get(scopeKey);
        if (!group) {
          group = {
            key,
            scopeKey,
            monitoring: reportContext.monitoring ?? {},
            name: tip.name ?? "",
            advice: tip.advice ?? "",
            category: tip.category ?? "",
            priority: tip.priority ?? "",
            occurrences: 0,
            reportCount: 0,
            reportIds: new Set(),
            metricReportKeys: new Set(),
            impact: tipImpact(tip),
            rawTips: [],
            metrics: Object.fromEntries(
              ["score", "load_time_ms", "weight_bytes", "requests", "lcp_ms", "fcp_ms", "tbt_ms", "cls"]
                .map((metric) => [metric, []]),
            ),
          };
          groups.set(scopeKey, group);
        }

        group.occurrences++;
        group.reportCount = Math.max(
          group.reportCount,
          reportContext.reportCount ?? 0,
        );
        const reportId = extractReportId(reportContext.report);
        if (reportId) group.reportIds.add(reportId);
        group.rawTips.push(tip);
        const metricReportKey = reportId ?? reportContext.report;
        if (!group.metricReportKeys.has(metricReportKey)) {
          group.metricReportKeys.add(metricReportKey);
          const metrics = metricValues(reportContext.report);
          for (const [metric, value] of Object.entries(metrics)) {
            addNumeric(group.metrics[metric], value);
          }
        }
      }
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      affectedReports: group.reportIds.size || group.occurrences,
      reportCount: group.reportCount || group.reportIds.size,
      reportDateFrom: group.reportDateFrom ?? "",
      reportDateTo: group.reportDateTo ?? "",
      rawTips: JSON.stringify(group.rawTips),
      metricSummary: Object.fromEntries(
        Object.entries(group.metrics).map(([metric, values]) => [
          metric,
          metricSummary(values),
        ]),
      ),
    }))
    .sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name));
}

export function rollupTips(groups) {
  const rollups = new Map();
  for (const group of groups) {
    let rollup = rollups.get(group.key);
    if (!rollup) {
      rollup = {
        ...group,
        scope: "total",
        monitoring: {},
        affectedReports: 0,
        reportCount: 0,
        reportDateFrom: "",
        reportDateTo: "",
        metrics: Object.fromEntries(
          Object.keys(group.metrics).map((metric) => [metric, []]),
        ),
        rawTips: [],
      };
      rollups.set(group.key, rollup);
    }
    rollup.occurrences += group.occurrences;
    rollup.affectedReports += group.affectedReports;
    rollup.reportCount = Math.max(rollup.reportCount, group.reportCount);
    rollup.rawTips.push(...group.rawTips);
    for (const [metric, values] of Object.entries(group.metrics)) {
      rollup.metrics[metric].push(...values);
    }
  }
  return [...rollups.values()].map((rollup) => ({
    ...rollup,
    rawTips: JSON.stringify(rollup.rawTips),
    metricSummary: Object.fromEntries(
      Object.entries(rollup.metrics).map(([metric, values]) => [
        metric,
        metricSummary(values),
      ]),
    ),
  }));
}

function toRow(group, totalReports) {
  const getAverage = (metric) => group.metricSummary[metric]?.average ?? "";
  const monitoring = group.monitoring;
  return {
    scope: group.scope ?? "monitoring",
    tip_key: group.key,
    tip: group.name,
    advice: group.advice,
    category: group.category,
    priority: group.priority,
    monitoring_id: monitoring.id ?? "",
    monitoring_name: monitoring.name ?? "",
    page_url: monitoring.url ?? "",
    report_count: group.reportCount || totalReports,
    affected_report_count: group.affectedReports,
    affected_report_rate:
      (group.reportCount || totalReports) > 0
        ? group.affectedReports / (group.reportCount || totalReports)
        : "",
    occurrences: group.occurrences,
    tip_value: group.impact.value,
    tip_savings_ms: group.impact.savings_ms,
    tip_savings_bytes: group.impact.savings_bytes,
    technical_location: group.impact.technical_location,
    avg_score: getAverage("score"),
    avg_load_time_ms: getAverage("load_time_ms"),
    avg_weight_bytes: getAverage("weight_bytes"),
    avg_requests: getAverage("requests"),
    avg_lcp_ms: getAverage("lcp_ms"),
    avg_fcp_ms: getAverage("fcp_ms"),
    avg_tbt_ms: getAverage("tbt_ms"),
    avg_cls: getAverage("cls"),
    raw_tips_json: group.rawTips,
  };
}

export async function runTips(baseURL, accessToken, outputFile = null, nameRegex = null) {
  const { lastDays } = await prompts(
    {
      type: "number",
      name: "lastDays",
      message: "Number of days to analyze:",
      initial: 30,
      validate: (v) =>
        (v > 0 && Number.isInteger(v)) || "Must be a positive integer.",
    },
    { onCancel },
  );

  let monitorings = await getMonitoringList(baseURL, accessToken);
  if (nameRegex) {
    const re = new RegExp(nameRegex);
    monitorings = monitorings.filter((m) => re.test(m.name));
  }

  console.log(
    `\nAnalyzing tips for ${monitorings.length} monitoring(s) over the last ${lastDays} day(s)...\n`,
  );

  const contexts = [];
  for (const monitoring of monitorings) {
    process.stdout.write(`Inspecting [${monitoring.id}] ${monitoring.name}... `);
    const lastReportPayload = await getMonitoringLastReport(
      baseURL,
      accessToken,
      monitoring.id,
      { metricsOnly: false, getUniqueIDsForTips: true },
    );
    const probeReport = lastReportPayload?.report;
    const probeReportId = extractReportId(probeReport);
    const { monitoringData } = await getMonitoringReports(
      baseURL,
      accessToken,
      monitoring.id,
      { lastDays, limit: 0, error: false },
    );

    let reportCount = monitoringData.length;
    for (const reportSummary of monitoringData) {
      const reportId = extractReportId(reportSummary);
      let report = reportId && reportId === probeReportId
        ? probeReport
        : reportId
          ? await getReportById(baseURL, accessToken, reportId, {
              metricsOnly: false,
              getUniqueIDsForTips: true,
            })
          : reportSummary;
      if (report) contexts.push({ report, monitoring: { ...monitoring }, reportCount });
    }
    process.stdout.write(`${reportCount} report(s)\n`);
  }

  const groups = aggregateTips(contexts);
  const rows = [...groups, ...rollupTips(groups)].map((group) =>
    toRow(group, contexts.length),
  );
  console.log(`\nMost common recommendations (${groups.length} monitoring-scoped rows):`);
  if (groups.length === 0) console.log("No tips found in the selected reports.");
  else groups.forEach((tip, index) => {
    console.log(
      `${index + 1}. ${tip.name || "(unnamed tip)"} — ${tip.occurrences} occurrence(s)` +
        (tip.advice ? `: ${tip.advice}` : ""),
    );
  });
  if (outputFile && rows.length > 0) writeTSV(outputFile, rows);
}
