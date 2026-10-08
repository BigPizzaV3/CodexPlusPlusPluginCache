---
name: antom-reconciliation-expert
description: Analyze user-provided Antom Settlement Detail CSV/XLSX reports, validate settlement formulas, summarize fees, and identify evidence-backed discrepancies. Use for Antom settlement reconciliation and fee analysis; do not use for downloading reports or querying live accounts.
---

# Antom Reconciliation Expert

Analyze only report files the user has supplied. This public Skills-only
release performs local, read-only computation and does not access an Antom
account.

## Supported input

- Accept only `.csv` and `.xlsx` files whose basename contains both
  `SETTLEMENT` and `DETAIL`.
- Accept only Settlement Detail reports. Reject renamed Transaction Detail,
  Settlement Summary, or unrelated files using the packaged type gate.
- If no file is available, ask the user to upload an Antom Settlement Detail
  report. Do not offer to download it.

Before analysis, read [settlement-detail-rules.md](references/settlement-detail-rules.md).
Before presenting results, read [report-template.md](references/report-template.md).

## Required workflow

1. Work from this skill directory and run:

   ```bash
   python3 scripts/analyze_report.py --files <user-supplied-file> [<additional-file> ...]
   ```

2. Do not install packages or modify the user's environment. CSV works with
   the Python standard library. If XLSX support is unavailable, ask the user
   to export the report as CSV.
3. Treat `conclusive: false` as a hard stop for financial conclusions. Report
   the validation problem and the exact next step instead.
4. Use only the aggregate output from `analyze_report.py`. Do not paste raw
   rows, transaction IDs, merchant identifiers, or full report contents into
   the response.
5. Present results using the packaged report template. Every discrepancy must
   show expected amount, actual amount, and explicit difference.
6. Attribute a cause only when the report data proves it. Otherwise label the
   cause as undetermined and recommend the next evidence to collect.

## Financial invariants

- Fee totals must come from the parser's complete fee summary, covering every
  packaged fee field.
- Do not reverse-calculate interchange or scheme fee rates.
- Do not treat invalid or formula-valued numeric cells as zero.
- Do not explain an empty batch as a threshold or timing issue without
  separate evidence.
- Large datasets stay in the supplied file; return aggregate summaries and a
  bounded list of validation failures.

## Boundaries

This release does not:

- install or invoke Antom CLI;
- authenticate to Antom or request credentials;
- download reports or query transaction details;
- upload report data to an external service;
- execute payments, settlements, refunds, or other financial actions.

For live retrieval or authenticated account data, explain that a separately
reviewed MCP-backed capability is required.
