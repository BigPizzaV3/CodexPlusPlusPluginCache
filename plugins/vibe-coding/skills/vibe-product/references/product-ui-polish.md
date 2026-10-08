# Product UI Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Product UI improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Fix the owning data/action contract before adding component-local conditionals.
- Keep async state explicit; cancel or ignore stale work and prevent duplicate destructive effects.
- Reuse the existing design system, accessibility patterns, copy, localization, and analytics conventions.
- Update only directly affected states and consumers; avoid route-wide redesign without evidence.

## Validation

- Run affected type/build/component/e2e/accessibility checks.
- Inspect representative desktop/mobile states, keyboard/focus flow, slow/error/retry, and auth/plan boundaries.
- Capture preview/screenshot evidence when tooling exists and list browsers/devices not exercised.
