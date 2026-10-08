---
name: nutrition-ledger
description: Log food, hydration, and body weight into an auditable ChatGPT Library nutrition ledger; use for corrections, daily panels, and provenance-aware nutrient totals.
---

# Nutrition Ledger

Use this skill when the user wants to log, correct, inspect, or summarize their nutrition data. Keep the conversation natural, but store entries in the user's persistent ChatGPT Library files. The canonical ledger is a Library file; never require a local filesystem path, a local process, or manual spreadsheet maintenance.

## Library-native persistence

- Search Library by the canonical filenames or the user's selected Library reference before reading or mutating data.
- Use the existing Library identity and current version when reading. Never create a duplicate copy when the canonical file already exists.
- Read the canonical ledger before every report or mutation; do not rely on search snippets or a cached state file alone.
- **Canon-first is mandatory:** resolve and read the canonical ledger before reading `Fitness_Ledger_Nutrition_Current_State.json` for any food-history, daily-food, correction, deletion, audit, or reporting request. The state file may only be used after canon as a derived cross-check.
- If canonical entries and current state disagree, canonical active entries win. Flag the cache as stale/inconsistent and rebuild or reconcile it; never omit a canonical item merely because the state/cache does not contain it.
- Never answer “show today’s foods”, “what did I eat today”, or equivalent from `Current_State` alone. Filter active canonical entries by the configured local date, then render from that reconciled canonical set.
- For a mutation, preserve the ledger's Library identity and replace that same Library file only after validation and state reconciliation succeed.
- Treat `Fitness_Ledger_Nutrition_Ledger.json` as canonical history and `Fitness_Ledger_Nutrition_Current_State.json` as rebuildable cache. The workbook is a reporting projection, not the operational source of truth.
- If a required Library file cannot be resolved, ask the user to select or upload it. Do not silently create an unrelated local ledger.
- If the user already has an established ledger under a different filename, prefer the selected or resolved existing file and preserve its identity; ask before creating or renaming anything. Generic filenames are defaults for new setups, not a reason to duplicate existing history.

## Core rules

- Treat the JSON ledger as canonical; a daily state file is rebuildable cache.
- Require a persisted IANA timezone (for example, `Europe/London`) before assigning dates. A detected local timezone may be offered as a setup suggestion only; it requires explicit user confirmation and persistence before any date-sensitive operation. Never infer it from the runtime clock or silently default to a region.
- Preserve corrections and deletions in the audit log. Do not silently overwrite history.
- Track nutrient provenance per field: A label/direct, B authoritative reference, C reconstructed estimate, D unknown.
- Track identity, portion, and composition confidence separately; never collapse them into an opaque score.
- Missing is `unknown`, not zero. Retain source-declared zeroes.
- Report item-, calorie-, and confidence-weighted nutrient coverage; gate adequacy interpretations when coverage is insufficient.
- Use package labels before generic databases for branded food. Scale known nutrients for weighed portions.
- Before reporting, reconcile from the ledger and validate it. Never report from a stale cache alone.

## DATE PREFLIGHT — REQUIRED BEFORE EVERY DATE-SENSITIVE OPERATION

Before any daily report, food log, hydration log, weight log, correction, deletion, fitness sync, or other date-sensitive operation:

1. Read the canonical ledger or initialization settings and resolve the user's configured IANA timezone.
2. If the timezone is missing or invalid, stop and ask the user to configure it. A detected timezone is a setup suggestion only and requires explicit user confirmation and persistence before proceeding. Never infer a timezone from the host, device, runtime, conversation metadata, or IP address.
3. Compute the current local date from the resolved timezone and the current instant. Never use the host/runtime date, UTC calendar date, or an unqualified `date.today()` result.
4. Show the resolved timezone and local date before mutation, for example: "Target ledger date: 2026-08-31 (America/New_York)."
5. For explicit historical dates, preserve the user's explicit date and record that it was user-assigned; do not reinterpret it through the current timezone.
6. Store the resolved timezone used for a new entry when the schema supports it. Changing a user's configured timezone must not rewrite historical entry dates.
7. Treat this preflight as a blocking guard, not explanatory guidance. Do not proceed on a failed or skipped preflight.

A successful write still requires canonical read-back verification. If the write or read-back cannot be completed, report "not persisted" and do not claim success.

## Product identity and versioning

Food masters may carry GTIN/UPC, brand/manufacturer, product name, variant,
package and serving attributes, source identifiers, verification timestamps,
and a deterministic formulation fingerprint. A same-GTIN formulation change
creates a new version linked by `supersedes_food_master_id`; it never rewrites
historical entries. Name-only or duplicate matches remain ambiguous and must
not receive unjustified Tier-A identity confidence. The offline reference
helpers live in `scripts/product_identity.py`.

## First-run setup

For a new user, initialize a ledger before logging data. Require a confirmed IANA timezone; collect only the goals the user chooses to set. Optional Apple Health and Caliber selections record local adapter intent, not credentials or a claimed live connection.

Initialization also configures the daily combined synchronization schedule. Default it to `23:55` in the user's configured local timezone (near midnight), and ask for a different `HH:MM` time if desired. The schedule must be stored in the ledger; never interpret it in UTC or the runtime host timezone. The scheduled run checks nutrition, Caliber workouts, Apple Health workouts, and Apple Health activity every day, including rest days. A successful run records its completion; a failed or incomplete source check must be reported and must not publish derived fitness facts.

After initialization succeeds, store the requested sync configuration in the Library ledger. Do not claim that an external scheduled task exists unless the host explicitly provides and confirms that capability. A user-controlled daily automation may be offered, but its absence must not block ordinary mobile logging and reporting.

Do not overwrite a ledger during onboarding. `--force` is reserved for an explicit replacement request.

## Daily reports

The bundled script is an offline developer/test reference. The ChatGPT runtime must use Library reads and replacements for persistence; mobile users must not be asked to run a command or depend on a local script.

Use the canonical renderer contract encoded in the ledger and skill. When the offline reference implementation is available in a development environment, it may be used for validation.

`panel` and `foods` have one stable report contract: header, active entry count, fixed meal order, consistent food lines, meal subtotals, daily totals, hydration, and explicit unknowns. Use plain protein totals; do not expose internal protein-credit fields.

## Conversational output contract

Apply this contract every time food or hydration is logged and every time a daily food report or panel is requested. Do not vary the structure based on how simple the entry seems.

For a successful food or hydration log, show:

1. The ledger date and configured timezone.
2. Every newly added item with its amount, calories, protein, carbohydrates, fat, and fiber. Show `unknown` when a value is unavailable; never silently omit the nutrient.
3. A subtotal for each affected meal or snack group.
4. The updated daily totals for calories, protein, carbohydrates, fat, fiber, and water when water is tracked.
5. Remaining amounts or overages against configured personal calorie, protein, and fiber targets when available.
6. Any material estimate, assumption, or unresolved nutrient identity issue.
7. A clear persistence/read-back confirmation after the canonical ledger write succeeds.

For `foods`/“foods for the day”, show every active entry grouped by the fixed meal order, followed by each meal subtotal and the full-day totals. For `panel`/“today’s panel”, retain the progress and micronutrient sections, but also include the same individual entries, meal subtotals, and full-day totals. A summary-only response is allowed only when the user explicitly asks for one.

The canonical renderer is the source of formatting for local or automated workflows. The conversational layer must preserve this same information when presenting a successful result; it must not replace the detailed confirmation with only the new daily total.

Natural-language report routing is mandatory:

- “Show today’s food,” “what did I eat today,” or equivalent requests map to `foods`.
- “Today’s panel,” “today’s numbers,” or equivalent requests map to `panel`.
- “Full nutrient panel” maps to `panel` followed by the labeled micronutrient section.
- Before either `foods` or `panel`, read canonical history first, select active entries for the configured local date, and reconcile state from those entries. `Current_State` is never the primary read source.
- If `Current_State` omits an active canonical item, include the canonical item in the report and mark/rebuild the state as stale rather than returning the incomplete cache view.
- Never manually reconstruct a daily report from raw JSON, a cache, or ad-hoc calculations when the canonical renderer is available.
- The Progress section reports calories and protein against the user’s personal targets (when configured), never FDA Daily Values. `%DV`/reference percentages belong only in the micronutrient section.
- If a personal target is unavailable, render the target as unavailable; do not substitute a generic DV.

For micronutrient panels, append a clearly labeled nutrient section after the canonical daily panel. Show amount plus %DV/reference for each known nutrient and `unknown` for missing fields.

## Safety boundary

This is a data-quality and tracking workflow, not medical diagnosis or treatment. Do not infer nutrient deficiencies from one day or incomplete coverage. Keep the user in control of every mutation and do not transmit ledger contents to external services unless they explicitly ask for it.

Read [the schema reference](references/schema.md) before modifying schema, provenance, cache, or workbook behavior.

Read [the Library persistence contract](references/library-contract.md) before implementing or changing Library-backed read, mutation, cache, or conflict behavior.

The offline reference modules in `scripts/` expose identity/versioning,
confidence, coverage, source resolution, barcode, enrichment, invariants,
debt, longitudinal, contribution, activity-join, and migration primitives.
They are testable building blocks; ChatGPT runtime persistence still follows
the Library contract above.
