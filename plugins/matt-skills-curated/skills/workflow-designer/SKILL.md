---
name: workflow-designer
description: "Specify recurring operational, review, or content workflows with explicit triggers, inputs, actions, and ownership. Use when designing repeatable team routines, approval loops, release checklists, or automated processes — even if the user says \"design a workflow for this\". Do NOT use for one-off coding tasks."
---

# Workflow Designer

Design and formalize repeatable human-in-the-loop and autonomous workflows by identifying cyclical operational loops, pushing checkpoints right, and defining unambiguous execution contracts.

---

## Core Invariants

1. **Push Checkpoints Right**: Defer human checkpoints as far downstream as possible; maximize autonomous work before requesting review.
2. **Actionable Decision Briefs**: Checkpoints must present a tight, decision-ready brief with clear diffs and links—never raw, uncurated outputs.
3. **Mandate Nothing Structural**: Only add AI agents, schedules, or approval gates when the problem domain strictly requires them.
4. **Self-Contained Spec Completeness**: A workflow specification is complete only when an implementer agent can build it without asking clarifying questions.
5. **Durable Notes Separation**: Distinguish between immutable workflow specifications (`workflows/*.md`) and evolving domain observations (`NOTES.md`).

---

## Architecture & Map of Content (MOC)

```
[ Operational Habit / Team Routine ] ──► [ Loop Identification & Grilling ] ──► [ Workflow Formalization ] ──► [ Implementer Handoff ]
```

| Component | Responsibility | Location |
|---|---|---|
| **Workflow Specification** | Executable contract (trigger, inputs, actions, checkpoints) | `workflows/*.md` |
| **Domain & Tools Notes** | Observed vocabulary, habits, tools, and channels | `NOTES.md` |
| **Grilling Protocol** | Socratic distillation of requirements and boundary edges | `skills/grilling/SKILL.md` |

---

## Step-by-Step Procedure (TWI)

### Step 1: Identify Cyclical Loops & Document Baseline Notes
- **Action**: Analyze the user's recurring tasks (daily, weekly, per-release) and record observed tools/channels into `NOTES.md`.
- **Key Point**: Map the natural lifecycle from trigger to final delivery.
- **Why**: Capturing the current baseline prevents designing theoretical workflows that mismatch daily reality.

### Step 2: Conduct Socratic Grilling on Workflow Boundaries
- **Action**: Run a focused grilling round exploring:
  - **Trigger**: Event-based (e.g. webhooks, new issue) vs. time-scheduled (e.g. cron).
  - **Inputs & State**: Exactly what artifacts must be ingested.
  - **Actions**: Discrete operational or agentic transformations.
  - **Checkpoints**: Minimal review gates pushed to the end.
- **Inline Checklist**:
  - [ ] Triggers clearly specified with fallback polling intervals
  - [ ] Checkpoints provide decision-ready briefs
  - [ ] Failure paths and escalation owners defined

### Step 3: Author Executable Workflow Spec
- **Action**: Write the workflow contract to `workflows/<name>.md` detailing trigger, inputs, actions, checkpoint briefs, and outputs.
- **Key Point**: Ensure an implementer agent could implement scripts or automations from the document alone.
- **Why**: Ambiguity in workflow contracts causes brittle automation failures.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Ask the human to verify every intermediate step."* | **Push checkpoints right; batch human reviews.** | Frequent interruptions cause human fatigue and destroy automation efficiency. |
| *"Dump raw log files for the human checkpoint."* | **Produce synthesized, decision-ready briefs.** | Humans review clean executive summaries 10x faster than raw debug logs. |
| *"Assume an LLM agent is required for every workflow step."* | **Use deterministic scripts where possible; AI only where judgment is needed.** | Deterministic scripts are faster, cheaper, and more reliable than LLMs for structured operations. |

