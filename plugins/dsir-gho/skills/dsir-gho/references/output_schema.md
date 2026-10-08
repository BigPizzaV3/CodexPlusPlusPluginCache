# Output schema

## Retrieval files

`get` requires an explicit `--output-dir` and refuses an existing directory. A completed export contains `data.csv`, `response.json`, and `raw.json`, plus `manifest.json` with SHA-256 checksums. The terminal output contains a summary and up to 12 preview rows, not necessarily every observation.

The cleaned observation records use exactly these 15 fields in this order:

```text
source,id,indicator,location,iso3,location_name,year,value,value_num,low,high,series,dim1,dim2,dim3
```

| Field | Meaning |
| --- | --- |
| `source` | Always `gho`. |
| `id` | Source indicator code (`IndicatorCode`), following DSIR. This is not the WHO observation `Id`. |
| `indicator` | Official indicator name from the verified catalogue. |
| `location` | Source spatial code for the observation. |
| `iso3` | The country code when it occurs in the DSIR Member State snapshot; otherwise null. Regional aggregates have null `iso3`. |
| `location_name` | DSIR-compatible country short name or standard region name where available. Live variants outside that snapshot may have null names here. |
| `year` | Observation year. |
| `value` | Reported display value or source text, preserved separately from the numeric field. |
| `value_num` | Source numeric observation, when present. |
| `low` | Source lower uncertainty bound, when present. |
| `high` | Source upper uncertainty bound, when present. |
| `series` | Null for the GHO compatibility view. |
| `dim1` | Source `Dim1` value; meaning depends on the indicator. |
| `dim2` | Source `Dim2` value; meaning depends on the indicator. |
| `dim3` | Source `Dim3` value; meaning depends on the indicator. |

The fields are nullable strings, except `year` (nullable integer) and `value_num`, `low`, and `high` (nullable finite numbers). Cleaning retains rows and duplicate observations, sorting by location and then year with missing values last. It does not impute, aggregate, or deduplicate data.

Do not append extra columns to this compatibility table. Additional metadata, geographic types, dimension labels, source fields, QA, and provenance are separate in `response.json`. Original source records belong in `raw.json` and remain available for verification.

## Response fields

| Field | Contents |
| --- | --- |
| `schema_version`, `status`, `row_count` | Contract version, result status, and number of cleaned records. |
| `indicator` | `code`, `name`, `definition`, `unit`, `type`, and metadata evidence fields. |
| `query` | Normalized indicator, locations, spatial type, years, and dimension filters. |
| `resolved_locations` | Resolved location codes, names, types, and any resolution notes. |
| `region_scope_notes` | Notes distinguishing source-published aggregates and regional variants. |
| `available_years_in_result` | Unique observed years across the selected result. This is not a per-location completeness guarantee. |
| `coverage_by_location` | One entry per requested location, with `location`, observed `years`, and `row_count`, including requested locations with no matching rows. |
| `dimension_summary` | Observed dimension codes with available type and label information. |
| `metadata_errors` | Failures obtaining supporting dimension labels; inspect these before claiming full metadata. |
| `qa` | `status`, `issues`, `counts`, and `rows_modified`; QA checks do not edit observations. |
| `provenance` | Source retrieval details, request trace, skill version, and DSIR reference version and revision. |
| `baseline_probe` | Evidence used to distinguish an empty filtered selection from an indicator with no observations, when needed. |
| `data` | Full array of the 15-field cleaned records. |
| `observation_context` | Context aligned with the cleaned rows: zero-based `clean_row_index` and `raw_row_index`, original WHO `Id`, spatial and time fields, dimension types, source fields, comments, and dates. |
| `limitations` | Material interpretation and source-availability limits. |

`raw.json` preserves the original record array. `observation_context` is sorted to align with `data`: its entry at index `i` describes cleaned record `data[i]`. The context entry's `clean_row_index` is that zero-based cleaned index, and `raw_row_index` identifies the corresponding zero-based entry in `raw.json`. Use these explicit mappings when tracing an observation. Core `id` is an indicator code, so it is not an observation-level key; the original WHO `Id` and complete source dimensions remain in context and raw records.

`manifest.json` contains `created_at` and a `files` mapping from each data filename to its SHA-256 checksum. The terminal JSON adds output file paths, `preview`, and `preview_is_complete`; these fields describe the display and exported files.

## Interpretation

JSON null and empty CSV cells indicate missing information. A missing numeric value is not zero. The reported `value` may contain text or formatting that cannot safely be parsed as an ordinary number; use `value_num` for numerical analysis and retain the text for interpretation.

Do not infer missing uncertainty bounds or substitute a parsed display string for an absent source numeric value without explicitly documenting a separate transformation. Check that lower and upper bounds are meaningful for the same observation before displaying an interval.

Units and full definitions are optional metadata. Unit evidence can come from an explicit official name or a reviewed WHO metadata summary with a source URL and review date. The bundled summaries apply only when the live code and official name match; they are not refreshed on each query. Do not invent a `unit` column or fill metadata from memory. An indicator title is not automatically a full definition.

Multiple rows may exist for a location and year because of different dimensions. Preserve these rows. An apparent duplicate must be assessed using all source dimensions and identifiers before any deduplication.

## Coverage, QA, and provenance

Use the saved response to inspect the normalized selection, observed years and locations, dimension information, retrieval status, and QA findings. `coverage_by_location` includes requested locations with no matching rows; QA also reports these as `locations_without_data` warnings. For gaps within a location, compare its observed years with the requested range. For stratum-specific gaps, inspect the full `data` array because each location summary combines selected strata. `available_years_in_result` alone is insufficient. A complete paginated retrieval means the selected source response was collected; it does not imply every requested country-year has data.

Provenance should retain the source endpoint or request trace, retrieval time, indicator code and name, selection filters, geographic variant, and implementation version. Keep `raw.json` alongside `response.json` and `data.csv` so downstream users can check how the cleaned view relates to the source.

Only a verified complete empty selection can be described as “no matching observations”. A network denial, timeout, invalid response, incomplete pagination, or other failure does not establish absence of data. Explain the returned status and error rather than treating the result as a successful zero-row dataset.

| Status | Meaning |
| --- | --- |
| `ok` | The operation completed; still inspect `qa` and metadata warnings. |
| `no_matches` | Indicator search completed without a matching catalogue candidate. |
| `indicator_no_data` | The verified indicator has no observations in the checked baseline. |
| `filters_no_data` | The selected filters have no observations, while a baseline check found indicator data. |
| `needs_clarification`, `unknown_location` | Location resolution was not complete; no silently reduced query should follow. |
| `qa_failed` | Exported records failed QA; inspect the issues and do not present them as a validated answer. |
| `error` | Read `error.code` and `error.message`; no successful data retrieval is implied. |

Error codes can distinguish `indicator_not_found`, `invalid_query`, `who_api_request_failed`, `invalid_response`, `incomplete_data`, `output_exists`, and local output failures. A nonzero CLI exit code signals unresolved input, QA failure, or an execution error.
