---
name: optional-connector-router
description: Route Teams, Slack, email, calendar and document exports into the correct Autonomous CIO connector profile and adapter workflow. Use when the user needs optional connector router for CIO decision support.
---

# Optional Connector Router

## Mission

Select the right connector profile for user-provided communication, mail, calendar or document context.

## Inputs

Accept pasted context, local CSV/JSON/TXT/Markdown exports, connector-provided context and mixed directories.

## Workflow

1. Detect likely source profile: Teams, Slack, Outlook Email, Gmail/Google Workspace, Calendar, SharePoint or manual.
2. Explain confidence and required fields.
3. Select the matching adapter skill.
4. Normalize available signals into CIO decision intelligence.
5. Escalate missing credentials, permissions or schemas as missing evidence, not failures.

## Output Format

- Detected Profile
- Confidence
- Selected Adapter Skill
- Required Fields
- Normalized Signal Plan
- Missing Evidence
- Next Step

## Guardrails

Profiles and adapters are optional. Live access requires separately enabled connectors and user authorization.
