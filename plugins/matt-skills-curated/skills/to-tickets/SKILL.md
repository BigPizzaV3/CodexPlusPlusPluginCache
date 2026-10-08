---
name: to-tickets
description: "Decompose an approved specification or plan into ordered, dependency-linked tracer-bullet implementation tickets. Use when turning a spec or architectural plan into actionable tracker issues with clear acceptance criteria — even if the user says \"break this into tickets\". Do NOT use for initial requirements gathering."
---

# To Tickets

Decompose an approved specification, plan, or design document into vertically sliced, dependency-ordered tracer-bullet implementation tickets with explicit acceptance criteria.

---

## Core Invariants

1. **Strict Vertical Tracer Slicing**: Every standard ticket must cut vertically across all necessary layers (schema, domain logic, API, UI, test) rather than horizontal slices of a single layer.
2. **Explicit Dependency DAG**: Every ticket must explicitly declare its blocking prerequisites (`Blocked by:`) to form an unambiguous directed acyclic graph.
3. **Single Context-Window Sizing**: Each ticket must be sized to complete within a single agent context window without exhausting token or tool limits.
4. **Expand-Contract for Wide Refactors**: Wide architectural refactors with broad blast radius must follow the Expand-Contract pattern rather than being forced into fragile single-step vertical slices.
5. **No Parent Mutation**: Never close, resolve, or corrupt parent tracker issues when authoring and publishing child tickets.

---

## Architecture & Map of Content (MOC)

```
[ Approved Spec / Plan ] ──► [ DAG Dependency Decomposition ] ──► [ User Granularity Review ] ──► [ Atomic Tracker Publication ]
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               ▼                                                         ▼
    [ Vertical Tracer Bullets ]                               [ Expand-Contract Migrations ]
    - Narrow cross-layer path                                 - Expand (add new form beside old)
    - Independently verifiable                                - Migrate in localized batches
    - Fit in 1 context window                                 - Contract (delete old form)
```

| Component | Responsibility | Output Target |
|---|---|---|
| **Local Ticket Store** | Atomic Markdown ticket files | `.scratch/<feature-slug>/issues/NN-<slug>.md` |
| **Tracker Issues** | Remote issue creation with blocking metadata | GitHub, Linear, GitLab issues |
| **Prefactoring Gate** | Make the change easy before making the easy change | Dedicated blocker ticket #01 |

---

## Step-by-Step Procedure (TWI)

### Step 1: Context Ingestion & Prefactoring Identification
- **Action**: Ingest the approved spec and inspect the target codebase area to identify necessary prefactoring.
- **Key Point**: If the existing code makes the target change difficult, create a dedicated preparatory refactor ticket as the first blocker.
- **Why**: "Make the change easy, then make the easy change" prevents intertwining architectural cleanup with functional feature additions.

### Step 2: Slice Vertical Tracer Bullets & Formulate DAG
- **Action**: Break the feature into vertical tracer slices and link dependencies:
  - For standard features: Vertical slices cutting through schema, API, UI, and tests.
  - For wide refactors: Sequence as Expand $\rightarrow$ Batch Migration $\rightarrow$ Contract.
- **Key Point**: Assign each ticket an unambiguous "Blocked by" list. Tickets with no blockers are ready for immediate execution.
- **Inline Checklist**:
  - [ ] Every vertical slice delivers an independently verifiable behavior
  - [ ] Wide refactors partitioned via expand-contract
  - [ ] Tickets strictly fit in a single fresh context window
  - [ ] Acceptance criteria are binary and testable

### Step 3: Present Breakdown & Quiz User for Approval
- **Action**: Present the proposed tickets with titles, blockers, and deliverables to the user.
- **Key Point**: Prompt the user to verify granularity, dependencies, and ordering.
- **Why**: Quick human validation ensures ticket sizing matches team velocity and avoids execution roadblocks.

### Step 4: Publish to Tracker
- **Action**: Publish approved tickets in topological order (blockers first) to the configured issue tracker or `.scratch/<feature-slug>/issues/NN-<slug>.md`.
- **Key Point**: Apply the `ready-for-agent` triage label to all unblocked tickets.
- **Why**: Topological creation ensures downstream tickets can cleanly reference live upstream ticket IDs.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"I'll create horizontal tickets: 1 for DB, 1 for backend, 1 for UI."* | **Forbidden. Enforce vertical tracer slices.** | Horizontal layers cannot be verified end-to-end and leave systems broken across commits. |
| *"This ticket is huge, but one agent can manage it."* | **Split tickets exceeding 1 context window.** | Oversized tickets cause context exhaustion, lost requirements, and hallucinations. |
| *"Combine the preparatory refactor with the new feature logic."* | **Separate prefactoring into a distinct ticket.** | Mixing refactoring with feature delivery obscures regressions in code review. |
| *"Skip writing acceptance criteria since the spec has them."* | **Mandatory atomic acceptance checklist per ticket.** | Implementer agents require self-contained verification criteria without re-reading the spec. |

