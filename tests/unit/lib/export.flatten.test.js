import { describe, it, expect } from "vitest";
import { flattenObject, toTSV } from "../../../src/lib/export.js";

describe("flattenObject", () => {
  it("flattens nested objects with dot notation and serializes arrays to JSON", () => {
    const m = {
      id: 55429,
      config: {
        location: "France",
        browser: { name: "Mobile" },
        screen: { width: 1440 },
        cookies: [{ name: "OptanonConsent" }],
        emptyObj: {},
      },
      flag: false,
      count: 0,
      emptyString: "",
      nullable: null,
      undef: undefined,
    };

    const flat = flattenObject(m);
    expect(flat["id"]).toBe(55429);
    expect(flat["config.location"]).toBe("France");
    expect(flat["config.browser.name"]).toBe("Mobile");
    expect(flat["config.screen.width"]).toBe(1440);
    expect(flat["config.cookies"]).toBe(JSON.stringify([{ name: "OptanonConsent" }]));
    // empty object should be represented
    expect(flat["config.emptyObj"]).toBe("{}");
    // primitives preserved
    expect(flat["flag"]).toBe(false);
    expect(flat["count"]).toBe(0);
    expect(flat["emptyString"]).toBe("");
    // null/undefined become empty strings (keys present)
    expect(flat).toHaveProperty("nullable");
    expect(flat.nullable).toBe("");
    expect(flat).toHaveProperty("undef");
    expect(flat.undef).toBe("");
  });
});

describe("toTSV", () => {
  it("builds header as union of keys across rows and keeps arrays as JSON", () => {
    const row1 = { id: 1, a: "x", "config.cookies": JSON.stringify([1, 2]) };
    const row2 = { id: 2, b: "y" };

    const tsv = toTSV([row1, row2]);
    const lines = tsv.split("\n");
    const headers = lines[0].split("\t");
    // header contains union
    expect(headers).toContain("id");
    expect(headers).toContain("a");
    expect(headers).toContain("b");
    expect(headers).toContain("config.cookies");

    // row1 cookies cell is JSON (and quoted because of brackets/quotes)
    const cookieIndex = headers.indexOf("config.cookies");
    expect(cookieIndex).toBeGreaterThan(-1);
    const row1cells = lines[1].split("\t");
    expect(row1cells[cookieIndex]).toContain("[");
  });

  it("replaces null/undefined with empty cells and preserves false/0/empty string", () => {
    const rows = [{ id: 1, name: null, score: undefined }, { id: 2, ok: false, zero: 0, empty: "" }];
    const tsv = toTSV(rows);
    const lines = tsv.split("\n");
    // first data row: id\t\t
    expect(lines[1].startsWith("1\t")).toBeTruthy();
    // second data row should contain false and 0 and empty cell
    expect(lines[2]).toContain("false");
    expect(lines[2]).toContain("0");
  });

  it("escapes tabs, newlines and quotes in cells", () => {
    const rows = [{ id: 1, name: "with\ttab" }, { id: 2, name: "line1\nline2" }, { id: 3, name: 'has"quote' }];
    const tsv = toTSV(rows);
    // cells with tab/newline/quote should be quoted somewhere in the TSV output
    expect(tsv).toContain('"with\ttab"');
    expect(tsv).toContain('"line1\nline2"');
    expect(tsv).toContain('"has""quote"');
  });
});
