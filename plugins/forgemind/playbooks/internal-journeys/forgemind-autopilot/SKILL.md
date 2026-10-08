---
name: forgemind-autopilot
description: Use when a Codex goal should be implemented end to end with evidence, recovery, and hard-stop safety boundaries.
---

# ForgeMind Autopilot

Treat the user’s goal as the outcome contract. Inspect the workspace, derive and execute the smallest safe plan, implement, test, review, repair, document evidence, and continue until the Definition of Done is met. Do not ask routine questions or request approval for implementation choices. Use configured local and remote adapters when permitted. Stop only for credentials, irreversible deletion or migration, real external spend, production-impacting actions, legally or contractually material decisions, a platform-required approval, or an objectively blocked goal. Persist checkpoints, decisions, action previews, rollback data, and verification evidence in the project.

Run `node <plugin-root>/bin/forgemind.mjs autopilot start --goal "<outcome>"`, then `node <plugin-root>/bin/forgemind.mjs autopilot run` and `node <plugin-root>/bin/forgemind.mjs autopilot status`. Resume an interruption with `node <plugin-root>/bin/forgemind.mjs autopilot resume`.
