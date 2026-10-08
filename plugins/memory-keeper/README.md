# Memory Keeper

Memory Keeper is a skills-only stewardship plugin for persistent project truth and files. It requires no third-party account, MCP server, or external memory service.

## V4 workflow — package 0.5.0

Eight specialists compose behind `using-memory-keeper`:

- `using-memory-keeper` — mandatory router; loads every applicable specialist in dependency order;
- `maintaining-project-memory` — canonical durable truth, split/merge/compaction lifecycle;
- `auditing-persistent-state` — read-only inventory with completeness/pagination gates;
- `organizing-persistent-files` — idempotent move/rename/archive/delete/deduplicate with final-identity capture;
- `repairing-memory-state` — conflict repair with provenance and rollback point;
- `recovering-persistent-work` — fingerprinted bounded recovery with per-operation and global budgets;
- `verifying-persistent-work` — authoritative-evidence completion gate;
- `maintaining-memory-keeper` — developer-only tests/versioning/packaging discipline.

## Core law

A persistent change is not complete until applicable canonical memory is synchronized and the actual final persistent state is freshly verified.

## Anti-loop / fail-closed behavior

Recovery fingerprints the logical operation. A fingerprint gets at most one automatic recovery mutation; a transaction gets at most two automatic recovery mutations total. Renaming/subdividing a repair does not reset history. Fresh post-recovery evidence must show monotonic progress; no progress, regression, oscillation, ambiguity, missing capability, or exhausted budget ends in `BLOCKED / NOT COMPLETE`.

## Evidence and storage truth

- Direct provider-native read/list or local direct read/stat/hash is authoritative for final state.
- Search/index results are discovery/support evidence, not proof of destructive absence or exact final identity when direct evidence is available.
- Paginated/truncated/partial inventories must be completed or labeled `INCOMPLETE EVIDENCE` before destructive cleanup.
- `/mnt/data` is working storage, not proof of a Library/cloud mutation.

## Mechanical checks

```bash
python skills/maintaining-project-memory/scripts/memory_keeper_check.py --root /path/to/project
python skills/maintaining-memory-keeper/scripts/run_release_tests.py --source /path/to/memory-keeper
```

## Diagnostic marker

`MEMORY_KEEPER_V4_2026-09-17`

The marker proves V4 skill text is present when invoked; behavior alone does not prove universal host auto-loading.

## Distribution

Package version: **0.5.0**. Memory Keeper intentionally bundles no MCP server. Public target: **Skills only** in the ChatGPT Plugins Directory; local/repo marketplace bundles remain authoring/testing fallbacks.

## OpenAI public-directory packaging

The package includes OpenAI-facing publisher/display metadata and square branding assets under `assets/`. The release linter enforces the current public-directory package limits, including a 30-character short description, at most three starter prompts, required author/developer display metadata, and valid composer/logo files. Public submission still requires a separately verified OpenAI developer or business identity; package display metadata does not override that publisher-identity requirement.
