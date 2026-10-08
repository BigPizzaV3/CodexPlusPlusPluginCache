---
name: teams-decision-signal-adapter
description: Convert Microsoft Teams messages or exports into CIO decision, risk, owner and evidence signals. Use when the user needs teams decision signal adapter for CIO decision support.
---

# Teams Decision Signal Adapter

## Mission

Turn Teams conversations into decision-ready signals without claiming direct message access.

## Inputs

Accept pasted Teams threads, CSV/JSON exports, channel summaries, meeting chat excerpts or connector-provided context.

## Workflow

1. Identify channel, chat, sender role, timestamp and message excerpt.
2. Extract decisions, blockers, owner language, weak signals, risks and action candidates.
3. Separate facts from informal claims and unresolved assertions.
4. Map signals into the connector-neutral decision signal format.
5. Route the result into an Executive Decision Packet or CIO Autopilot Review.

## Output Format

- Executive Summary
- Normalized Decision Signals
- Risks and Blockers
- Owners and Mentions
- Evidence Gaps
- Recommended Next Review

## Guardrails

Use only user-provided exports or separately enabled connectors. Do not claim live Teams access.
