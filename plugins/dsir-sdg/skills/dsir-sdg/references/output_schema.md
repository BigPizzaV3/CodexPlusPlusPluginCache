# Output schema

`response.json.data` and `dsir_clean.csv` reproduce DSIR 0.9.0 `sdg_clean()`:

| Field | Source and meaning |
|---|---|
| source | Always `sdg` |
| id | First raw `indicator` code; preserve all links in context |
| indicator | Raw `seriesDescription`, null if missing; no catalogue imputation |
| location | Raw `geoAreaCode` as a string, including its original padding |
| iso3 | DSIR WHO Member State M49 lookup; null for other areas |
| location_name | DSIR short country name, otherwise raw `geoAreaName` |
| year | Integer conversion of `timePeriodStart` |
| value | Original value as text |
| value_num | Numeric conversion; censored strings such as `<0.1` become null |
| low, high | Numeric `lowerBound`, `upperBound`, otherwise null |
| series | Official statistical series code |
| dim1, dim2, dim3 | Always null for SDG; these are GHO-only core columns |

Rows are sorted stably by location string then year, with nulls last. Nulls,
duplicates and nonnumeric values are retained. Bounds and percentages are not
rescaled, and missing observations are not invented.

`observation_context` aligns one-to-one with clean rows using zero-based
`clean_row_index` and `raw_row_index`. It retains all linked indicator codes,
dimensions, attributes (including Units and Nature), original source, footnotes,
time detail/coverage, base period and value type. `raw.json` preserves complete
filtered source records.

Metadata code-list entries may contain both `code` and `sdmx`. Observation
dictionaries and local filters use the JSON API `code`, not an SDMX alias.

Use **observations.csv** for colleague-facing exports: it includes the 15 core
fields plus dimension/attribute JSON, unit, source, footnotes and all indicator
links. Use `dsir_clean.csv` only for R parity/interoperation; it is insufficient
on its own for disaggregated analysis. Both CSVs use UTF-8 with BOM for Excel.

QA identifies incomplete identities, reversed intervals, interval inconsistencies,
duplicate keys, nonnumeric values, mixed strata and missing country coverage.
QA does not validate an estimate's underlying statistical methodology. Request
URLs, timestamps and response hashes establish retrieval provenance; dataset
updates can change past values. `manifest.json` records export file hashes.
