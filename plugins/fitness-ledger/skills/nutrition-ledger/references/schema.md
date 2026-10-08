# Nutrition ledger schema

The ledger is a JSON object with `entries`, `weights`, `food_master`, `audit_log`, `targets`, `timezone`, `source_adapters`, and `sync`. `timezone` is required and must be an IANA identifier such as `Europe/London`; it defines every daily boundary and must not be inferred from the runtime environment. `source_adapters` records user-configured integration intent and status only; it must never contain credentials, account exports, or a claim that a live connection succeeded without a separate connector check.

- Active entries have `deleted_at: null`; tombstoned entries remain in history.
- Each entry needs a stable `entry_id`, `date`, `food_product`, `revision`, and nutrient fields as available.
- Per-field provenance belongs in `nutrient_provenance.<nutrient>` and uses A/B/C/D confidence tiers.
- `daily_cache` and the separate state file are derived views, tied to active ledger entries by `ledger_fingerprint`.
- A food-master record is reusable only when product identity, brand, flavor/formulation, and serving basis agree.

## Product identity v2

New or upgraded food masters may include `gtin`/`upc`, `brand_owner`,
`manufacturer`, `product_name`, `variant`, `package_size`, `serving_size`,
`serving_unit`, `source_product_id`, `fdc_id`, `source_url`,
`label_effective_date`, `first_seen_at`, `last_verified_at`,
`verification_source`, `formulation_hash`, `food_master_version`,
`supersedes_food_master_id`, and `status`. These fields are optional because
unknown identity facts remain unknown. `formulation_hash` is a deterministic
fingerprint of stable declared serving, macro, sodium/potassium, and ingredient
attributes; it detects change but is not a security identifier.

The bundled `product_identity.py` resolver uses exact GTIN first, then exact
non-GTIN identity only when the query contains sufficient attributes. Duplicate
matches and same-GTIN formulation changes return ambiguity/change states and
must not be silently assigned Tier-A identity confidence.

`resolver.py` applies the documented source ladder (user label, manufacturer,
USDA branded, verified local, Open Food Facts, analogue, reconstruction). It
returns the selected source, source ID, ordered candidates, and an explicit
unresolved/ambiguous status rather than guessing.

For barcode logging, `barcode.py` checks fresh verified local masters first.
Stale masters are revalidated only when authoritative candidates are available;
otherwise the result is explicitly `stale_local` and never silently treated as
fresh verification.

Entries may additionally expose `identity_confidence`, `portion_confidence`,
and `composition_confidence` as separate interpretable dimensions. These do
not replace nutrient-level A/B/C/D provenance tiers.

Coverage-aware reports should retain `items_total`, `items_known`,
`item_weighted`, `calorie_weighted`, and `confidence_weighted` per nutrient.
Adequacy classifications must be gated when coverage is insufficient; unknown
nutrients are never converted to zero for either totals or coverage.

`invariants.py` validates non-negative finite values, macro relationships,
sugar/fat bounds, quantity dimensions, and rounded calorie plausibility. It
returns structured severity-coded review issues; approximate label rounding is
handled with tolerance rather than exact equality.

Sparse branded labels may use `enrichment.py`'s per-nutrient selection shape:
`reported_value`, `analytical_value`, `selected_value`, `selection_reason`, and
`confidence_tier`. Reported values always win; analytical values fill only
missing fields; explicit user overrides remain auditable.

`longitudinal.py` summarizes mean, median, range, target-hit frequency, and
coverage-gated interpretation. `contributions.py` aggregates active known
nutrient values by food, excludes tombstones, and returns deterministic
proportional source contributions.

`activity_analysis.py` provides derived training/rest comparisons and bounded
pre-workout windows. It excludes future entries and tombstones, and uses
descriptive association language rather than causal claims.

`debt.py` produces a transparent usage/unknown/staleness priority queue for
food-master enrichment. `migration.py` provides a repeatable v2 migration that
preserves historical values, IDs, revisions, and tombstones without mutating
its input.

`resilience.py` defines offline fallback behavior without inventing fresh
verification. `body_trend.py` provides smoothed weight values with sample-size
metadata for uncertainty-aware energy analysis.
