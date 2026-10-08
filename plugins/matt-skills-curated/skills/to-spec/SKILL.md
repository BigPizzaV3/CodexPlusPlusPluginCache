---
name: to-spec
description: "Synthesize conversation and codebase context into an unambiguous, buildable technical specification. Use when requirements and design decisions are settled and need to be formalized into a technical spec — even if the user says \"write a spec for this\". Do NOT use when the core idea is still fuzzy and ungrilled."
---

# To Spec

Synthesize settled conversation context and codebase understanding into an unambiguous, buildable technical specification with minimal test seams and complete user stories.

---

## Core Invariants

1. **Pure Synthesis, Zero Interrogation**: Synthesize strictly from established context and codebase facts; do not interview the user.
2. **Minimal Seams at the Highest Tier**: Prefer existing high-level test seams; never introduce unnecessary internal mocking seams.
3. **Exhaustive User Stories**: Generate a comprehensive, numbered list of `As an <actor>, I want <feature>, so that <benefit>` stories covering all user paths.
4. **Decisions Over Concrete Snippets**: Specify architectural decisions, interfaces, and schema changes without fragile, hardcoded code snippets (unless derived from a validated prototype).
5. **Strict Out-of-Scope Demarcation**: Explicitly list out-of-scope capabilities to prevent scope creep and unbound work.

---

## Architecture & Map of Content (MOC)

```
[ Settled Context & ADRs ] ──► [ Codebase Seam Inspection ] ──► [ Spec Document Synthesis ] ──► [ Tracker Publication ]
```

| Component | Responsibility | Format / Template |
|---|---|---|
| **Problem & Solution** | Frame user-centric intent | Problem / Solution statements |
| **User Stories** | Enumerate all functional paths | Numbered standard user stories |
| **Implementation Decisions** | Define module boundaries & contracts | Architecture & schema decisions |
| **Testing Decisions** | Specify external verification seams | Behavior-driven test strategy |

---

## Step-by-Step Procedure (TWI)

### Step 1: Autonomous Codebase & Seam Inspection
- **Action**: Explore the repository to inspect existing modules, domain glossary terms, and ADRs.
- **Key Point**: Identify the highest available integration seam to test the feature externally.
- **Why**: Testing through high-level seams verifies true system behavior while leaving internal implementation details free to refactor.

### Step 2: Formulate Comprehensive User Stories
- **Action**: Draft an exhaustive, numbered list of user stories capturing all primary and edge-case user interactions.
- **Key Point**: Follow the strict template: `1. As an <actor>, I want a <feature>, so that <benefit>`.
- **Why**: Detailed user stories prevent implementers from making ad-hoc product assumptions during coding.
- **Inline Checklist**:
  - [ ] Every user story has an explicit actor and tangible benefit
  - [ ] Edge cases and failure states are covered as distinct stories
  - [ ] No implementation jargon inside user story statements

### Step 3: Formalize Implementation and Testing Decisions
- **Action**: Document module boundaries, modified interfaces, database schema changes, and API contracts.
- **Key Point**: Omit volatile file line numbers or speculative code snippets.
- **Why**: Fragile code snippets go stale immediately and misdirect downstream implementation agents.

### Step 4: Define Out-of-Scope Boundaries & Publish
- **Action**: Detail what is explicitly NOT included, apply the `ready-for-agent` triage label, and publish to the configured issue tracker or `.scratch/<feature-slug>/spec.md`.
- **Key Point**: If the issue tracker is unconfigured, instruct the user to run `/setup-engineering-workflows`.
- **Why**: Clear negative boundaries prevent scope bloat and keep subsequent ticket decomposition bounded.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"I'll ask the user a few more questions before writing the spec."* | **No interviewing during to-spec.** | If requirements are still fuzzy, route back to `grill-me`. `to-spec` is pure synthesis. |
| *"I will write extensive mock-heavy unit test decisions."* | **Test at the highest possible public seam.** | Mock-heavy tests break during refactors and fail to verify actual end-to-end functionality. |
| *"Include complete implementation code blocks in the spec."* | **Specify interfaces and decisions, not full code.** | Implementation code in specs blinds the developer agent to live codebase nuances. |
| *"Skip the out-of-scope section since it seems obvious."* | **Mandatory explicit Out-of-Scope section.** | Ambiguity in scope boundaries causes runaway scope creep during implementation. |

