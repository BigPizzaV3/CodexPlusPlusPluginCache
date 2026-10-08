# Settlement Detail analysis rules

## Input gate

- Supported extensions: `.csv`, `.xlsx`.
- The filename must contain both `SETTLEMENT` and `DETAIL`.
- The header must match at least six packaged Settlement Detail core columns.
- Headers containing Transaction Detail-only columns are rejected.
- Process no more than 10 files per request. Each file must be at most 25 MiB.

## Numeric integrity

The analysis is inconclusive if a populated amount or quote-price field cannot
be parsed as a decimal number. Do not coerce invalid values, formula strings,
or malformed numbers to zero.

## Settlement formula

For ordinary formula rows:

```text
settlementAmountValue = grossSettleAmount + sum(all packaged fee fields)
```

For same-currency rows, `grossSettleAmount` is the transaction amount. For
cross-currency rows, use the packaged validator's quote-pair direction and
quote price, then cross-check any converted transaction amount supplied by the
report.

Rows with zero computed gross, zero inline fees, and a non-zero settlement
amount are reported separately as non-formula rows. Do not force them through
the ordinary row formula.

## Fees

- Aggregate all fee fields defined in `scripts/core/constants.py`.
- Use the parser-generated `fee_summary`; never select fee fields from memory.
- Display interchange and scheme fee amounts, but do not infer their rates.
- When grouping card payments, include `cardBrand` and `cardCountry` when those
  dimensions are present.

## Evidence and privacy

- Report discrepancies with row index, transaction type, expected amount,
  actual amount, and explicit difference.
- A mismatch is evidence of a mismatch, not evidence of its business cause.
- Do not expose raw report rows, transaction IDs, merchant identifiers, or
  other unnecessary record-level data.
- Never send the report to an external service.
