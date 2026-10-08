# UX Flow Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit an end-to-end user/admin/system flow from entry point to completion, including permissions, state transitions, copy, recovery, and post-action feedback. Keep only issues that affect task completion, safety, clarity, conversion, or regression resistance.

## Inspect

Routes, navigation, guards, onboarding, forms, tables, dialogs, loaders/actions, API hooks, state stores, RBAC/plan/tenant rules, redirects, async jobs, notifications/toasts/emails, empty/loading/error/disabled/no-access states, analytics, i18n/copy, tests, docs, and generated navigation maps.

## Issue classes

- Flow continuity: broken entry/exit paths, lost state, wrong redirects, dead ends, missing next step, and unclear success/after-action behavior.
- Decision clarity: CTAs, labels, helper text, progress, destructive confirmations, plan/permission explanations, and recovery options that mislead users.
- State transitions: loading/pending/optimistic/partial-success/retry/error states that contradict backend or leave the user unsure.
- Permissions and context: visible actions not matching allowed actions, tenant/workspace/project context confusion, stale selected entity, and no-access/no-plan/over-quota states.
- Forms and validation: field order, required/optional ambiguity, validation timing, inline vs summary errors, disabled submit rules, and persisted draft behavior when present.
- Measurement and regression: missing tests/analytics hooks for critical funnel steps where repo patterns require them, stale nav maps, or shallow smoke coverage.

## Priority model

Flow issue causing data loss, destructive mistake, permission/tenant/plan bypass or confusion with high impact, broken critical path, or public conversion blocker on a primary route.

Important task-completion friction, misleading state, missing recovery, inconsistent permissions/plan UX, or missing regression coverage for a core journey.

Lower-risk but concrete flow improvement: minor navigation ambiguity, weak microcopy, incomplete empty/error state, stale flow docs, or coupling that blocks safe UX iteration.

## Finding quality

- Every finding must cite `path:line[-line]` evidence for the flow owner and affected route/component/state, plus symbol when possible.
- Include actor, starting context, completion goal, expected result, acceptance criteria, and validation path.
- Use one unambiguous fix direction per finding; explain a tradeoff only when it changes the decision.
- Merge symptoms under the same journey owner unless fixes, rollout units, actors, or validation differ.
- Do not report cosmetic preferences unless they affect comprehension, safety, conversion, accessibility, permissions, or task completion.
