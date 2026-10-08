# Library persistence contract

This plugin uses ChatGPT Library as its persistence boundary. The conversation is the interface; Library files are the durable record.

## Canonical files

- `Fitness_Ledger_Nutrition_Ledger.json` is the canonical nutrition history, food master, provenance, targets, and audit log.
- `Fitness_Ledger_Nutrition_Current_State.json` is a rebuildable current-day cache and must never be treated as authoritative by itself.
- `Fitness_Ledger_Nutrition_Weight_Tracker.xlsx` is a reporting projection. It is not the operational source of truth.
- Fitness synchronization may use a separate canonical fitness/join file established during setup. Do not invent a filename when an existing Library reference is available.
- A user-selected or previously established ledger with another filename remains valid. Generic filenames are defaults for new setups only; never duplicate or rename an existing ledger automatically.

## Read path

1. Resolve the selected Library reference or search Library for the canonical filename.
2. Read the current canonical ledger and its current version before every report or mutation.
3. Only after canonical history has been read may `Fitness_Ledger_Nutrition_Current_State.json` be read as a derived cross-check. Never use current state as the primary source for food-history, daily-food, correction, deletion, audit, or reporting requests.
4. For date-scoped reports such as `foods` or `panel`, filter active canonical entries by the ledger's configured local date first, then reconcile state from that canonical set.
5. If current state omits, adds, or otherwise disagrees with canonical active entries, canonical history wins. Mark the state cache stale/inconsistent and rebuild or reconcile it; never silently omit a canonical item from user-visible output.
6. If the ledger is large, use the Library-supported materialization/edit path; do not ask the mobile user to download or run anything.
7. Reconcile current state from canonical entries before displaying totals.

## Mutation path

1. Resolve identity and nutrient provenance without changing the ledger.
2. Apply the append, correction, tombstone, or food-master mutation in memory.
3. Validate schema, dates, quantities, nutrient values, provenance, idempotency, and cache consistency.
4. Rebuild the current-state cache from the proposed canonical ledger.
5. Replace the same Library file identity using its retained current-version guard.
6. If the guarded replacement conflicts, reread the latest file, reapply the user mutation, and validate again. Never overwrite a newer version blindly.
7. Update the state file only after the canonical ledger replacement succeeds.

No partial mutation is successful. If any validation or write fails, report that the ledger was not changed.

## Reporting path

Reports use active canonical entries only, fixed meal ordering, explicit unknowns, and the configured IANA timezone. Missing nutrients remain unknown rather than zero. A report may be produced without updating the workbook; workbook synchronization is a separate projection step.

For `foods`, `panel`, “show today’s foods”, “what did I eat today”, and equivalent requests, canonical history is the mandatory first read. `Current_State` can validate or accelerate a reconciled result, but it can never narrow or replace the canonical result set. A stale cache is a cache-repair event, not permission to under-report the day.
