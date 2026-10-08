---
name: delivery-work-management-adapter
description: Convert Jira, Azure DevOps and GitHub exports into CIO portfolio, delivery risk, dependency and roadmap signals. Use when the user needs delivery work management adapter for CIO decision support.
---

# Delivery Work Management Adapter

## Mission

Turn delivery work-management exports into executive decision signals for portfolio, release and roadmap reviews.

## Inputs

Accept Jira, Azure DevOps, GitHub issue/PR exports, CSV/JSON files, pasted work item lists or connector-provided context.

## Workflow

1. Detect work item, issue, epic, release, defect, owner, state and dependency fields.
2. Extract blocked work, release risk, scope pressure, owner gaps and delivery dependencies.
3. Normalize signals for project portfolio, roadmap reprioritization and decision-readiness workflows.
4. Separate delivery facts from status narrative and unvalidated forecasts.
5. Route output into Executive Decision Packet or CIO Autopilot Review.

## Output Format

- Executive Summary
- Delivery Signals
- Blockers and Dependencies
- Owner Gaps
- Release / Roadmap Risk
- Missing Evidence
- Recommended Actions

## Guardrails

Use only user-provided exports or separately enabled connectors. Do not claim live Jira, Azure DevOps or GitHub access.
