---
name: forgemind-leap
description: "Use when a new idea or an existing app needs a one-prompt, disruption-first path to a selected, market-aware, tested MVP without routine questions."
---

# Leap

When invoked without user text, load `playbooks/zero-input-defaults.md` and execute **Leap**. Analyze the current app when present; otherwise derive a disruptive opportunity from project context. State the automatically derived goal and continue autonomously.

Leap is ForgeMind's autonomous product-disruption journey. It converts an outcome into five AI-central workflow replacements, an assumption-labelled market chance and business case, one selected reversible MVP, a credible contrarian, and a completion contract.

Resolve this installed plugin's root and run the bundled runner:

```text
node <plugin-root>/bin/forgemind.mjs leap run --goal "<outcome>" --mode yolo --artifacts workspace --json
```

Then continue autonomously with `$forgemind-ship`. Implement the selected MVP rather than returning only ideas. Use the Leap decision record as the source of truth for the 10x hypothesis, moat, commercial wedge, acceptance criteria, kill condition, evidence boundary, and rollback path.

## YOLO Hero Loop

In YOLO mode, act as the persistent mission controller: autonomously execute the current ready packet, collect real evidence, and advance the mission. Do not stop after planning or hand off routine work back to the user.

The ordered packets are: `implement-thin-slice`, `functional-proof`, `experience-proof`, and `risk-and-release`. After each real result, persist progress with:

```text
node <plugin-root>/bin/forgemind.mjs leap advance --packet "<packet-id>" --outcome passed --evidence "<test-or-review-reference>" --artifacts workspace --json
```

For a failed check, diagnose and repair autonomously, then record `--outcome failed` with the real failure evidence. The Hero Loop retries the current packet up to its repair budget and only escalates after that budget, a stated hard stop, or an explicit evidence gate. Never mark a packet complete without real test, review, GUI, accessibility, risk, or readiness evidence.

Use Hero Control before and during execution to coordinate the full local delivery system:

```text
node <plugin-root>/bin/forgemind.mjs hero run --artifacts workspace --json
node <plugin-root>/bin/forgemind.mjs hero execute --run --artifacts workspace --json
```

Hero Control binds the current packet to a feature-flag experiment plan, configured local evidence connectors, release readiness, and an outcome benchmark. It runs no deployment, external API call, payment, pull request, or feature-flag mutation without an explicit configured adapter and the normal hard-stop approval.

Do not ask routine design, naming, scope, or sequencing questions. Make the smallest compatible and reversible choices from the existing app. Run relevant tests, GUI states, accessibility checks, risk checks, and a release-readiness assessment before handoff. Treat missing market, customer, ROI, or test evidence as an explicit assumption or gap—not a reason to stop safe work or a reason to invent proof.

Stop only before secrets or credentials, production access, data deletion, irreversible migrations, external spend, or high-stakes decisions. State the exact boundary, complete all independent work, and request only the minimum decision needed to proceed.

Load `playbooks/leap.md` for the full operating contract.

Resume after any interruption with `leap status` or `leap continue`; pass `--autonomy '{"maxExternalSpend":0,"requireFeatureFlag":true}'` to make the execution envelope explicit.
