import { describe, expect, it } from "vitest";
import { aggregateTips, extractReportId, getTipKey } from "../../../src/commands/tips.js";

describe("tip aggregation", () => {
  it("uses a stable tip ID when available", () => {
    expect(getTipKey({ id: "tip-1", name: "Optimize images" })).toBe("id:tip-1");
  });

  it("falls back to the tip name", () => {
    expect(getTipKey({ name: "Optimize images" })).toBe("name:Optimize images");
  });

  it("aggregates and sorts tips by occurrence count", () => {
    const result = aggregateTips([
      {
        report: {
          id: "r1",
          summary: { score: 80 },
          timings: { largestContentfulPaint: 1200 },
          tips: [{ id: "a", name: "A", advice: "first" }, { name: "B" }],
        },
        monitoring: { id: 1, name: "Homepage", url: "https://example.com" },
      },
      {
        report: {
          id: "r2",
          summary: { score: 90 },
          timings: { largestContentfulPaint: 1000 },
          tips: [{ id: "a", name: "A" }, { name: "B" }, { name: "B" }],
        },
        monitoring: { id: 1, name: "Homepage", url: "https://example.com" },
      },
    ]);

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "name:B",
        occurrences: 3,
        affectedReports: 2,
        reportCount: 2,
        rawTips: expect.any(String),
        metricSummary: expect.objectContaining({
          score: { count: 2, average: 85, min: 80, max: 90 },
          lcp_ms: { count: 2, average: 1100, min: 1000, max: 1200 },
        }),
      }),
      expect.objectContaining({
        key: "id:a",
        advice: "first",
        occurrences: 2,
        affectedReports: 2,
        reportCount: 2,
        rawTips: expect.any(String),
        metricSummary: expect.objectContaining({
          score: { count: 2, average: 85, min: 80, max: 90 },
          lcp_ms: { count: 2, average: 1100, min: 1000, max: 1200 },
        }),
      }),
    ]));
  });

  it("keeps explicit impact and technical location fields", () => {
    const [result] = aggregateTips([
      {
        report: {
          id: "r1",
          tips: [{
            id: "a",
            name: "Optimize image",
            value: 1200,
            potentialSavings: 350,
            savingsBytes: 2048,
            resourceUrl: "https://example.com/hero.jpg",
          }],
        },
        monitoring: { id: 1 },
      },
    ]);

    expect(result.impact).toEqual({
      value: 1200,
      savings_ms: 350,
      savings_bytes: 2048,
      technical_location: "https://example.com/hero.jpg",
    });
  });

  it("extracts report IDs from fields and public URLs", () => {
    expect(extractReportId({ reportId: 42 })).toBe("42");
    expect(extractReportId({ publicReportUrl: "https://example.com/report/abc" })).toBe("abc");
    expect(extractReportId({})).toBeNull();
  });
});
