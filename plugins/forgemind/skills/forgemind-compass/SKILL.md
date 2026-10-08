---
name: forgemind-compass
description: "Use when a product, app, or delivery goal is unclear and ForgeMind should choose the strongest safe starting path."
---

# ForgeMind One

Use this as the default start. Ask no question unless the answer changes safety, cost, production access, or a hard stop. Run `node <plugin-root>/bin/forgemind.mjs one --goal "<outcome>" --artifacts workspace --json`; it creates the canonical Foundation chain, starts the bounded Autopilot mission, and returns one next safe action. Run `node <plugin-root>/bin/forgemind.mjs status --artifacts workspace --json` to resume.

When invoked without user text, load `playbooks/zero-input-defaults.md` and derive a safe goal before running ForgeMind One. Marketplace installation does not create a global `forgemind` shell command; always use this bundled runner.

Compass selects and applies the appropriate internal route—discovery, transformation, market validation, delivery, or autonomous execution—without exposing a specialist-skill menu. For read-only application QA, use `$forgemind-xray` explicitly.
