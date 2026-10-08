# Platform and local evidence

## Current platform support

Treat TikTok LIVE Studio as a Windows and macOS product. The current official download page offers Windows plus separate Apple silicon and Intel Mac packages. Some older help pages and search results still say Windows-only; identify that as stale documentation rather than repeating it.

## Use the read-only collector

Run:

```text
node <skill-directory>/scripts/collect-diagnostics.mjs --pretty
```

The collector reports OS/architecture, app installation and process presence, allowlisted stream settings, projected audio source names/states, and bounded counts of recent log signals. It omits raw log lines, record folders, device IDs, account services, tokens, cookies, credentials, and stream keys.

Use `--help` for test overrides. Never point a test override at data outside the user's intended diagnostic scope.

## Windows evidence

Known current storage commonly includes:

```text
%APPDATA%\TikTok LIVE Studio\TTStore\services.json
%APPDATA%\TikTok LIVE Studio\logs\
```

The exact schema changes across releases. Read only allowlisted fields; do not edit `services.json` directly. Windows can expose TikTok LIVE Studio and `MediaSDK_Server` as separate per-process audio sessions.

## macOS evidence

The app bundle normally appears under `/Applications` or the user's `Applications` folder. Do not assume the Windows data layout. The collector checks a short list of expected Library roots and performs bounded, non-symlink discovery for names that match TikTok LIVE Studio. Report the discovered path and confidence instead of inventing an exact path.

Check visible macOS permissions for Camera, Microphone, and Screen & System Audio Recording. Do not read or modify the TCC database.

## What remains visible while the app is closed

Saved settings, installed version, app data, and logs can usually be inspected while TikTok LIVE Studio is closed. Runtime meters, active process audio sessions, source contention, negotiated camera formats, live network counters, and transient memory/CPU behavior require the app to be open. State which evidence is persistent and which is live.

## Diagnostic report status

Use one of: `diagnosed`, `probable`, `evidence-needed`, or `account-escalation`. Include the platform, whether the creator is LIVE, the evidence, the next reversible test, expected signal, rollback, and privacy exclusions.
