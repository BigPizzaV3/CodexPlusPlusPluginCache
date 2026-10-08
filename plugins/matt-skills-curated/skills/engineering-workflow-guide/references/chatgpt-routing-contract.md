# ChatGPT & Codex Skill Routing Contract

This document specifies the authoritative runtime protocol for ChatGPT and Codex when consuming, executing, and transitioning between skills in the `matt-skills-curated` plugin pack.

---

## 1. The ChatGPT Consumption Protocol

When a user interacts with ChatGPT / Codex, follow this strict 4-step execution lifecycle:

```
[ User Request ] ──► [ Step 1: Route & Select Primary Skill ]
                                  │
                                  ▼
                     [ Step 2: Ingest SKILL.md Core Invariants ]
                                  │
                                  ▼
                     [ Step 3: Execute Phase Procedures (TWI) ]
                                  │
                                  ▼
                     [ Step 4: Phase Handshake & Next Route ]
```

### Step 1: Route & Select Exactly One Primary Skill
- **Action**: Match the user's intent against `references/catalog.md` and `references/routing-matrix.md`.
- **Constraint**: Designate **ONE primary specialist skill** for the current turn.
- **Rule**: Do NOT invoke multiple skills simultaneously for a single phase.

### Step 2: Ingest `SKILL.md` and Core Invariants
- **Action**: Read the target skill's `SKILL.md` completely.
- **Constraint**: Immediately internalize the **Core Invariants** and **Anti-Rationalization Guardrails**.
- **Rule**: Never skip to code execution without verifying pre-flight prerequisites and public seams.

### Step 3: Execute Step-by-Step Procedures (TWI)
- **Action**: Follow the Training Within Industry (TWI) steps: **Action**, **Key Point**, and **Why**.
- **Constraint**: Obey inline risk checklists (`- [ ]`) at every seam.
- **Rule**: Present clean, human-facing deliverables without dumping internal thought fragments.

### Step 4: Phase Handshake & Next Route
- **Action**: Conclude each phase with a checkable completion bound and announce the subsequent phase in the lifecycle pipeline.
- **Example**: After finishing `grill-with-docs`, announce transition to `to-spec`.

---

## 2. Standard Multi-Phase Lifecycles

| Scenario | Canonical Multi-Phase Pipeline | Phase Transition Trigger |
|---|---|---|
| **Greenfield Feature** | `grill-with-docs` ➔ `to-spec` ➔ `to-tickets` ➔ `implement` ➔ `code-review` | User approves spec & ticket graph |
| **Bug / Regression** | `diagnosing-bugs` ➔ `tdd` ➔ `code-review` | Red failure reproduced & minimal repro isolated |
| **Wide Refactoring** | `improve-codebase-architecture` ➔ `setup-ts-deep-modules` ➔ `code-review` | Visual architecture report approved |
| **AI / ML Initiative** | `ai-engineering` ➔ `ml-best-practices` ➔ `code-review` | Naive baseline beaten & 95% CIs verified |
| **Massive Initiative** | `wayfinder` ➔ `to-spec` ➔ `to-tickets` ➔ `implement-spec` | Fog cleared & frontier tickets claimed |
| **Long-Form Essay** | `writing-fragments` ➔ `writing-shape` ➔ `writing-beats` | Raw pile assembled & candidate openings chosen |

---

## 3. ChatGPT Anti-Hallucination Guardrails

1. **No Phantom Skills**: ChatGPT must NEVER invent skill names not present in `references/catalog.md`.
2. **No Unasked Scope Drift**: Implement strictly what the approved specification mandates.
3. **No Blind Approvals**: If a requirement is missing or contradictory, halt and clarify with `grill-me` or `to-questionnaire`.
4. **Zero Leaked Secrets**: Never echo private API keys, tokens, or environment passwords.
