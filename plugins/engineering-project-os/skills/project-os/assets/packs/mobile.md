# Mobile capability pack

Apply this pack to native or cross-platform applications, including their device lifecycle and system handoffs.

- Treat cold start, foreground, background, suspension, unlock, navigation focus and process restart as distinct entry conditions when they can change the outcome.
- Model permissions, camera, files, notifications, share sheets, deep links, system settings and other external surfaces as owned operation phases rather than ordinary synchronous calls.
- Bind async work, cached data, durable intents, files and cleanup to their initiating account, route, entity or generation. Cancellation of UI interest does not undo remote work.
- Separate JavaScript or shared-code tests from native runtime, installed artifact and physical-device evidence. Verify each affected platform independently.
- Keep platform-specific workarounds narrow, version-bounded and removable. Do not impose one mobile framework's architecture on another.
