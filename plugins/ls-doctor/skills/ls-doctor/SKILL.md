---
name: "ls-doctor"
description: "Diagnose LIVE Studio safely with desktop inspection and web fallback."
---

# LS Doctor

Diagnose the failing layer before changing anything. Keep all evidence local unless the user explicitly approves sharing a previewed, sanitized report.

## Run the workflow

1. Establish the current risk state.
   - Ask whether the creator is LIVE only when it is not already clear.
   - While LIVE, perform read-only inspection only. Do not restart apps, kill processes, switch devices, reset settings, clear data, or alter scenes.
   - Never click **Go LIVE**, **End LIVE**, an inactivity check, an appeal submission, or a public send/post control for the user.
2. Record the minimum facts: operating system and architecture, TikTok LIVE Studio version, exact symptom, when it began, last-known-good state, and any app, OS, driver, hardware, or routing change.
3. Establish the available inspection mode before promising machine access.
   - Read `references/desktop-inspection.md`.
   - If Computer Use is available and the user permits access to the target app, prefer the ChatGPT desktop-app inspection path.
   - If Computer Use is unavailable, say plainly that LS Doctor cannot inspect the computer from the current chat. Do not claim this proves the user is on the web; desktop availability can also be limited by setup, rollout, region, workspace policy, or permissions.
   - Give the official desktop-app link and one concise reason, then continue with manual questions, screenshots, or user-run diagnostics. Do not make desktop installation a requirement.
4. Gather bounded evidence.
   - Run `scripts/collect-diagnostics.mjs` with Node.js 18 or newer. Use `--pretty` for readable JSON.
   - If `node` is unavailable, use the Codex desktop dependency locator when exposed and run the script with its bundled Node executable.
   - Treat the collector as read-only. It projects allowlisted settings and counts log signals; it never emits raw logs, device IDs, account state, tokens, cookies, credentials, or stream keys.
   - Use Computer Use when available to inspect the visible TikTok LIVE Studio panel and the relevant Windows or macOS settings. If the target blocks control, use screenshots or ask for one precise observation.
5. Classify the failure into one primary domain. Separate account gates from local faults, audience audio from local monitoring, and upstream alert generation from LIVE Studio rendering.
6. Load only the reference that matches the primary domain. Consult `references/harry-field-guide.md` only for a creator-tested secondary test after the primary reference has narrowed the failure.
7. State the leading cause and confidence, plus the evidence for and against it. Do not present guesses, historical UI labels, or creator heuristics as current platform facts.
8. Run one reversible test. State its expected signal and rollback before making a change. Change one variable at a time and preserve the previous value.
9. Verify from the viewer path when possible: TikTok LIVE Studio meters, mobile preview, Test audio, a short local recording, or a controlled private test. A local speaker sounding correct is not proof that the audience feed is correct.
10. If unresolved, prepare the bounded escalation record in `references/support-and-escalation.md`.

## Route to the right reference

- Desktop-app availability, Computer Use, permissions, or web/manual fallback: read `references/desktop-inspection.md`.
- Access, eligibility, stream keys, agencies, inactivity checks, restrictions, or appeals: read `references/access-and-safety.md`.
- Missing, doubled, delayed, distorted, or misrouted audio: read `references/audio-routing.md`.
- Camera, OBS Virtual Camera, sources, portrait/landscape/dual layout, or co-host layouts: read `references/camera-sources-and-layouts.md`.
- Link/browser-source sizing or sound, missing alerts, or chat/gift/notification faults: read `references/browser-links-and-alerts.md`.
- CPU, GPU, memory, stutter, frame drops, bitrate, disconnections, or multistreaming: read `references/performance-and-network.md`.
- Install, launch, login, crash, frozen UI, missing widget/control, or update failure: read `references/app-runtime-and-updates.md`.
- Installed version, saved settings, logs, closed-app inspection, or platform paths: read `references/platform-evidence.md`.
- Unresolved incidents, update regressions, or TikTok support handoff: read `references/support-and-escalation.md`.
- Time-sensitive or disputed product facts: verify against `references/sources.md` and current official pages.
- Proven creator workflows or historical troubleshooting claims: use `references/harry-field-guide.md` with `references/hub-source-ledger.md`.

## Keep the answer operational

Return these sections in plain language:

- **What is failing:** one-sentence classification.
- **Evidence:** observed facts only.
- **Likely cause:** confidence of high, medium, or low; include the strongest alternative when material.
- **Next test:** one bounded action, expected signal, and rollback.
- **Result:** what the test proved or what evidence is still missing.

Prefer a short signal-flow diagram for routing problems. Avoid a long checklist until a narrower test has failed.

## Enforce safety and privacy

- Never request or expose a password, 2FA code, browser cookie, session token, stream key, server URL, or complete unredacted config/log folder.
- Never generate, spoof, patch, or bypass TikTok eligibility, feature locks, camera gates, stream-key access, moderation, or inactivity controls.
- Do not recommend VPN or location spoofing to obtain a feature or entitlement.
- Do not automate inactivity prompts. Advise the creator to remain present and respond manually.
- Treat cache deletion, app-data clearing, device resets, driver changes, reinstalls, and registry/TCC changes as disruptive. Back up relevant settings and obtain explicit confirmation while offline.
- Do not claim that local changes remove an account restriction. Read the exact notice and use legitimate support or appeal routes.
- Say that LS Doctor is independent and is not affiliated with or endorsed by TikTok, ByteDance, OBS, Apple, or Microsoft.
