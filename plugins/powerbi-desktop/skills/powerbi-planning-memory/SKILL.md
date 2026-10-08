---
name: powerbi-planning-memory
description: Use when storing and reusing Power BI planning memory across cycles, including forecast versions, assumptions, actions, overrides, actuals, error causes, segment lessons, and durable learning signals for autonomous planning.
---

# Power BI Planning Memory

Use this skill when the planning engine needs memory across forecast cycles.

## Memory records

- forecast run
- scenario assumption
- generated action
- human override
- owner response
- actual outcome
- model quality event
- data quality issue
- segment lesson

## Workflow

1. Preserve every planning run with timestamp, as-of date, horizon, grain, and input paths.
2. Store assumptions separately from outputs.
3. Link actions and overrides to later actuals.
4. Generate lessons:
   - segment is consistently optimistic
   - customer converts late
   - product line is supply constrained
   - roll forecast is better than AI
   - human override improved the result
5. Feed lessons into trust, readiness, and scenario generation.

## Required outputs

- `memory_id`
- `event_type`
- `as_of_date`
- `forecast_month`
- `grain`
- `entity_key`
- `signal`
- `impact`
- `lesson`
- `source_artifact`

## Guardrails

- Keep planning memory local-first unless the user explicitly provides an approved storage path or governance workflow.
- Keep memory append-only unless the user explicitly asks to clean it.
- Store personal or owner-level data only when it is necessary and governance allows it.
- Do not write secrets, tokens, credentials, or private contact details into planning memory.
