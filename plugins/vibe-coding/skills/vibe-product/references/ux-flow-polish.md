# UX Flow Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Improve one coherent user/admin journey from entry to completion. The diff should close the actual flow gap across navigation, state, copy, permissions, validation, and feedback rather than polishing isolated UI fragments.

## Scope selection

- If the user named a flow, route sequence, funnel step, role, plan state, or task-completion issue, polish that journey and directly affected states.
- If the request is broad, inspect primary flows and apply the highest-confidence improvement with meaningful completion, safety, or conversion impact.
- Include related UI/copy/a11y/state/test fixes when they belong to the same journey.
- Avoid unrelated visual redesigns, backend contract changes, dependency changes, and feature expansion unless the flow fix requires them.

## Polish targets

- Entry points, navigation, breadcrumbs, redirects, step order, progress, completion/next-step states, and recovery paths.
- Forms, validation timing, disabled/submit/pending states, destructive confirmations, empty/error/partial-success/retry states, and toasts/alerts.
- Permission/plan/tenant/workspace context, visible vs allowed actions, upgrade/no-access/over-quota copy, and safe diagnostics.
- Accessibility for the journey: focus order, keyboard reachability, status announcements, semantic structure, accessible names.
- Directly affected tests, snapshots, analytics hooks, docs, and localization catalogs when the repo uses them.

## Implementation principles

- Reuse existing components, route conventions, state patterns, validation patterns, tokens, and i18n architecture.
- Keep visible promises aligned with backend behavior and product contracts.
- Prefer the owner layer for shared flow state or permission logic rather than local UI workarounds.
- Preserve unrelated behavior and routes.

## Validation

Run relevant repository-native checks. For UI changes, use preview/screenshot tooling when available; otherwise state the limitation. When possible, trace the journey step-by-step in the final response.
