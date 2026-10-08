---
name: forgemind-xray
description: Use when an existing application needs autonomous, read-only quality testing across GUI, API, CLI, and local integration surfaces.
---

# ForgeMind Xray

You MUST execute `node <plugin-root>/bin/forgemind.mjs xray run` before analysing, planning, scoring, or reporting. Marketplace installation does not create a global `forgemind` shell command.
Do not return a test plan, score, or report before the command has completed and its execution receipts have been inspected.

For an explicit local/test web URL, use the internal Codex Browser as Xray's preferred GUI executor. Start with a discovery pass and inspect `mission.criticalFlows`, `mission.testUrl`, and the returned prerequisites:

`node <plugin-root>/bin/forgemind.mjs xray run --goal "<scope>" --test-url <loopback-url> --adapters browser --artifacts workspace --json`

The URL MUST use `localhost`, `127.0.0.0/8`, `::1`, or a reserved `.test` host. Before Browser control, invoke the internal Browser skill and use its in-app Browser binding. For each safe route in `mission.criticalFlows`, execute every declared desktop and mobile viewport at the explicit same-origin local/test URL. Create or claim one tab, inspect its visible DOM, and execute only safe, non-destructive interactions: page loads, same-origin opted-in links, and non-submitting invalid-input validation.

The internal Codex Browser does not submit forms or perform login, download, upload, save, delete, account, administration, payment, deploy, publish, credential, or other consequential actions. Do not inspect cookies, local storage, profiles, passwords, or session stores. Do not start an app server, install packages, download a browser runtime, use another browser family, or invent a result.

For every attempted safe flow, capture observable before/after state and a screenshot artifact. Form a complete Browser receipt with `executor: "internal-browser"`, `viewport`, `surfaceId`, `control`, `status`, `componentIds`, `evidence`, `url`, `coverageArea`, `controlLabel`, `action`, `expected`, `actual`, and `reproduction`. The evidence must be workspace-local and refer to the current Xray run. Then execute:
Provide complete receipts only through `--gui-receipts`; incomplete observations remain Xray gaps.

`node <plugin-root>/bin/forgemind.mjs xray run --goal "<scope>" --test-url <loopback-url> --adapters browser --gui-receipts '<json-array>' --artifacts workspace --json`

Only that second CLI result is canonical: inspect its execution receipts, coverage, gaps, score, and improvement proposals before reporting. A visible Browser tab alone is not evidence.

If Browser control, the URL, evidence capture, or an eligible safe flow is unavailable, do not pass a successful GUI receipt. Preserve and report the CLI's returned Browser gap and next action, then continue command and API tests. If a flow is blocked or intentionally skipped, only pass a complete receipt with its truthful `blocked` or `skipped` status.

For direct CLI use without the internal Browser, Xray retains its workspace-local Playwright adapter. It runs only safe local checks and records unavailable controls as test gaps rather than claiming coverage. Playwright requires a declared local package and Chromium runtime; preserve `FM_XRAY_PLAYWRIGHT_UNAVAILABLE` with its exact next action when either is unavailable.

For local native GUI or mobile testing, Xray uses Android ADB only when it detects an Android surface and exactly one authorized emulator; it does not choose physical devices autonomously. Preserve `FM_XRAY_ANDROID_EMULATOR_UNAVAILABLE` or `FM_XRAY_ADB_UNAVAILABLE` when appropriate.

For visual regression testing, configure an explicit local web target plus `web.visualBaseline.enabled` and a `thresholdPercent` in the project-local ForgeMind Xray configuration. Review the UI first, then establish a baseline with `xray baseline`; normal `xray run` compares only workspace-local PNG screenshots against it. Configured navigation and API time budgets become findings only when receipt timing evidence exists. Native desktop and iOS simulator testing remain explicit environment gaps; never claim Android execution covers them.

Finally run `node <plugin-root>/bin/forgemind.mjs xray status --artifacts workspace --json` and hand off its detailed findings, explicit gaps, evidence references, Browser-covered areas, and informative score.
