---
name: fitness-sync
description: Reconcile workout and activity-source snapshots into deterministic, provenance-preserving fitness facts in ChatGPT Library files; use for validation, rest-day checks, and source conflicts.
---

# Fitness Sync

Use this skill to normalize and reconcile workout and activity snapshots that the user provides or has already connected. Persist raw observations, normalized fitness facts, and diagnostics in the user's ChatGPT Library files. It is source-agnostic: connectors remain outside this plugin.

## Library-native persistence

- Resolve the selected or canonical Library fitness files before reading or mutating them.
- Read the complete relevant source snapshots and current canonical fitness data before reconciliation.
- Replace the same canonical Library file identity after validation; never create a second “latest” file for an ordinary sync.
- Preserve raw source observations, source completeness, coverage windows, stable IDs, conflicts, and audit history in the Library record.
- If the canonical fitness file is absent, ask whether to initialize one in Library. Do not write to local paths or assume a private database.

## Core rules

- Preserve raw source observations; do not fabricate a source value or treat absence as deletion.
- Require stable workout IDs, valid dates, non-negative measurements, and unique set identities.
- A complete zero-result workout pull is valid and must not delete prior canonical workouts.
- Reconcile by stable workout ID; classify records as new, updated, or unchanged.
- Do not add overlapping activity totals from different sources.
- Manual overrides outrank automated sources. Configure automated precedence explicitly for each deployment and retain conflicts as diagnostics.
- Reject incomplete, truncated, or future-dated activity responses before publishing a derived daily fact.

## Deterministic helpers

The bundled Python helpers validate and reconcile fixtures without network access and are retained as offline developer/test references. The ChatGPT runtime should use Caliber and Apple Health when those sources are connected, or reconcile user-provided snapshots when they are not; in either case, persistence uses Library reads/replacements and must not depend on launching a local process.

## Scheduled combined synchronization

The nutrition ledger's initialization contract owns the daily schedule in `sync.daily_sync_time_local`, defaulting to `23:55` local time. The scheduler must use the persisted IANA timezone and invoke `run_combined_sync` at that local wall-clock time. Every run pulls nutrition, Caliber workouts, Apple Health workouts, and Apple Health activity; it must emit a clear success or failure result even when no workouts exist. A successful run records its completion; an incomplete source response blocks publication. This is an orchestration contract for the host application: installing this skills-only plugin does not itself create an operating-system or ChatGPT automation.

Use the helpers with fixtures first. Add live connectors only outside this skills-only package, with separate authentication and privacy review.

## Safety boundary

Do not infer health conditions or prescribe medical treatment from workout/activity data. Keep source provenance and uncertainty visible whenever data is incomplete or conflicting.

Use the nutrition skill's [Library persistence contract](../nutrition-ledger/references/library-contract.md) for version-safe canonical-file reads and replacements. Fitness synchronization follows the same no-partial-write rule: if a source check, validation, reconciliation, or Library replacement fails, publish no derived fitness facts.
