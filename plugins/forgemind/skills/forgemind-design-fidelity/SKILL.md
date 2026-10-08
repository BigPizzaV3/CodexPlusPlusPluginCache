---
name: forgemind-design-fidelity
description: Use when local PNG design references must be implemented and verified against a local web UI.
---

# ForgeMind Design Fidelity

## Canonical Product Design flow

Use this as the only flow for a Product Design handoff. When the user invokes Fidelity without an existing selected proposal, call `@Product Design` to create exactly three alternatives and stage their local PNG files in the workspace. Persist them:

`node <plugin-root>/bin/forgemind.mjs design-fidelity propose --inputs <proposal-1.png,proposal-2.png,proposal-3.png> --route <local-or-test-url> --viewport desktop --goal <design-goal> --artifacts workspace --json`

Present the three persisted local images with their proposal IDs, titles, and rationales. Ask exactly one decision question: which proposal should be implemented? Never infer a preference from ordering, filename, or recency. Persist the answer, including a short reason when the user gives one:

`node <plugin-root>/bin/forgemind.mjs design-fidelity select --proposal-set <set-id> --proposal <proposal-id> --reason <user-reason> --artifacts workspace --json`

Inspect only the immutable selected draft. Derive an observable control contract from it, recording uncertainty as an assumption rather than asking routine follow-up questions. Persist the contract before source changes:

`node <plugin-root>/bin/forgemind.mjs design-fidelity contract --contract '<json>' --artifacts workspace --json`

Create the implementation work order. `prepare` is deliberately not named `apply`: the CLI never pretends to have edited source files itself.

`node <plugin-root>/bin/forgemind.mjs design-fidelity prepare --proposal-set <set-id> --proposal <proposal-id> --control-contract <contract-id> --artifacts workspace --json`

Implement only the selected draft and work order. Do not reinterpret or redesign its observable layout, copy, controls, states, or safe interactions. Edit only matching workspace UI source, styles, templates, or local assets; never edit manifests, lockfiles, `.env` files, infrastructure, deployment, payment, identity, or production configuration.

After each source change, run the project's safe verification and then the exact verification command returned by `prepare` with recorded control observations. Keep an edit only if verification passes and the newly measured difference decreases. Fidelity records iterations, blocks a regression, and blocks further attempts once the contract limit is reached. Stop and report the exact evidence gap if the target is not local/test, a control is not evidenced, or the report is blocked.

Do not install packages, use external browsers, log in, submit forms, or claim a match without the current measured report.
