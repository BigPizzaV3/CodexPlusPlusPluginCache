---
name: dsir-sdg
description: Discover UN Sustainable Development Goal indicators and statistical series, retrieve country or regional observations, and export verified data with units, dimensions and provenance. Use for UN SDG database questions, including health-related SDGs; WHO GHO uses a separate workflow.
---

# DSIR SDG Data Skill

Use the bundled client to query the public UN SDG Global Database directly. The
runtime requires Python 3.10+ and outbound HTTPS to `unstats.un.org`; it needs no
R installation, DSIR installation, API key, MCP server or hosted service.

## Execution

Locate this skill's directory and run `scripts/cli.py` with an available Python
3 interpreter. Paths below are relative to that directory. Do not install R or
ask the user to run commands. If script execution or script networking is
unavailable, report the execution limitation; do not invent results or replace
the API response with remembered numbers. Web-search access alone does not
establish that scripts can access the API.

```text
python scripts/cli.py doctor
python scripts/cli.py search "UHC SCI"
python scripts/cli.py locations "Western Pacific Region"
python scripts/cli.py describe 3.8.1
python scripts/cli.py get 3.8.1 --locations WPRO --output-dir /writable/path/sdg-uhc
```

Use a fresh writable output directory. `get` prints a short preview and paths to
complete results. Read `response.json` or `observations.csv` for the full result;
never treat the preview as the complete time series. Host output paths and Python
commands vary; do not assume a Windows user path or a particular bundled runtime.

## Identify the statistic before retrieving it

Translate the user's concept into short English catalogue keywords. `search`
searches both indicator and series catalogues. Every code must be confirmed
against the live catalogue, including codes supplied by the user.

- Distinguish an SDG indicator such as `3.2.1` from its statistical **series**:
  infant versus under-five, counts versus rates, and stratifications can coexist.
- Compare official series descriptions, units and dimensions using `describe`.
  Choose a standard series only when it clearly matches the request; state the
  choice. Ask when multiple reasonable choices materially change the answer.
- A search score measures text relevance, not semantic equivalence. Censored
  values, denominators, thresholds and age ranges need literal checking.
- Catalogue definitions change. In the release inspected during development,
  UHC is labelled **2025 methodology**, and `3.8.2` uses **40% of household
  discretionary budget**. Recheck the current catalogue. Do not substitute this
  for a request for 10%/25% of total household expenditure; explain the mismatch
  and ask whether the user wants the revised measure or another source.
- This skill covers the UN database, including non-health SDGs when requested.
  Never silently switch a request for WHO GHO into UN SDG, or vice versa.

Read [indicator selection rules](references/indicator_selection_rules.md) for
ambiguous metrics and methodology changes.

## Resolve geography and time

Use `locations` for names, ISO3 or numeric UN area codes. Suggestions are not
resolutions: clarify if the command returns `needs_clarification`.

WHO regions, UN geographic regions and income groups are different groupings.
Use a named official regional observation when the live UN catalogue provides
one. WPRO resolves to the catalogue's **WHO Western Pacific** group, not Oceania
or Eastern and South-Eastern Asia. Current-release historical observations do
not establish historical membership. Mention this for a regional time series;
ask about membership if the user requests country-derived aggregation. This
version does not calculate regional aggregates. Read
[location rules](references/location_rules.md) when the grouping is uncertain.

Omit year bounds for "all available years". "Since 2015" is inclusive. For
"latest", retrieve coverage and use the latest observed year for each exact
series/area/stratum; disclose differing years across countries. Never create a
current-year value or fill gaps by interpolation.

## Retrieve, inspect and answer

`get` retrieves every server page for the indicator/area scope and verifies the
declared total before filtering. Years, series and dimensions are filtered
locally, following DSIR's year-filter workaround. Supply the series chosen from
the live catalogue with `--series CODE`. Dimension/attribute filters use actual
metadata names and codes, for example `--dimension 'Sex=BOTHSEX'` only when the
metadata establishes that code. Repeat a flag for multiple allowed codes.
Use the metadata entry's `code` value and confirm it against observed rows;
`sdmx` is an alternative representation, not necessarily a valid filter value
for this JSON API (for example, use FEMALE/MALE where those are the returned
codes, rather than the associated SDMX F/M aliases).

Metadata code lists can advertise dimensions that are absent from a particular
area's actual observations. Inspect observed `observation_context.dimensions`
before adding optional ALLAGE/BOTHSEX/ALLAREA filters. If such a filter produces
no rows, check the unfiltered observation dimensions; do not infer that the
indicator has no data. Preserve any population restriction explicitly requested
by the user and explain when the source cannot establish it.

```text
python scripts/cli.py get 3.2.1 --locations PHL --series SH_DYN_MORT --year-from 2015 --dimension "Sex=BOTHSEX" --output-dir /writable/path/sdg-child-mortality
```

Inspect `qa`, `coverage_by_location`, `metadata`, and `observation_context`.
Keep all series and population strata separate; `dim1`/`dim2`/`dim3` being null
in the DSIR core does **not** mean the observations have no SDG dimensions.
Units come from observation attributes and their metadata code lists. Read
[output schema](references/output_schema.md) when constructing a table.

Failure states have different meanings:

- `un_api_request_failed`, `invalid_response`, `incomplete_data`: retrieval did
  not establish a complete result; do not say that the UN has no data.
- `indicator_not_found`/`series_not_found`: absent from the current catalogue.
- `indicator_no_data`: valid indicator, but a successful global query/probe has
  no observations.
- `filters_no_data`: observations exist, but the requested scope/filters have
  none. For mixed-country queries inspect missing-country coverage separately.
- `qa_failed`: keep the artifacts for inspection and explain the problem;
  do not present the affected result as verified.

Answer in the user's language. Give the official indicator name/code, selected
series code/name/methodology, geography, observed years, population dimensions,
unit and denominator, UN SDG source, retrieval date and relevant limitations.
Show the requested values with raw display text and uncertainty bounds when
present. Cite the actual query URL from provenance and offer the complete
`observations.csv`. Identify WHO as a custodian only if the returned source says
so. Do not label this personal skill an official UN or WHO service.
