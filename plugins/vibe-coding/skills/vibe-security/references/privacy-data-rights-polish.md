# Privacy Data Rights Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Fix one coherent privacy/data-rights boundary across collection, storage, derived data, external providers, user/admin controls, tests, and documentation when directly affected.

## Scope selection

Use the selected data field, consent setting, deletion/export flow, retention job, audit finding, failing test, or explicit privacy bug. Stop for missing legal/product decisions instead of inventing policy.

## Polish targets

- Data collection/validation, storage schemas, access controls, retention/deletion/export jobs, and derived stores.
- Provider adapters and webhooks that receive or delete the selected data.
- Logs/traces/analytics/error reports that may expose sensitive payloads.
- User/admin UI, copy, privacy settings, and operational docs when they implement the same boundary.
- Tests/fixtures proving primary and derived behavior.

## Implementation principles

- Minimize data exposure and preserve necessary compatibility.
- Do not claim legal compliance; implement repository-visible behavior and state remaining gates.
- Avoid broad data migrations unless the selected fix requires a safe migration/forward-fix plan.
- Keep maps/docs synchronized when used.

## Validation

Run targeted tests and safe scenarios for collection, consent/opt-out, export/deletion/retention, derived stores, logs, and provider behavior relevant to the selected boundary. Report unavailable managed-provider or backup checks as gates.
