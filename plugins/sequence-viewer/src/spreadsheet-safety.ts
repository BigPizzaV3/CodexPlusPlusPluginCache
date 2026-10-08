const IGNORED_SPREADSHEET_PREFIX = /^[\p{White_Space}\p{Cc}\p{Cf}]*/u;
const FORMULA_OPERATORS = new Set(["=", "+", "-", "@"]);

/** Prevent spreadsheet programs from evaluating an exported text cell. */
export function neutralizeSpreadsheetFormula(value: string): string {
  const ignoredPrefixLength =
    IGNORED_SPREADSHEET_PREFIX.exec(value)?.[0].length ?? 0;
  const operatorCodePoint = value.codePointAt(ignoredPrefixLength);
  if (operatorCodePoint == null) return value;

  const operator = String.fromCodePoint(operatorCodePoint);
  if (!FORMULA_OPERATORS.has(operator.normalize("NFKC"))) return value;

  // Standalone strand markers cannot invoke a formula and are valid biology.
  if (
    (operator === "+" || operator === "-") &&
    ignoredPrefixLength + operator.length === value.length
  ) {
    return value;
  }

  return `'${value}`;
}
