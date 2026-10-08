# Desktop App Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit one desktop app boundary such as local storage, auto-update, IPC, native shell access, offline sync, file system permissions, notifications, packaging, or backend integration.

## Domain invariants

- Renderer/UI, main process/native layer, local storage, backend API, and OS permissions have explicit trust boundaries.
- Local secrets, tokens, files, logs, caches, and crash reports are protected.
- Auto-update, migrations, offline/sync, file access, notifications, and background tasks have defined failure/recovery behavior.
- Packaging/signing/notarization/release config matches the changed platform contour.
- Tests/manual checks cover the selected desktop behavior and supported platforms where relevant.

## Audit method

Trace the selected desktop flow through UI/renderer, main/native process, IPC/message validation, local storage/files, OS integrations, backend calls, update/packaging config, logs, tests, and release scripts.
