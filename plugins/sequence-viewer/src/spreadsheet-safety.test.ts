import { describe, expect, it } from "vitest";

import { neutralizeSpreadsheetFormula } from "./spreadsheet-safety";

describe("spreadsheet formula safety", () => {
  it.each([
    "=HYPERLINK(\"https://example.invalid\",\"public fixture\")",
    "+SUM(1,2)",
    "-SUM(1,2)",
    "@SUM(1,2)",
  ])("neutralizes a formula beginning with %s", (value) => {
    expect(neutralizeSpreadsheetFormula(value)).toBe(`'${value}`);
  });

  it.each([
    " ",
    "\t",
    "\r",
    "\n",
    "\u0000",
    "\u001b",
    "\u00a0",
    "\u2003",
    "\u200b",
    "\u202e",
    "\u2060",
    "\ufeff",
    "\ufeff\u200b \t",
  ])("neutralizes a formula after ignored prefix %j", (prefix) => {
    const value = `${prefix}=SUM(1,2)`;
    expect(neutralizeSpreadsheetFormula(value)).toBe(`'${value}`);
  });

  it.each([
    "\uff1dSUM(1,2)",
    "\uff0bSUM(1,2)",
    "\uff0dSUM(1,2)",
    "\uff20SUM(1,2)",
    "\ufe66SUM(1,2)",
    "\ufe62SUM(1,2)",
  ])("neutralizes compatibility-equivalent operators in %s", (value) => {
    expect(neutralizeSpreadsheetFormula(value)).toBe(`'${value}`);
  });

  it.each([
    "",
    " ",
    "\ufeff",
    "-",
    "+",
    "\t-",
    "URS0000D6941A",
    "CCNA2_MOUSE/171-297",
    "chr22:1001-1567",
    "already = ordinary text",
    "'=SUM(1,2)",
  ])("preserves a nonformula biological value %j", (value) => {
    expect(neutralizeSpreadsheetFormula(value)).toBe(value);
  });

  it("does not repeatedly modify a neutralized cell", () => {
    const neutralized = neutralizeSpreadsheetFormula("\u200b=SUM(1,2)");
    expect(neutralizeSpreadsheetFormula(neutralized)).toBe(neutralized);
  });
});
