---
name: forgemind-commands
description: "Use when a ForgeMind user wants to discover or deliberately select an advanced internal workflow."
---

# ForgeMind Commands

Show this concise choice list, then ask for a selection only when the user has not already stated one:

1. **Leap** — autonomously build a disruptive, tested MVP.
2. **Spark** — generate radical AI product directions.
3. **Venture** — validate market, positioning, pricing, and business-case assumptions.
4. **Ship** — implement and verify a bounded release.
5. **Growth** — plan activation, retention, monetization, and value-proof experiments.
6. **Portfolio** — rank AI-native product bets for the repository.
7. **Twin** — model workflows, integrations, and knowledge gaps in the application.
8. **Evolve UI** — plan a reversible, outcome-first UX experiment.
9. **Autopilot** — run a policy-bounded, goal-driven delivery mission.
10. **GUI Draft umsetzen** — implement a user-selected local PNG design draft with measured visual verification.

After the user selects one, invoke the matching advanced CLI command with their stated goal and report its evidence boundary, next action, hard stops, and artifact location. If no option clearly fits, use Compass instead.

For **GUI Draft umsetzen**, follow the Design Fidelity workflow exactly: create or load three local PNG proposals, let the user explicitly select one, persist a matching control contract, then run `design-fidelity prepare`. After `prepare` returns `implementation-ready`, you MUST inspect the selected draft and control contract, edit only matching allowed workspace UI files to implement that selected draft, run safe project verification, then run the exact measured verification command returned by `prepare`. Do not stop after `prepare`, and do not present the work order as an implementation. Keep changes only when the verification passes and the measured difference decreases.

Do not expose specialist routes as separate Marketplace skills. Do not claim market, customer, pricing, or delivery outcomes without returned evidence. Never run external, production, destructive, spending, or irreversible actions without the required configured adapter, policy, and approval.
