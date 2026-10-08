# Product Journey Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/product_journey_map.md` as a map of user journeys and lifecycle states from entry/acquisition through activation, core value, retention, billing, support, and exit/deletion where present.

## Inspect

Routes, navigation shells, onboarding flows, forms, email/notification triggers, billing/upgrade/downgrade states, account/team flows, settings, admin/support paths, analytics, experiments, tests, docs, feature flags, and permission/plan guards.

## Map rules

- Write or update `docs/product_journey_map.md` when possible; otherwise print the full markdown.
- Preserve stable IDs: journey `JNY-*`, step `STEP-*`, state `STATE-*`, decision `DEC-*`, event `EVT-*`, blocker `BLK-*`.
- Anchor steps to current repository evidence with `path:line[-line]` plus symbol when possible.
- Model observable states and transitions; do not invent funnel assumptions or conversion claims that are not supported by code/docs/runtime evidence.
- Treat analytics, screenshots, and docs as aids; verify critical behavior against owner code/config/tests.

## Coverage

Capture actor, trigger, entry point, step sequence, decisions, permissions/entitlements, loading/empty/error/no-access/no-plan/offline states, analytics events, notifications, cancellation/retry paths, support/recovery, tests, and open gaps.

## Markdown structure

Use summary, conventions, lifecycle overview, journey diagrams in markdown text where useful, journey detail sections, state/decision matrix, analytics/notification links, coverage gaps, and unknowns.
