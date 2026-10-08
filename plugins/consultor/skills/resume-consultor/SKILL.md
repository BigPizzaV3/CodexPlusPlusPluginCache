---
name: resume-consultor
description: Resume an existing Consultor project by inspecting local consulting documents, initializing missing workspace structure, running the audit script, and asking the next highest-leverage question.
compatibility: Requires Python 3.11+ only when using the optional bundled workspace and audit helpers.
---

# Resume Consultor

Resume a Consultor project without restarting from scratch.

Do not ask the user to repeat information that can be read from project files.

Ask one question at a time after inspection.

## First Actions

1. Inspect for existing project state:
   - `consultor/`
   - `marketing/`
   - `strategy/`
   - `docs/`
   - `brand/`
   - `go-to-market/`
   - `campaigns/`
2. If `consultor/` does not exist, initialize the workspace:

```bash
python3 ../../scripts/consultor_init.py <project-root> --base-files --resume-note
```

3. If meaningful strategy or Consultor documents exist, run the audit:

```bash
python3 ../../scripts/consultor_audit.py <project-root> --stdout
```

Resolve script paths relative to this `SKILL.md` file before running them.

4. Use the audit to choose the next question.

## Phase-Aware Resume

Read `consultor/context.md` before asking the next question. If it contains a workshop phase, continue from that phase:

- Interrogation: ask about the weakest missing core signal.
- Contradictions: compare decisions, assumptions, risks, and evidence.
- Synthesis: run audit and update summary documents.
- Artifacts: create only the artifact needed for the current branch.
- Validation plan: convert assumptions into experiments.
- Resume: run init and audit before asking.

If no phase exists, infer the phase from the user's request and existing documents.

## Question Selection

Prioritize the missing or weakest item in this order:

1. Exact audience.
2. Problem, job, pain, or desire.
3. Main alternative.
4. Differentiation.
5. Concrete offer.
6. Proof or evidence.
7. Channel or path to buyer/user.
8. Next validation step.

## Documentation

Write only real content:

- Confirmed decisions.
- Active assumptions or hypotheses.
- Verified evidence.
- Risks.
- Open questions.
- Next validation steps.

Do not create decorative frameworks, empty files, or empty sections.
