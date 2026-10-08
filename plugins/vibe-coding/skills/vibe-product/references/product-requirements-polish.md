# Product Requirements Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Align one coherent product requirement or journey with repository behavior, acceptance criteria, tests, and documentation. The patch may update product docs, UI/API behavior, copy, analytics, tests, or maps only when they belong to the same owner-layer slice.

## Scope selection

Use the selected requirement, audit finding, product map row, or explicit user task. If the requirement lacks a necessary business decision, stop and report the missing decision instead of inventing product behavior.

## Polish targets

- Canonical requirement/spec wording, acceptance criteria, non-goals, and release gates.
- UI route/component states, copy/localization, analytics events, and user feedback.
- API/server behavior, schemas, auth/entitlement gates, and data lifecycle that directly implement the requirement.
- Tests and fixtures proving the acceptance criteria and important negative/no-access states.
- Traceability/product maps when the repository uses them.

## Implementation principles

- Make the smallest complete change that satisfies the selected product invariant.
- Preserve existing public contracts unless a contract change is explicitly part of the accepted requirement.
- Do not add vanity metrics, speculative flows, broad redesigns, dependency upgrades, or unrelated UX cleanup.
- Keep implementation behavior, docs, tests, and maps synchronized.

## Validation

Run repository-native checks for the changed product path, including relevant tests, type checks, lint/build, storybook/preview/screenshot checks, analytics assertions, or manual acceptance scenarios when available. Report unavailable gates honestly.
