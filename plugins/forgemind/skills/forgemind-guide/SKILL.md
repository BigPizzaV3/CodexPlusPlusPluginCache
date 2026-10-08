---
name: forgemind-guide
description: "Use when a ForgeMind user has an idea, existing project, or quality concern and wants a guided next step."
---

# Guided ForgeMind

Ask only for missing routing inputs, one at a time:

1. Starting context: `idea`, `project`, or `quality`.
2. Desired outcome: `improve`, `mvp`, or `ship`.
3. Working style: `guided` or `autonomous`.

Do not ask for a value the user supplied clearly. Run only:

`node <plugin-root>/bin/forgemind.mjs guide --context <context> --outcome <outcome> --mode <mode> --artifacts workspace --json`

It recommends an internal route only. State the recommendation, why it was selected, its alternative route when present, the next public action, and the returned safety boundary. Continue through Compass unless the recommendation is Xray; existing hard stops remain in force.

