import { getMonitoringList } from "../lib/api.js";
import { writeTSV } from "../lib/export.js";

function toRow(m) {
  return {
    id: m.id,
    name: m.name,
    url: m.url,
    state: m.state,
    enabled: m.enabled,
    frequency_min: m.frequency,
    error_message: m.errorMessage ?? "",
  };
}

export async function runList(baseURL, accessToken, outputFile = null) {
  const monitorings = await getMonitoringList(baseURL, accessToken);

  console.log(`Found ${monitorings.length} monitoring(s):\n`);
  monitorings.forEach((m) => {
    console.log(`- [${m.id}] ${m.name}`);
    console.log(`  URL:       ${m.url}`);
    console.log(`  State:     ${m.state}`);
    console.log(`  Enabled:   ${m.enabled}`);
    console.log(`  Frequency: every ${m.frequency} min`);
    if (m.errorMessage) console.log(`  Error:     ${m.errorMessage}`);
    console.log();
  });

  if (outputFile) {
    writeTSV(outputFile, monitorings.map(toRow));
  }
}
