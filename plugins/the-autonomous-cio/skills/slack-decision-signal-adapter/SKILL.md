---
name: slack-decision-signal-adapter
description: Convert Slack exports into CIO weak signals, blockers, incidents, owner language and decision fragments. Use when the user needs slack decision signal adapter for CIO decision support.
---

# Slack Decision Signal Adapter

## Mission

Transform Slack messages into governed CIO decision signals for review, without live Slack access claims.

## Inputs

Accept Slack CSV/JSON exports, pasted threads, channel digests or connector-provided context.

## Workflow

1. Identify channel, user, timestamp, thread and message text.
2. Extract blockers, incident signals, decision fragments, owner language and escalation texture.
3. Distinguish facts, sentiment, hypotheses and missing evidence.
4. Normalize signals for risk-chain, attention and action-ledger workflows.
5. Recommend whether to monitor, delegate, decide or escalate.

## Output Format

- Executive Summary
- Normalized Slack Signals
- Blockers and Decision Fragments
- Escalation Candidates
- Missing Evidence
- Next Actions

## Guardrails

Use only user-provided exports or future approved connectors. Do not claim automatic Slack access.
