# Browser Extension Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Fix one coherent browser extension boundary across manifest permissions, scripts, messaging, storage, backend/native integration, tests, and release packaging when directly affected.

## Scope selection

Use the selected extension feature, permission issue, messaging bug, audit finding, failing test, or packaging failure. Do not migrate manifest versions or redesign the extension globally unless required by the selected fix.

## Polish targets

- Manifest permissions/host permissions, content/background scripts, injected scripts, popup/options UI, and message handlers.
- Storage, tokens, cross-origin API calls, native messaging, clipboard/download/tab usage, and safe error states.
- Browser compatibility, tests/manual scripts, packaging, docs/maps, and release notes directly affected.

## Implementation principles

- Preserve least privilege and minimize host/page access.
- Validate message payloads across trust boundaries.
- Avoid exposing secrets or user data to page context.
- Keep browser compatibility and update behavior explicit.

## Validation

Run repository-native extension tests/builds and bounded manual/browser scenarios for the selected feature, including permission denial/revocation and reload/update behavior when relevant.
