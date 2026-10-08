# Geography

The live UN GeoArea/List catalogue is authoritative for query area codes and
names. Numeric UN codes include countries, territories and aggregate groups;
some extended aggregate codes have more than three digits. Normalize code
padding for lookup/query, but retain the raw code in the DSIR cleaned output.

DSIR's versioned `who_countries.json` supplies ISO3-to-M49 and consistent short
names for WHO Member States. It is not a complete UN territory catalogue. A
territory's official UN name/numeric code can be used even if DSIR has no ISO3
mapping for it; cleaned ISO3 remains null, matching DSIR.

Exact names, common aliases and ISO3 resolve against the live area catalogue.
Fuzzy suggestions require clarification. Never drop an unrecognized location
and silently return the remainder as the user's complete request.

WHO Western Pacific was area `99047` in the inspected UN release. Runtime
resolution looks up the official name instead of assuming that code permanently.
Do not substitute UN Oceania or Eastern and South-Eastern Asia for WPRO.

For historical regional queries, use official published group observations and
explain that membership follows the current source release. DSIR's country
vectors are static and include a dated WHO membership change for Indonesia.
Neither those vectors nor a sequence of calendar years reconstructs historical
membership. If a requested group has no official observations, report missing
coverage, then clarify whether country-level results would satisfy the request.
This first version does not calculate country-derived regional aggregates.
