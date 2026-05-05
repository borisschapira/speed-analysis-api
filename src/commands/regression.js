import prompts from "prompts";
import {
  getMonitoringList,
  getMonitoringLastReport,
  getMonitoringReports,
} from "../lib/api.js";
import { writeTSV } from "../lib/export.js";

const METRICS = [
  {
    key: "score",
    label: "Score",
    current: (r) => r.report.summary.score,
    baseline: (s) => s.averageScore,
    higherIsBetter: true,
    format: (v) => v?.toFixed(0) ?? "N/A",
  },
  {
    key: "lcp",
    label: "LCP",
    current: (r) => r.report.timings.largestContentfulPaint,
    baseline: (s) => s.averageTimings?.largestContentfulPaint,
    higherIsBetter: false,
    format: (v) => (v != null ? `${Math.round(v)} ms` : "N/A"),
  },
  {
    key: "tbt",
    label: "TBT",
    current: (r) => r.report.timings.totalBlockingTime,
    baseline: (s) => s.averageTimings?.totalBlockingTime,
    higherIsBetter: false,
    format: (v) => (v != null ? `${Math.round(v)} ms` : "N/A"),
  },
  {
    key: "speedIndex",
    label: "Speed Index",
    current: (r) => r.report.timings.speedIndex,
    baseline: (s) => s.averageTimings?.speedIndex,
    higherIsBetter: false,
    format: (v) => (v != null ? `${Math.round(v)} ms` : "N/A"),
  },
  {
    key: "loadTime",
    label: "Load Time",
    current: (r) => r.report.summary.loadTime,
    baseline: (s) => s.averageLoadTime,
    higherIsBetter: false,
    format: (v) => (v != null ? `${Math.round(v)} ms` : "N/A"),
  },
];

function pctChange(current, baseline) {
  if (current == null || baseline == null || baseline === 0) return null;
  return ((current - baseline) / baseline) * 100;
}

function isRegression(metric, current, baseline, threshold) {
  const pct = pctChange(current, baseline);
  if (pct == null) return false;
  return metric.higherIsBetter ? pct < -threshold : pct > threshold;
}

function formatPct(pct, higherIsBetter) {
  if (pct == null) return "N/A";
  const sign = pct > 0 ? "+" : "";
  const flag = (higherIsBetter ? pct < 0 : pct > 0) ? " ⚠" : " ✓";
  return `${sign}${pct.toFixed(1)}%${flag}`;
}

function toRow(monitoring, lastReport, statistics, threshold) {
  const row = { id: monitoring.id, name: monitoring.name, url: monitoring.url };
  for (const m of METRICS) {
    const cur = m.current(lastReport);
    const base = m.baseline(statistics);
    const pct = pctChange(cur, base);
    row[`${m.key}_current`] = cur != null ? Math.round(cur) : "";
    row[`${m.key}_baseline`] = base != null ? Math.round(base) : "";
    row[`${m.key}_delta_pct`] =
      pct != null ? `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%` : "";
    row[`${m.key}_regression`] = isRegression(m, cur, base, threshold)
      ? "YES"
      : "no";
  }
  return row;
}

export async function runRegression(baseURL, accessToken, outputFile = null) {
  const { lastDays, threshold } = await prompts(
    [
      {
        type: "number",
        name: "lastDays",
        message: "Number of days for the baseline:",
        initial: 30,
        validate: (v) => v > 0 || "Must be a positive number.",
      },
      {
        type: "number",
        name: "threshold",
        message: "Regression threshold (% degradation to flag):",
        initial: 10,
        validate: (v) => v > 0 || "Must be a positive number.",
      },
    ],
    {
      onCancel: () => {
        console.error("Aborted.");
        process.exit(1);
      },
    },
  );

  const monitorings = await getMonitoringList(baseURL, accessToken);

  console.log(
    `\nChecking ${monitorings.length} monitoring(s) against ${lastDays}-day baseline (threshold: ±${threshold}%)...\n`,
  );

  const rows = [];
  let regressionCount = 0;

  for (const m of monitorings) {
    process.stdout.write(`Checking [${m.id}] ${m.name}... `);

    const [lastReport, { statistics }] = await Promise.all([
      getMonitoringLastReport(baseURL, accessToken, m.id),
      getMonitoringReports(baseURL, accessToken, m.id, {
        lastDays,
        limit: 0,
        error: false,
      }),
    ]);

    if (!lastReport?.report || !statistics) {
      process.stdout.write("skipped (no data)\n");
      continue;
    }

    const regressions = METRICS.filter((metric) =>
      isRegression(
        metric,
        metric.current(lastReport),
        metric.baseline(statistics),
        threshold,
      ),
    );

    if (regressions.length > 0) {
      process.stdout.write(`⚠ ${regressions.length} regression(s)\n`);
      regressionCount++;
    } else {
      process.stdout.write("✓ OK\n");
    }

    for (const metric of METRICS) {
      const cur = metric.current(lastReport);
      const base = metric.baseline(statistics);
      const pct = pctChange(cur, base);
      const regressed = isRegression(metric, cur, base, threshold);
      if (regressed) {
        console.log(
          `   ${metric.label}: ${metric.format(cur)} vs baseline ${metric.format(base)} (${formatPct(pct, metric.higherIsBetter)})`,
        );
      }
    }

    rows.push(toRow(m, lastReport, statistics, threshold));
  }

  console.log(
    `\n${regressionCount} monitoring(s) with regressions out of ${rows.length}.`,
  );

  if (outputFile && rows.length > 0) {
    writeTSV(outputFile, rows);
  }
}
