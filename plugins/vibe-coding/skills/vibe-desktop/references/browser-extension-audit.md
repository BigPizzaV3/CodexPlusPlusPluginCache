# Browser Extension Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit one browser extension boundary such as permissions, content scripts, background/service worker, messaging, storage, native messaging, page injection, update behavior, or external API access.

## Domain invariants

- Manifest permissions, host permissions, content script injection, background worker, and messaging are least-privilege and match the feature.
- Page context, extension context, backend API, and native host boundaries are explicit and validated.
- Tokens, user data, local storage, clipboard, downloads, tabs, and cross-origin requests are protected.
- Failure, reload, update, browser restart, and permission revocation behavior is safe.
- Tests/manual checks cover the selected extension behavior in supported browsers where relevant.

## Audit method

Trace the selected extension flow through manifest, content/background scripts, message handlers, storage, API clients, injected code, native messaging, UI/popup/options page, tests, and release packaging.
