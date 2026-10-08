---
name: workshop-facilitator
description: "Run a repeatable Consultor workshop through phases: interrogation, contradictions, synthesis, artifacts, validation plan, and resume."
compatibility: Requires Python 3.11+ only when using the optional bundled workspace and audit helpers.
---

# Workshop Facilitator

Run Consultor as a structured workshop, not a loose chat.

Ask one question at a time. Do not recommend unless explicitly asked.

## Phases

1. Interrogation: clarify audience, problem, alternative, promise, offer, proof, channel, and validation.
2. Contradictions: surface conflicts between documents, claims, pricing, offer, proof, and channel.
3. Synthesis: consolidate current best understanding.
4. Artifacts: create only the documents needed for the branch.
5. Validation plan: turn assumptions into experiments.
6. Resume: restart from files, not memory.

## First Actions

1. Run init if needed:

```bash
python3 ../../scripts/consultor_init.py <project-root> --base-files --resume-note
```

2. Run audit:

```bash
python3 ../../scripts/consultor_audit.py <project-root> --mode workshop --stdout
```

Resolve script paths relative to this `SKILL.md` file before running them.

3. Use the weakest signal to choose the next question.

## Live Documents

Use or create:

- `consultor/context.md`
- `consultor/reports/workshop-checklist.md`
- `consultor/reports/consultor-audit.md`
- `consultor/reports/strategy-summary.md`
- `consultor/decisions.md`
- `consultor/assumptions.md`
- `consultor/risks.md`

Use the shared [`workshop-checklist.md`](../../templates/workshop-checklist.md) template when creating a workshop checklist.

## Done Threshold

Pause when the current phase has an explicit output and the next phase is clear.
