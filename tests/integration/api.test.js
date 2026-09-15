import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getMonitoringList,
  getMonitoringLastReport,
  getMonitoringReports,
  getReportById,
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
  vi.restoreAllMocks();
  delete process.env.DEBUG;
});

afterEach(() => {
  delete process.env.DEBUG;
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

  it("logs non-auth requests and responses when DEBUG=verbose", async () => {
    process.env.DEBUG = "verbose";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const payload = { monitorings: [{ id: 101 }] };
    mockFetch(payload);

    await getMonitoringList(BASE_URL, TOKEN);

    expect(info).toHaveBeenNthCalledWith(1, "[DEBUG] API request", {
      method: "POST",
      url: `${BASE_URL}/v1/speed-analysis/monitoring/list`,
      body: {},
    });
    expect(info).toHaveBeenNthCalledWith(2, "[DEBUG] API response", {
      url: `${BASE_URL}/v1/speed-analysis/monitoring/list`,
      status: 200,
      data: { success: true, payload },
    });
  });

  it("does not log non-auth requests when DEBUG is not verbose", async () => {
    process.env.DEBUG = "true";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    mockFetch({ monitorings: [] });

    await getMonitoringList(BASE_URL, TOKEN);

    expect(info).not.toHaveBeenCalled();
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

  describe("getReportById", () => {
    it("allows fetching tips from a full report", async () => {
      const spy = mockFetch({ report: { tips: [{ id: "tip-1" }] } });
      const result = await getReportById(BASE_URL, TOKEN, "report-1", {
        metricsOnly: false,
        getUniqueIDsForTips: true,
      });

      expect(result).toEqual({ tips: [{ id: "tip-1" }] });
      expect(spy).toHaveBeenCalledWith(
        `${BASE_URL}/v1/speed-analysis/analysis/report`,
        expect.objectContaining({
          body: JSON.stringify({
            reportId: "report-1",
            metricsOnly: false,
            getUniqueIDsForTips: true,
          }),
        }),
      );
    });
  });

  it("returns null when payload is empty", async () => {
    mockFetch(null);
    const result = await getMonitoringLastReport(BASE_URL, TOKEN, 101);
    expect(result).toBeNull();
  });

  it("allows full reports with tip IDs", async () => {
    const spy = mockFetch({ report: { tips: [{ id: "tip-1" }] } });
    await getMonitoringLastReport(BASE_URL, TOKEN, 101, {
      metricsOnly: false,
      getUniqueIDsForTips: true,
    });
    expect(spy).toHaveBeenCalledWith(
      `${BASE_URL}/v1/speed-analysis/monitoring/last-report`,
      expect.objectContaining({
        body: JSON.stringify({
          monitoringId: 101,
          metricsOnly: false,
          getUniqueIDsForTips: true,
        }),
      }),
    );
  });
});
