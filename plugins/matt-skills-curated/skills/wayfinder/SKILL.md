---
name: wayfinder
description: "Map and navigate large, uncertain multi-session efforts through a shared graph of decision tickets. Use when facing complex greenfield projects or massive architectural migrations that exceed a single session — even if the user says \"map out this massive project\". Do NOT use for small, well-scoped features."
---

# Wayfinder

Chart, navigate, and incrementally resolve large, uncertain multi-session architectural efforts through an evolving graph of decision tickets and clear frontier discovery.

---

## Core Invariants

1. **Plan Over Do**: Wayfinder tickets resolve decisions, investigate unknowns, or validate prototypes—not raw execution slices.
2. **Single Canonical Map Issue**: Maintain a single root tracker issue labeled `wayfinder:map` as the low-resolution index linking all child decision tickets.
3. **One Decision Ticket Per Session**: A single agent session claims and resolves at most ONE decision ticket (excepting parallel research subagents).
4. **Frontier Claim Protocol**: A session must explicitly assign the decision ticket to itself before beginning work to prevent multi-agent collision.
5. **Fog-of-War Graduation**: Never pre-slice blurry, distant work into speculative tickets; keep them in `## Not yet specified` until the frontier reaches them.

---

## Architecture & Map of Content (MOC)

```
[ Massive Uncertain Initiative ]
                │
                ▼
┌───────────────────────────────────────┐
│ 1. Chart Destination & Map Issue      │ ──► Issue `wayfinder:map`
│    (Notes, Fog sketches, Boundaries)  │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ 2. Frontier Decision Tickets          │ ──► Child issues (`research`, `prototype`, `grilling`, `task`)
│    (Unblocked, unclaimed questions)   │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ 3. Atomic Session Resolution          │ ──► Post resolution comment, close issue,
│    (Claim 1 ticket, settle decision)  │     update `Decisions so far`, graduate fog
└───────────────────────────────────────┘
```

| Ticket Type | Execution Mode | Purpose |
|---|---|---|
| **Research** | AFK Subagent | Documentation, API discovery, external facts |
| **Prototype** | HITL Interactive | Throwaway exploratory code (`skills/prototype/SKILL.md`) |
| **Grilling** | HITL Interactive | Socratic decision distillation (`skills/grilling/SKILL.md`) |
| **Task** | AFK or HITL | Manual prerequisite unblocking (e.g. account setup, credential provisioning) |

---

## Step-by-Step Procedure (TWI)

### Step 1: Chart the Destination & Map Root
- **Action**: Grill the user breadth-first to define the destination (the ultimate spec, architecture, or migration target) and establish the `wayfinder:map` root issue.
- **Key Point**: If the route is already completely clear without fog, stop and route directly to `to-spec`.
- **Why**: Wayfinding overhead is warranted only when substantial unknown decisions lie between the starting point and destination.

### Step 2: Formulate Frontier Child Tickets & Wire Dependencies
- **Action**: Create sharp child issues for immediate unblocked decisions and wire native blocking relationships.
- **Key Point**: Keep un-sharp future ideas in the `## Not yet specified` section of the map.
- **Inline Checklist**:
  - [ ] Map created with clear Destination and Notes
  - [ ] Immediate decision questions ticketed and labeled
  - [ ] Blocking dependencies wired in tracker
  - [ ] Research tickets dispatched to background subagents

### Step 3: Claim and Resolve a Single Frontier Ticket
- **Action**: Assign the chosen frontier ticket to self, execute the investigation/grilling, and produce the decision verdict.
- **Key Point**: Post the decision as a resolution comment on the issue and close it.
- **Why**: Immediate closure and commentary keep the frontier clean and transparent for concurrent team members.

### Step 4: Update Map Index & Graduate Fog
- **Action**: Add a one-line summary to `## Decisions so far` on the map issue and graduate freshly specifiable items from `## Not yet specified` into new tickets.
- **Key Point**: If a path is determined to be outside the destination scope, move it to `## Out of scope` and close any associated tickets.
- **Why**: Incremental fog clearing keeps the map accurate without speculative bloat.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"I'll resolve 4 tickets in this single session."* | **Enforce 1 decision ticket per session.** | Multi-ticket batching causes context exhaustion and sloppy decision records. |
| *"Pre-create 20 tickets for all future phases."* | **Keep blurry work in 'Not yet specified'.** | Pre-slicing the fog creates brittle tickets that get invalidated by early decisions. |
| *"Start building the final feature code during wayfinding."* | **Wayfinder produces decisions, not deliverables.** | Premature implementation while architecture is foggy leads to massive rewrites. |

