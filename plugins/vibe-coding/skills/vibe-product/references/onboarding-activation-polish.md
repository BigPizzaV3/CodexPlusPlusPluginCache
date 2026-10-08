# Onboarding Activation Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Improve one coherent first-run or activation path so a new or returning user reaches the next meaningful product value state safely and clearly. The diff should connect entry point, setup state, copy, navigation, permissions/plan context, recovery, and validation.

## Scope selection

- If the user named an onboarding step, signup handoff, empty state, setup wizard, invite flow, trial/upgrade state, or activation issue, polish that journey.
- If the request is broad, inspect primary activation paths and choose the highest-confidence improvement with measurable completion or support impact.
- Include related UI, copy, state, accessibility, analytics, tests, emails, and docs when they belong to the same activation path.
- Avoid new growth experiments, pricing changes, analytics vendors, or backend rewrites unless required by the selected issue.

## Polish targets

- Entry handoff: public CTA to auth, auth redirect, post-login destination, first-run detection, and next-step CTA.
- Setup: workspace/project/team creation, invitations, sample/demo data, integrations/imports, preferences, defaults, progress/checklist, and completion state.
- Context: role, tenant/workspace/project, plan/trial/quota, upgrade/no-access, and cross-device/session state.
- Recovery: failed setup, partial success, retry, cancel/back, unsaved data, support-safe diagnostics, and dead-end removal.
- Measurement: existing analytics/instrumentation hooks for activation-critical steps, without adding vendors unless the repo already standardizes that path.

## Implementation principles

- Reuse existing route guards, auth/session state, setup components, plan/permission helpers, i18n, and analytics patterns.
- Keep visible promises aligned with implemented product behavior and entitlements.
- Prefer owner-layer fixes for first-run detection and setup state over local page workarounds.
- Preserve existing users' state and migration safety.

## Validation

Run relevant repository-native checks. When possible, trace the path from entry to activation across success, partial, and failure states. Use preview/screenshot tooling when available.
