# Bot Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Improve a coherent bot flow or set of related states across navigation, menus, copy, validation, recovery, permissions, and platform constraints. Solve the selected journey end-to-end rather than tweaking one message while adjacent states remain broken.

## Scope selection

- If the user named a command, state, flow, callback, role, chat type, or issue, polish that flow and directly affected states.
- If the request is broad, inspect primary entry points and common bot journeys, then apply the highest-confidence improvements with visible user impact.
- Include related copy, keyboard, validation, stale callback, recovery, and privacy fixes when they belong to the same journey.
- Avoid unrelated features, new integrations, payment/business logic changes, and platform migrations unless the fix requires them.

## Bot-specific targets

- Entry points, `/start`, deep links, `/help`, command list, menus, submenus, stateful navigation, and recovery paths.
- Buttons/keyboards: clear labels, primary/secondary ordering, accessible text, destructive confirmations, stale callback handling, callback payload limits.
- Input prompts: accepted formats, validation, retry copy, cancel/back/home, free-text safety, attachment handling.
- Success/error/status/empty/no-access/unavailable states and async/proactive messages.
- Message formatting, escaping, message length limits, platform-specific keyboard behavior, localization, and privacy constraints.
- Permissions, group/private chat behavior, tenant/account context, and shared copy sources.

## Implementation principles

- Reuse existing routers, scenes/FSM patterns, keyboards, templates, i18n, guards, persistence, and telemetry patterns.
- Fix the flow owner rather than scattering unrelated message edits.
- Preserve current business rules unless the requested polish requires a behavior correction.
- Update directly affected tests, fixtures, snapshots, docs, and localization catalogs when the repo uses them.

## Validation

Run relevant repository-native checks. When explaining non-obvious repo facts, skipped adjacent work, or detected behavior, cite `path:line[-line]` where useful.

Manually trace the changed bot flow from entry to completion/recovery using code paths or available tests.
