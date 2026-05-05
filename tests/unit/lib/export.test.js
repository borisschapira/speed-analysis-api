import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { toTSV, writeTSV } from "../../../src/lib/export.js";

describe("toTSV", () => {
  it("returns empty string for empty array", () => {
    expect(toTSV([])).toBe("");
  });

  it("generates header row from object keys", () => {
    const rows = [{ id: 1, name: "Homepage" }];
    const lines = toTSV(rows).split("\n");
    expect(lines[0]).toBe("id\tname");
  });

  it("generates correct data rows", () => {
    const rows = [
      { id: 1, name: "Homepage" },
      { id: 2, name: "Checkout" },
    ];
    const lines = toTSV(rows).split("\n");
    expect(lines[1]).toBe("1\tHomepage");
    expect(lines[2]).toBe("2\tCheckout");
  });

  it("replaces null/undefined with empty string", () => {
    const rows = [{ id: 1, name: null, score: undefined }];
    const lines = toTSV(rows).split("\n");
    expect(lines[1]).toBe("1\t\t");
  });

  it("wraps values containing tabs in quotes", () => {
    const rows = [{ id: 1, name: "with\ttab" }];
    const lines = toTSV(rows).split("\n");
    expect(lines[1]).toContain('"with\ttab"');
  });
});

describe("writeTSV", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `export-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates the output file with correct content", () => {
    const rows = [{ id: 1, name: "Homepage" }];
    const filePath = join(tmpDir, "output.tsv");
    writeTSV(filePath, rows);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("id\tname");
    expect(content).toContain("1\tHomepage");
  });

  it("creates intermediate directories automatically", () => {
    const filePath = join(tmpDir, "nested/dir/output.tsv");
    expect(() => writeTSV(filePath, [{ a: 1 }])).not.toThrow();
  });
});
