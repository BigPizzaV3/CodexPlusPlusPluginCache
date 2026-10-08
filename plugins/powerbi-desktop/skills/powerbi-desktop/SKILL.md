---
name: powerbi-desktop
description: "Use when building Power BI models, trusting KPIs, changing PBIP safely, releasing, operating Fabric, or governing decisions."
---

# Power BI Index

This is the routing skill for the Power BI plugin. Do not enumerate scripts or load specialist workflows until the user's outcome is clear.

For "what can you do?", "help me get started", or broad orientation, read [orientation response](references/orientation-response.md) and return its user-facing content.

## Product Paths

| User outcome | Focused workflow | Result |
| --- | --- | --- |
| Build a model from data sources | `powerbi-model-wizard` | source-to-PBIP design pack |
| Understand or trust KPIs | local review plus executive brief | definitions, caveats, decision evidence |
| Change a PBIP/TMDL model | unified review | impact, tests, safe drafts |
| Release with confidence | release candidate pack | Go/Warn/No-Go and rollback evidence |
| Operate Fabric or a portfolio | enterprise operations pack | capacity, SLO, Direct Lake, governance evidence |
| Govern a decision or action | decision intelligence pack | Copilot quality, decision memory, owner actions |

Read the exact focused skill in full when one exists. Otherwise run the named workflow. Use only the minimum evidence needed, then offer a deeper path.

## Safety

- Never modify PBIX/PBIT binaries.
- Do not publish, sign in, refresh credentials, or change Power BI/Fabric content without explicit authorization.
- Label evidence as local, live, snapshot, heuristic, or draft.
