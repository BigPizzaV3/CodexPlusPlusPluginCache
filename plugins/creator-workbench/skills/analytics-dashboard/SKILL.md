---
name: analytics-dashboard
description: Analyze a LinkedIn analytics export and, when a coding workspace is available, build an interactive local dashboard plus data-backed recommendations. Use when the user supplies LinkedIn analytics CSV/XLSX data or asks for a performance dashboard.
---

# LinkedIn Analytics Dashboard

## Inputs

Accept LinkedIn exports in CSV or spreadsheet form. Use only fields actually present.

## Analysis

When Python or another deterministic data tool is available:

1. inspect schema and date range
2. clean missing values and obvious type issues
3. calculate post-level and period-level metrics
4. separate totals from rates
5. identify outliers
6. compare formats, topics, posting times, and structural features only where data supports the comparison

## Dashboard path

If the current host provides a coding workspace and the user wants a dashboard, create a simple local React or static HTML dashboard with:

- summary KPIs
- trend view
- top and bottom posts
- filterable post table
- format/topic breakdown when fields support it
- recommendation panel

If no coding workspace exists, return the analysis as tables and narrative instead.

## Recommendations

Give 5 recommendations. Every recommendation must cite a specific pattern from the uploaded data and include the relevant metric or comparison.

Do not present correlation as proof of causation.

## Visual handoff

If a local dashboard, comparison board, or report is created, use `show-me` principles for the final artifact and verify the generated file when the host supports preview.

## Creator Workspace handoff

Use `sandbox-python-executor` for calculations. Hand the verified findings to `show-me` when the user wants a dashboard or visual comparison.
