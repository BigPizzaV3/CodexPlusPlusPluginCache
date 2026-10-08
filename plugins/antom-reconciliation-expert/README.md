# Antom Reconciliation Expert

OpenAI Skills-only plugin for deterministic, local analysis of user-provided
Antom Settlement Detail reports.

## Public scope

- Accept Settlement Detail reports in CSV or XLSX format.
- Summarize net settlement and all supported fee fields.
- Validate row and batch settlement formulas using decimal arithmetic.
- Break fees down by payment method and available card dimensions.
- Identify discrepancies and show the computed evidence.

This release does not sign in to Antom, download reports, query live
transactions, execute financial actions, or install software. Users must
provide the report file they want analyzed.

## Source snapshot

The deterministic parser, validators, constants, and DSL schema were captured
from `ant-intl/antom-ai-tools` commit
`00fa515fa3d1b8d27542ae09df34c7f77d68e519`. The OpenAI wrapper narrows the
workflow to local files and adds a privacy-preserving aggregate analysis entry
point.
