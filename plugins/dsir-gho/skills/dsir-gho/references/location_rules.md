# Location selection rules

## Resolve inputs explicitly

Use `locations NAME [NAME ...]` to resolve the user's country names and codes. Quote a multiword name as one argument. Preserve input names and report ambiguous or unresolved entries; do not omit them silently. Use returned source codes in `get --locations`.

A geographic identifier may describe a country, territory, or regional aggregate. Keep the source type and label with the code. Do not treat a regional code as an ISO3 country code merely because it contains three characters. The retrieval client requires countries and regional aggregates in separate calls.

## Western Pacific requests

“Western Pacific” can mean a source-published regional aggregate or a set of country observations. Use the user's context to choose the interpretation and state it. Ask when these interpretations would lead to different outputs and the request does not distinguish them.

For source-published UHC aggregates, the source can expose both:

| Code | Treatment |
| --- | --- |
| `WPR` | Keep the official source label and identify this exact variant in the answer. |
| `WPR_WO_IDN` | Keep the official source label and identify this exact variant separately. Do not merge it with `WPR`. |

Use the current source metadata and observations to establish each variant's label and coverage. Explain the selected meaning; if both variants are relevant, report them separately. Do not assume that either variant has data for every GHO indicator or requested year.

The core table follows the DSIR naming snapshot: some live variant labels, including `WPR_WO_IDN`, may be missing from `location_name`. Read `resolved_locations` and the raw spatial fields to recover the verified label and type. A missing compatibility-table label does not make a successfully resolved live code invalid.

The presence or label of these series does not establish historical WHO regional membership. Do not claim that a country belonged to a region in a particular year merely from an aggregate code. If a question depends on a membership change or a historical membership definition, obtain explicit source evidence for that separate question.

Never replace a published regional value with an unweighted mean of countries. For a requested custom regional calculation, clarify the included places and aggregation method before calculating, and label the output as a derived result.

## Country groups and missing coverage

For requests for “all countries in a region”, show or retain the selected country list and its provenance. A fixed country lookup is not proof of historical membership. If the requested grouping is unavailable or its vintage is unknown, say so rather than silently substituting an aggregate or unsupported member list.

Preserve valid requested locations even if their selected indicator has no observations. Distinguish an unknown location code, a known location with no matching data, and an upstream failure. Coverage should be checked after applying the full indicator, year, and dimension selection.
