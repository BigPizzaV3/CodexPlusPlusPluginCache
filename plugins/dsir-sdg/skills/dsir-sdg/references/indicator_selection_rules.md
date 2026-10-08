# Indicator and series selection

An indicator is a reporting framework identifier; a series is the statistic.
`3.2.1` may include under-five mortality, infant mortality, and death counts.
`3.b.1` includes different vaccines. `3.c.1` includes occupation-specific density
and distribution. Selecting only an indicator does not resolve these differences.

Search uses official Indicator/List and Series/List, exact codes/names, keyword
coverage and conservative fuzzy matching. The small reviewed alias file maps
terms to terms only. Chinese requests should be translated to English keywords
by the agent. Relevance scores are not probabilities; review the official label.

Never use an undocumented code because it looks plausible. If an old series
endpoint still responds but its code is absent from the live catalogue, report
that limitation and do not treat it as a currently confirmed series.

For financial protection compare the threshold AND denominator. In the audited
2026.Q2.G.02 catalogue, indicator 3.8.2 is no longer the older 10%/25% total-budget
measure. A 40% discretionary-budget series answers a different question. UHC also
has a named 2025-methodology series. Explain revisions; do not merge methods.

Use description/metadata returned by UN for units and categories. When a full
definition is unavailable, say so and link the official metadata repository:
https://unstats.un.org/sdgs/metadata/. Do not invent a definition from a code.

An advertised series dimension does not guarantee it is populated in each
observation. For example, the inspected Philippine TB rows carried Reporting
Type but no Age/Sex/Location keys even though those appeared in the series code
lists. Inspect actual row context before adding optional total-population
filters, and do not assign an absent category to a row as though it were
explicitly reported. A user's explicit restriction must never be silently
discarded to obtain nonempty results.

Regional and country series can be published by different custodians or with
different updates. Keep release/source labels and compare like-for-like strata.
