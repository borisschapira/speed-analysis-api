import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMonitoringList,
  getMonitoringLastReport,
  getMonitoringReports,
} from "../../src/lib/api.js";

const BASE_URL = "https://api.example.com";
const TOKEN = "test-token";

function mockFetch(payload, { ok = true, status = 200 } = {}) {
  const spy = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () =>
      ok
        ? { success: true, payload }
        : { success: false, errorMessage: "Err", errorCode: "TEST" },
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("getMonitoringList", () => {
  it("returns the monitorings array from the payload", async () => {
    mockFetch({ monitorings: [{ id: 101, name: "Homepage" }] });
    const result = await getMonitoringList(BASE_URL, TOKEN);
    expect(result).toEqual([{ id: 101, name: "Homepage" }]);
  });

  it("calls the correct endpoint", async () => {
    const spy = mockFetch({ monitorings: [] });
    await getMonitoringList(BASE_URL, TOKEN);
    expect(spy).toHaveBeenCalledWith(
      `${BASE_URL}/v1/speed-analysis/monitoring/list`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws on non-OK response", async () => {
    mockFetch({}, { ok: false, status: 401 });
    await expect(getMonitoringList(BASE_URL, TOKEN)).rejects.toThrow("401");
  });
});

describe("getMonitoringReports", () => {
  it("returns reportCount, statistics and monitoringData", async () => {
    const monitoringData = [{ reportId: "r1" }, { reportId: "r2" }];
    const statistics = { averageScore: 80 };
    mockFetch({ monitoringData, statistics });

    const result = await getMonitoringReports(BASE_URL, TOKEN, 101, {
      lastDays: 30,
    });
    expect(result.reportCount).toBe(2);
    expect(result.statistics).toEqual(statistics);
    expect(result.monitoringData).toEqual(monitoringData);
  });

  it("handles missing monitoringData gracefully", async () => {
    mockFetch({ statistics: {} });
    const result = await getMonitoringReports(BASE_URL, TOKEN, 101, {});
    expect(result.reportCount).toBe(0);
    expect(result.monitoringData).toEqual([]);
  });
});

describe("getMonitoringLastReport", () => {
  it("returns the payload when report is present", async () => {
    const payload = { report: { summary: { score: 85 } } };
    mockFetch(payload);
    const result = await getMonitoringLastReport(BASE_URL, TOKEN, 101);
    expect(result).toEqual(payload);
  });

  it("returns null when payload is empty", async () => {
    mockFetch(null);
    const result = await getMonitoringLastReport(BASE_URL, TOKEN, 101);
    expect(result).toBeNull();
  });
});
