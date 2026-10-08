# Privacy Policy

The Autonomous CIO is a local-first Codex plugin for executive decision support.

## Data Handling

- The plugin works with user-provided prompts, local files and local demo data.
- The local Python runtime does not authenticate to external systems by itself.
- SQLite memory writes require an explicit local DB path.
- Action outputs are drafts only and do not execute external work.
- Live connector access, when available in the host environment, requires separately enabled connectors and explicit user authorization.

## Storage

The plugin may create local files only when the user runs explicit local commands such as export, memory or release-package commands. No automatic remote storage is performed by the plugin runtime.

## High-Risk Domains

Legal, regulatory, HR, security and financial outputs are decision support and do not replace qualified specialist review.
