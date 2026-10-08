# Bot Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit bot flows, commands, state transitions, keyboards, copy, permissions, and platform constraints. Keep issues that affect user completion, safety, correctness, or operability.

## Inspect

Commands, message/callback handlers, routers, scenes/FSM states, keyboards, templates/copy, middleware, auth/permissions, deep links, scheduled/proactive messages, external integrations, persistence, i18n, tests, docs, and generated bot navigation maps.

## Issue classes

- Entry points: `/start`, `/help`, command list, deep links, onboarding, restart/recovery.
- Navigation/state: back/home/cancel, stale callbacks, invalid state recovery, unreachable states, cyclic dead ends, concurrent messages, session expiry.
- Keyboards/buttons: labels, ordering, destructive confirmation, callback payload limits, duplicate actions, platform-specific behavior.
- Input handling: accepted formats, validation, retry copy, free-text safety, attachment handling, rate/abuse controls.
- Permissions/privacy: admin/staff commands, user identity, group/private chat behavior, tenant/account context, sensitive data exposure.
- Message quality: formatting/escaping, length limits, localization, safe errors, empty/unavailable states, async/proactive status updates.
- Integration and persistence: payment/external callbacks, idempotency, duplicate deliveries, job scheduling, DB state sync, telemetry where present.

## Priority model

Security/privacy leak, permission bypass, payment/webhook/idempotency bug, state-machine dead end in a critical flow, destructive action risk, or data consistency issue.

Important flow cannot be completed reliably, stale callback/retry/error handling gap, unclear validation in core flow, duplicate flow logic, or missing critical bot coverage.

Lower-risk but concrete navigation/copy/state/accessibility issue that affects comprehension, support load, or safe future change.

## Finding quality

- Every finding must cite `path:line[-line]` evidence for the problematic behavior/contract and the owner layer, plus symbol when possible.
- Include reachable surface, affected actors/consumers/states, expected behavior, acceptance criteria, and validation direction when discoverable.
- Use one unambiguous fix direction per finding; explain a tradeoff only when it changes the decision.
- Merge symptoms under the same behavior owner/source of truth unless fixes, rollout units, or validation differ.
- Do not report theoretical risks, stylistic preferences, or generic best practices without current repo impact.
- Include affected user role, chat type, state, command, or callback when relevant.
- Do not create tasks for platform features the repo does not currently use or expose.
