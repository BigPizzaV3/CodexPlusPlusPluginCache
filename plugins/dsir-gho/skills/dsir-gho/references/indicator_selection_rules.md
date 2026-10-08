# Indicator selection rules

## Search and verify

Search the live WHO GHO indicator catalogue before retrieval. Query aliases and fuzzy matching rank catalogue records; they do not supply an independent indicator registry. Retain each candidate's actual code and official name. Do not treat the highest search score as sufficient evidence when the measure is ambiguous.

Use `describe CODE` to inspect a candidate's available metadata, dimensions, and observed values. Compare the requested concept, measure, population, geography, time, and strata. Inspect plausible competing candidates when they would produce a materially different answer.

The indicator catalogue and observation endpoints do not guarantee a complete methodology record. If a definition or unit is unavailable, retain null and report that limitation. An official name explicitly saying “per 100 000 population”, “number”, or another unit is usable unit evidence when recorded with its origin. A small bundled set of reviewed WHO metadata summaries can also supply a unit and definition when the verified live indicator code and official name match. Preserve `metadata_source`, `metadata_reviewed_on`, and `metadata_basis`; these summaries are not refreshed on each query. Never infer a unit solely from values, ranges, or familiarity.

## Material ambiguities

| User wording | Decision |
| --- | --- |
| “UHC” | Determine whether the request concerns service coverage or financial protection. Search both when context is insufficient. |
| “UHC service coverage index” | Use a verified catalogue entry for that measure; inspect geographic variants and observed years. |
| “TB incidence” | Present the verified rate and number candidates, and ask which measure the user needs unless the prompt specifies it. |
| “TB incidence rate” | Verify the denominator and measure in official metadata or the official name. Do not substitute the number of cases. |
| “Latest” | Find the latest observation for the chosen geography and strata. Distinguish a common latest year from latest-per-location values. |
| “Total” or “both sexes” | Inspect the indicator's dimension values. Do not assume a universal code or add overlapping strata. |

When clarification is needed, keep it concrete: “Do you need TB incidence per 100,000 population or the estimated number of incident cases?” If the user requests both, retrieve and label the measures separately.

## Dimensions and coverage

Dimension positions are indicator-specific. Verify both the dimension type and source value before using `--dim1`, `--dim2`, or `--dim3`. Do not interpret `Dim1` as sex unless the source establishes that meaning.

Observed year and dimension lists describe records returned by the inspected selection. They do not prove that every country-year-stratum combination exists. After applying all filters, inspect the actual output coverage again.

Do not silently collapse multiple rows for one country-year. Differences in sex, age, residence, estimate type, or another source dimension may be meaningful. Preserve uncertainty bounds and reported text alongside the numeric measure.

If the search has no supported candidate, explain that result and refine the concept. If retrieval fails, do not use a remembered number, a different source, or an unrelated indicator without explicitly changing the requested scope with the user.
