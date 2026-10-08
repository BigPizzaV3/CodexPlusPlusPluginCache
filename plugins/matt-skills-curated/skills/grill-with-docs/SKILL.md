---
name: grill-with-docs
description: "Interview the user to stress-test a design while simultaneously recording domain terms and architectural decisions in project documentation. Use when planning features in a codebase and wanting domain terms captured in CONTEXT.md and ADRs — even if the user says \"grill this feature\". Do NOT use when no codebase context or documentation trail is needed."
---

# Grill with Docs

Conduct a structured Socratic design interview that concurrently distills and commits domain terminology into `CONTEXT.md` and hard-to-reverse architectural decisions into Architectural Decision Records (`docs/adr/*.md`).

---

## Core Invariants

1. **Simultaneous Documentation Distillation**: Extract and record ubiquitous domain language into `CONTEXT.md` and architectural choices into ADRs in real time as decisions settle.
2. **Batch Frontier Questioning**: Present independent frontier questions in structured batches with explicit defaults rather than one-off queries.
3. **Autonomous Fact Reconnaissance**: Research existing codebase architecture, types, and schemas autonomously before posing design questions.
4. **Lightweight ADR Trigger**: When a design choice creates significant technical debt or is difficult to reverse (e.g. database choice, sync strategy), write a dedicated ADR immediately.
5. **Zero Speculative Prose**: Document only decisions that have actively settled during the interview; keep draft notes clearly demarcated.

---

## Architecture & Map of Content (MOC)

```
[ User Feature Idea ] ──► [ Codebase Recon & ADR Review ] ──► [ Socratic Grilling Rounds ]
                                                                       │
                                      ┌────────────────────────────────┴────────────────────────────────┐
                                      ▼                                                                 ▼
                            [ Update CONTEXT.md ]                                              [ Author ADR Docs ]
                            - Ubiquitous language                                              - Context & Decision
                            - Entity definitions                                               - Consequences & Tradeoffs
```

| Artifact | Purpose | Reference Format |
|---|---|---|
| **Domain Dictionary** | Capture ubiquitous language and entity relationships | `skills/domain-modeling/CONTEXT-FORMAT.md` |
| **Architectural Record** | Record irreversible architectural choices | `skills/domain-modeling/ADR-FORMAT.md` |
| **Grilling Protocol** | Drive structured frontier question rounds | `skills/grilling/SKILL.md` |

---

## Step-by-Step Procedure (TWI)

### Step 1: Discover Existing Documentation Baseline
- **Action**: Check for existing `CONTEXT.md`, `GLOSSARY.md`, and `docs/adr/` records in the repository.
- **Key Point**: Adopt existing project conventions for domain modeling and decision logging.
- **Why**: Maintaining architectural consistency prevents duplicate terminology and fragmented records.

### Step 2: Conduct Socratic Grilling Rounds
- **Action**: Identify unsettled requirements and formulate numbered question rounds with recommended defaults.
- **Key Point**: Ask about boundaries, invariants, entity lifecycles, and failure recovery.
- **Inline Checklist**:
  - [ ] Terminology vetted against existing domain dictionary
  - [ ] Questions formatted with clear recommendations
  - [ ] Architecture tradeoffs highlighted

### Step 3: Distill and Update Domain Glossary
- **Action**: As terms and entities are clarified, update or create `CONTEXT.md` using the standard format.
- **Key Point**: Ensure terms are strictly defined with unambiguous scope.
- **Why**: Shared ubiquitous language prevents misalignment between engineers and agents.

### Step 4: Author Architectural Decision Records (ADRs)
- **Action**: For significant architectural choices, author a new numbered ADR in `docs/adr/NNNN-<slug>.md`.
- **Key Point**: Include Context, Decision, Status, and Consequences (both positive and negative).
- **Why**: ADRs preserve institutional memory and prevent rehashing past debates.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"I'll write the documentation after the entire interview finishes."* | **Capture terms and ADRs as decisions settle.** | Post-hoc documentation often drops subtle nuances, tradeoffs, and rationale. |
| *"This architectural choice is minor, no ADR needed."* | **If it is hard to reverse, author an ADR.** | Seemingly minor choices often cascade into major technical debt. |
| *"I will ask the user to explain the existing domain model."* | **Read existing docs and schemas autonomously.** | Agents must build initial context from repo artifacts before engaging the user. |

