---
name: to-questionnaire
description: "Transform unknown requirements and stakeholder dependencies into a structured questionnaire. Use when a plan or spec is blocked by external stakeholder decisions, business rules, or missing domain facts — even if the user says \"what should I ask them?\". Do NOT use when the user can answer the questions themselves."
---

# To Questionnaire

Transform unresolved stakeholder dependencies, business rule unknowns, and external domain ambiguities into a high-yield, structured questionnaire that minimizes async friction.

---

## Core Invariants

1. **Grill the Send, Not the Subject**: Interview the user exclusively about the recipient's role, expertise, and required decisions—never interrogate the user on answers only the recipient holds.
2. **Gap-Targeted Formulations**: Every question must laser-target the precise boundary between what the user knows and what the stakeholder decides.
3. **Importance-First Ordering**: Sequence questions in descending order of critical architectural impact to extract maximum value from partial responses.
4. **Single-Idea Atomic Questions**: Never combine multiple compound questions into a single item; each question must possess its own context and answer stub.
5. **No Speculative Answering**: Do not guess or fabricate stakeholder business rules; format clear prompts with rationales (`Why this matters:`) to elicit clean answers.

---

## Architecture & Map of Content (MOC)

```
[ External Unknowns / Blockers ] ──► [ Interview User on Recipient & Needs ] ──► [ Draft Gap-Targeted Questionnaire ] ──► [ Output Markdown Doc ]
```

| Component | Responsibility | Output Target |
|---|---|---|
| **Recipient Profile** | Role, expertise, and decision scope | Document header |
| **Context Summary** | 1-paragraph orientation for the recipient | `## Context` section |
| **Thematic Questions** | Atomic questions with answer stubs & rationale | `to-questionnaire-<slug>.md` |

---

## Step-by-Step Procedure (TWI)

### Step 1: Clarify Recipient Persona and Required Decisions
- **Action**: Ask the user in a single exchange: (1) Who is the recipient (role, technical depth)? (2) Exactly what decisions or facts must be unlocked?
- **Key Point**: Keep the focus strictly on defining the gap, not guessing the answer.
- **Why**: Calibrating the recipient's perspective ensures the document uses appropriate tone and technical depth.

### Step 2: Structure Thematic Question Blocks
- **Action**: Group questions under clear theme headings (`## <Theme>`) and sort questions within each theme by descending priority.
- **Key Point**: For every question, include an explicit `_Why this matters:_` line explaining how their answer influences the system design.
- **Inline Checklist**:
  - [ ] Questions ordered most-important-first
  - [ ] No compound/nested sub-questions
  - [ ] Clear answer quote blocks (`> `) provided under each item
  - [ ] Explicit deadline and partial-answer instructions included

### Step 3: Write and Deliver Questionnaire Document
- **Action**: Write the complete Markdown document to `to-questionnaire-<slug>.md` in the current directory.
- **Key Point**: Conclude with a catch-all `## Anything Else?` section to capture unknown unknowns.
- **Why**: Stakeholders frequently possess contextual constraints that standard questions overlook.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"I'll ask the user to guess what the stakeholder would prefer."* | **Forbidden. Target the questionnaire at the gap.** | Guessing stakeholder preferences introduces false assumptions into production architectures. |
| *"Combine 3 related questions into a single multi-part paragraph."* | **Enforce single-idea atomic questions.** | Multi-part questions overwhelm busy stakeholders, leading to skipped answers. |
| *"Omit the 'Why this matters' clause to keep questions brief."* | **Include context on why the answer matters.** | Stakeholders give better, actionable answers when they understand the engineering impact. |

