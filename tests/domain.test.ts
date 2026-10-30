import { describe, expect, it } from "vitest";
import { toCsv } from "../src/lib/domain";
describe("admin CSV export boundaries", () => {
  it("neutralizes spreadsheet formulas supplied in profile text", () => {
    const csv = toCsv([
      {
        name: '=HYPERLINK("https://example.invalid","click")',
        city: "+SUM(1,1)",
        note: '@IMPORTDATA("x")',
      },
    ]);
    expect(csv).toContain("\"'=HYPERLINK(");
    expect(csv).toContain("\"'+SUM(");
    expect(csv).toContain("\"'@IMPORTDATA(");
  });
  it("keeps commas, quotes and newlines inside a single quoted field", () => {
    expect(toCsv([{ bio: 'A, B\n"C"' }])).toBe('"bio"\r\n"A, B\n""C"""');
  });
  it("does not turn empty exports into fake data", () =>
    expect(toCsv([])).toBe(""));
});
