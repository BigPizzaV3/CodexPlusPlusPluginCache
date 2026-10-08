---
name: engineering-workflow-guide
description: "Route engineering, AI/ML, cognitive, or productivity tasks to the narrowest effective specialist skill. Use when a task spans planning, implementation, debugging, review, architecture, research, setup, AI modeling, data remediation, or autonomous goals, when the user asks what to do next, or when unsure which workflow fits — even if they don't explicitly name a skill. Do NOT use when the specific specialist skill is already obvious and unambiguous."
---

# Engineering Workflow Guide

Centrally analyze tasks, classify developer intent, and route engineering workflows to the narrowest, highest-leverage specialist skill across the curated skill catalog.

---

## Core Invariants

1. **Narrowest Effective Skill**: Select the most specific skill that fully covers the task; avoid invoking broad, ceremonial meta-skills when a focused tool exists.
2. **One Primary Skill per Phase**: Designate exactly one primary specialist skill for the current turn; chain secondary skills only across distinct lifecycle gates (e.g. Planning $\rightarrow$ Implementation $\rightarrow$ Review).
3. **No Unpackaged Ghost Skills**: Every routed skill must exist verbatim in `references/catalog.md` and have an established `SKILL.md`.
4. **Fast-Path User Overrides**: If the user explicitly requests a valid skill by name, honor it immediately without redundant routing deliberation.
5. **Setup Pre-Requisite Check**: If repository issue tracking, triage labels, or domain docs are unconfigured, run `setup-engineering-workflows` prior to planning or triage.

---

## Architecture & Map of Content (MOC)

```
[ Developer Intent / Request ]
                │
                ▼
┌────────────────────────────────────────────────────────┐
│ 1. Intent Classification & Catalog Lookup               │
│    (Match job against `references/catalog.md`)          │
└──────────────────────────┬─────────────────────────────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    ▼                      ▼                      ▼
[ Discovery & Plan ]   [ Code & Architecture ]   [ AI, ML & Automation ]
- `grill-with-docs`    - `implement`             - `ai-engineering`
- `to-spec`            - `code-review`           - `ai-data-remediation`
- `to-tickets`         - `diagnosing-bugs`       - `ml-best-practices`
- `wayfinder`          - `domain-modeling`       - `j-space`
- `prototype`          - `setup-ts-deep-modules` - `goal`
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Lifecycle Route Execution                           │
│    (State route briefly, invoke primary skill)         │
└────────────────────────────────────────────────────────┘
```

| Router Reference | Responsibility | File Location |
|---|---|---|
| **Skill Catalog** | Exhaustive index of all 42 packaged skills | [references/catalog.md](references/catalog.md) |
| **ChatGPT Routing Contract** | Runtime consumption & anti-hallucination protocol | [references/chatgpt-routing-contract.md](references/chatgpt-routing-contract.md) |
| **Routing Matrix** | 100+ intent patterns, triggers, and exclusions | [references/routing-matrix.md](references/routing-matrix.md) |
| **Phase Boundaries** | Decision tree for `/clear`, `/compact`, `/handoff`, and subagents | [PHASE-BOUNDARIES.md](PHASE-BOUNDARIES.md) |

| Lifecycle Scenario | Canonical Route Pipeline |
|---|---|
| **Fuzzy Greenfield Feature** | `grill-with-docs` $\rightarrow$ `to-spec` $\rightarrow$ `to-tickets` $\rightarrow$ `implement` |
| **Hard Bug or Regression** | `diagnosing-bugs` $\rightarrow$ `tdd` |
| **Pull Request Review** | `code-review` (Two-axis: Standards & Spec) |
| **Deep Module Restructuring** | `improve-codebase-architecture` $\rightarrow$ `setup-ts-deep-modules` |
| **Large Multi-Session Map** | `wayfinder` $\rightarrow$ `to-spec` $\rightarrow$ `to-tickets` |
| **Deep Multi-Step Reasoning** | `j-space` (Cognitive registers & seam audits) |
| **Autonomous Unattended Goal** | `goal` (7-part prompt contract) |
| **Production ML / LLM System** | `ai-engineering` $\rightarrow$ `ml-best-practices` |
| **Self-Healing Data Pipeline** | `ai-data-remediation` |
| **Long-Form Writing & Essays** | `writing-fragments` $\rightarrow$ `writing-shape` / `writing-beats` |

---

## Step-by-Step Procedure (TWI)

### Step 1: Ingest Request and Consult Catalog
- **Action**: Read `references/catalog.md` and classify the user's underlying intent, not just raw keywords.
- **Key Point**: Check whether repository setup is complete (`docs/agents/issue-tracker.md`).
- **Why**: Accurate intent classification ensures the agent doesn't jump into code when requirements are undefined.

### Step 2: Formulate the Narrowest Route
- **Action**: Select the single primary specialist skill and state the multi-phase roadmap in 1–2 lines.
- **Inline Checklist**:
  - [ ] Target skill verified in `references/catalog.md`
  - [ ] Zero overlapping meta-skills invoked
  - [ ] Distinct lifecycle phases separated cleanly

### Step 3: Execute Primary Phase
- **Action**: Invoke the selected skill instructions and proceed directly to execution.
- **Why**: Direct transition eliminates conversational overhead.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Invoke 4 skills at once for a single simple change."* | **Enforce 1 primary skill per lifecycle phase.** | Overlapping skill prompts create conflicting instructions and waste context budget. |
| *"Invent a new custom workflow name not in catalog."* | **Route exclusively to packaged skills in `catalog.md`.** | Routing to non-existent skills causes execution failures. |
| *"Overrule the user's explicit skill invocation."* | **Honor user-requested skill unless hard conflict exists.** | Respect developer intent and operational autonomy. |

