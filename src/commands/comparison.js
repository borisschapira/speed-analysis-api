import prompts from "prompts";
import { getMonitoringList, getMonitoringReports } from "../lib/api.js";
import { writeTSV } from "../lib/export.js";

const METRICS = [
  {
    key: "score",
    label: "Score",
    get: (s) => s.averageScore,
    higherIsBetter: true,
    unit: "",
  },
  {
    key: "loadTime",
    label: "Load Time",
    get: (s) => s.averageLoadTime,
    higherIsBetter: false,
    unit: " ms",
  },
  {
    key: "lcp",
    label: "LCP",
    get: (s) => s.averageTimings?.largestContentfulPaint,
    higherIsBetter: false,
    unit: " ms",
  },
  {
    key: "fcp",
    label: "FCP",
    get: (s) => s.averageTimings?.firstContentfulPaint,
    higherIsBetter: false,
    unit: " ms",
  },
  {
    key: "tbt",
    label: "TBT",
    get: (s) => s.averageTimings?.totalBlockingTime,
    higherIsBetter: false,
    unit: " ms",
  },
  {
    key: "cls",
    label: "CLS",
    get: (s) => s.averageTimings?.cumulativeLayoutShift,
    higherIsBetter: false,
    unit: "",
  },
  {
    key: "si",
    label: "Speed Index",
    get: (s) => s.averageTimings?.speedIndex,
    higherIsBetter: false,
    unit: " ms",
  },
  {
    key: "weight",
    label: "Weight",
    get: (s) => (s.averageWeight != null ? s.averageWeight / 1024 : null),
    higherIsBetter: false,
    unit: " KB",
  },
  {
    key: "requests",
    label: "Requests",
    get: (s) => s.averageRequests,
    higherIsBetter: false,
    unit: "",
  },
];

function pctChange(a, b) {
  if (a == null || b == null || b === 0) return null;
  return ((b - a) / a) * 100;
}

function formatPct(pct, higherIsBetter) {
  if (pct == null) return "N/A";
  const sign = pct > 0 ? "+" : "";
  const improved = higherIsBetter ? pct > 0 : pct < 0;
  const icon = improved ? "✓" : pct === 0 ? "=" : "⚠";
  return `${icon} ${sign}${pct.toFixed(1)}%`;
}

function toRow(monitoring, statsA, statsB, labelA, labelB) {
  const row = { id: monitoring.id, name: monitoring.name, url: monitoring.url };
  for (const m of METRICS) {
    const a = m.get(statsA);
    const b = m.get(statsB);
    const pct = pctChange(a, b);
    row[`${m.key}_${labelA}`] = a != null ? +a.toFixed(1) : "";
    row[`${m.key}_${labelB}`] = b != null ? +b.toFixed(1) : "";
    row[`${m.key}_delta_pct`] =
      pct != null ? `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%` : "";
  }
  return row;
}

async function askDateRange(label) {
  const onCancel = () => {
    console.error("Aborted.");
    process.exit(1);
  };
  const { from, to } = await prompts(
    [
      {
        type: "text",
        name: "from",
        message: `Period ${label} — start date (YYYY-MM-DD):`,
        validate: (v) =>
          /^\d{4}-\d{2}-\d{2}$/.test(v) || "Use YYYY-MM-DD format.",
      },
      {
        type: "text",
        name: "to",
        message: `Period ${label} — end date (YYYY-MM-DD):`,
        validate: (v) =>
          /^\d{4}-\d{2}-\d{2}$/.test(v) || "Use YYYY-MM-DD format.",
      },
    ],
    { onCancel },
  );

  return {
    dateFrom: `${from}T00:00:00.000Z`,
    dateTo: `${to}T23:59:59.999Z`,
    label: `${from}_${to}`,
  };
}

export async function runComparison(baseURL, accessToken, outputFile = null) {
  console.log("\nDefine the two periods to compare:");
  const periodA = await askDateRange("A (reference)");
  const periodB = await askDateRange("B (comparison)");

  const monitorings = await getMonitoringList(baseURL, accessToken);

  console.log(
    `\nComparing ${monitorings.length} monitoring(s) between ${periodA.label} and ${periodB.label}...\n`,
  );

  const rows = [];

  for (const m of monitorings) {
    process.stdout.write(`Fetching [${m.id}] ${m.name}... `);

    const [{ statistics: statsA }, { statistics: statsB }] = await Promise.all([
      getMonitoringReports(baseURL, accessToken, m.id, {
        dateFrom: periodA.dateFrom,
        dateTo: periodA.dateTo,
        limit: 0,
        error: false,
      }),
      getMonitoringReports(baseURL, accessToken, m.id, {
        dateFrom: periodB.dateFrom,
        dateTo: periodB.dateTo,
        limit: 0,
        error: false,
      }),
    ]);

    if (!statsA || !statsB) {
      process.stdout.write("skipped (no data for one or both periods)\n");
      continue;
    }

    process.stdout.write("done\n");

    console.log(`\n  ┌─ [${m.id}] ${m.name}`);
    console.log(
      `  │  ${"Metric".padEnd(14)} ${"Period A".padStart(10)} ${"Period B".padStart(10)} ${"Delta".padStart(12)}`,
    );
    console.log(`  │  ${"─".repeat(48)}`);
    for (const metric of METRICS) {
      const a = metric.get(statsA);
      const b = metric.get(statsB);
      const pct = pctChange(a, b);
      const aStr = a != null ? `${a.toFixed(1)}${metric.unit}` : "N/A";
      const bStr = b != null ? `${b.toFixed(1)}${metric.unit}` : "N/A";
      console.log(
        `  │  ${metric.label.padEnd(14)} ${aStr.padStart(10)} ${bStr.padStart(10)} ${formatPct(pct, metric.higherIsBetter).padStart(12)}`,
      );
    }
    console.log(`  └${"─".repeat(50)}\n`);

    rows.push(toRow(m, statsA, statsB, periodA.label, periodB.label));
  }

  if (outputFile && rows.length > 0) {
    writeTSV(outputFile, rows);
  }
}
