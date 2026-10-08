---
name: domain-modeling
description: "Build and sharpen a project's domain model, ubiquitous language, and architectural decision records. Use when establishing codebase terminology, challenging fuzzy concepts, writing ADRs, or updating CONTEXT.md — even if the user says \"define our terms\". Do NOT use for general code refactoring without domain shifts."
---

# Domain Modeling

Actively establish, sharpen, and enforce ubiquitous domain language (`CONTEXT.md`) and architectural decision records (`docs/adr/*.md`) to prevent semantic drift across agents and engineering teams.

---

## Core Invariants

1. **Active Semantic Enforcement**: Proactively challenge overloaded, ambiguous, or colloquial terms and align them with canonical definitions in real time.
2. **Immediate Inline Glossary Updates**: Capture domain terms into `CONTEXT.md` the instant they crystallize; never batch glossary edits to the end of a session.
3. **Strict Implementation-Free Glossary**: `CONTEXT.md` must contain zero implementation details, frameworks, or database choices—it is a pure domain dictionary.
4. **Selective ADR Threshold**: Only author an ADR when a decision meets all 3 criteria: (1) Hard to reverse, (2) Surprising without context, (3) The result of a real trade-off.
5. **Codebase-Glossary Alignment**: Cross-reference terminology with live codebase entities and flag discrepancies immediately.

---

## Architecture & Map of Content (MOC)

```
[ Domain Discussions / User Prompts ] ──► [ Semantic Challenge & Disambiguation ] ──► [ Inline CONTEXT.md Update ]
                                                                 │
                                ┌────────────────────────────────┴────────────────────────────────┐
                                ▼                                                                 ▼
                     [ Domain Dictionary ]                                              [ Architectural Records ]
                     - Single-context: `CONTEXT.md`                                     - `docs/adr/NNNN-<slug>.md`
                     - Multi-context: `CONTEXT-MAP.md`                                  - Context, Decision, Consequences
```

| Artifact | Responsibility | Format Reference |
|---|---|---|
| **Domain Glossary** | Canonical terms, entity boundaries, invariants | `skills/domain-modeling/CONTEXT-FORMAT.md` |
| **Architectural Record** | Irreversible architectural choices & trade-offs | `skills/domain-modeling/ADR-FORMAT.md` |
| **Context Map** | Bounded contexts across modular repositories | `CONTEXT-MAP.md` |

---

## Step-by-Step Procedure (TWI)

### Step 1: Detect Context Architecture & Glossary Baseline
- **Action**: Check if a root `CONTEXT-MAP.md` exists (multi-context) or single `CONTEXT.md` / `docs/adr/`.
- **Key Point**: Create glossary files lazily on the first resolved term.
- **Why**: Multi-context systems require partitioning domain terms by bounded context to prevent collision.

### Step 2: Challenge Fuzzy & Overloaded Language
- **Action**: Intercept vague nouns (e.g. "account", "item", "process") and propose distinct canonical domain entities.
- **Key Point**: Stress-test boundaries with concrete edge-case scenarios (e.g., "What happens during partial cancellation?").
- **Why**: Ambiguous nouns lead to bloated database entities and tangled business logic.

### Step 3: Verify Alignment Against Existing Codebase
- **Action**: Search the codebase for entity names and check whether existing schemas agree with the user's description.
- **Key Point**: Highlight discrepancies immediately: "The code cancels entire Orders, but you described partial cancellation. Which is correct?"
- **Inline Checklist**:
  - [ ] Term verified against live database/code entities
  - [ ] Definition added to `CONTEXT.md` using standard format
  - [ ] Implementation details omitted from glossary

### Step 4: Author Architectural Decision Records (ADRs)
- **Action**: For decisions meeting the 3-point threshold, create `docs/adr/NNNN-<slug>.md`.
- **Key Point**: Document Context, Decision, Status, and Consequences.
- **Why**: Transparent ADRs prevent repetitive debates and document technical debt trade-offs.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"I'll add database table schemas into CONTEXT.md."* | **Forbidden. CONTEXT.md contains pure domain terms only.** | Coupling the domain glossary to DB schemas makes it obsolete upon migration. |
| *"Let's write an ADR for every small choice (e.g. library helper)."* | **Enforce the 3-point ADR threshold.** | Low-value ADRs clutter documentation and obscure truly critical architectural choices. |
| *"The user used 'User' and 'Customer' interchangeably; I'll ignore it."* | **Challenge and disambiguate overloaded terms immediately.** | Conflating distinct domain concepts creates severe authorization and modeling bugs. |

