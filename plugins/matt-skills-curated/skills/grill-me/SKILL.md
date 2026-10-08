---
name: grill-me
description: "Interview the user relentlessly to sharpen an idea, requirement, or decision before execution. Use when a plan, design, requirement, or decision needs a focused interview to expose ambiguity, missing constraints, trade-offs, or weak assumptions — even if the user just says \"grill me on this\". Do NOT use for repo-stateful domain modeling with doc generation."
---

# Grill Me

Conduct a focused, relentless Socratic interview to stress-test a plan, architectural decision, requirement, or nascent concept before writing code.

---

## Core Invariants

1. **Relentless Frontier Exploration**: Model the design space as a decision tree and exhaust the frontier before declaring alignment.
2. **One Question Round per Turn**: Batch questions into structured frontier rounds with recommended defaults; never interrogate with one-off dribble.
3. **Autonomous Fact Extraction**: Retrieve codebase, system, and file facts autonomously; never ask the user what the environment can reveal.
4. **Active Assumption Invalidation**: Proactively challenge comfortable assumptions, scale bottlenecks, edge-case failure modes, and hidden dependencies.
5. **No Premature Implementation**: Refuse to write production code or tickets until the interview frontier is completely empty and mutually agreed.

---

## Architecture & Map of Content (MOC)

```
[ Nascent Idea / Unsettled Decision ] ──► [ Autonomous Codebase Recon ] ──► [ Frontier Question Round ] ──► [ Socratic Refinement ] ──► [ Settled Alignment ]
```

| Component | Responsibility | Reference / Target |
|---|---|---|
| **Autonomous Recon** | Read repo context, ADRs, schemas | Primary source files |
| **Frontier Tree** | Map open decision nodes & prerequisites | `skills/grilling/SKILL.md` |
| **Question Round** | Formatted numbered prompts + defaults | User interaction loop |
| **Settled Alignment** | Clean, unambiguous problem/solution contract | Handoff to `to-spec` |

---

## Step-by-Step Procedure (TWI)

### Step 1: Autonomous Reconnaissance & Context Gathering
- **Action**: Inspect relevant codebase files, configurations, documentation, and existing architectural decisions before drafting questions.
- **Key Point**: Form a grounded mental model of existing constraints without asking the user for baseline facts.
- **Why**: Asking users for facts available in the repository wastes their cognitive bandwidth and damages credibility.

### Step 2: Formulate Frontier Question Rounds
- **Action**: Identify all open decisions whose prerequisites are settled and present them in a single batch with explicit recommendations.
- **Key Point**: Format each question as `❓ **Q[N]** - **[Title]**:` with options and `➡️ [Recommended Default]`.
- **Why**: Presenting strong recommendations lowers decision fatigue while forcing the user to actively affirm or override specific choices.
- **Inline Checklist**:
  - [ ] Every question targets a genuine decision rather than an environmental fact
  - [ ] Questions are independent and can be answered in parallel
  - [ ] Concrete recommendation provided for every question
  - [ ] No implementation code started

### Step 3: Iterate and Deepen the Decision Tree
- **Action**: Ingest user answers, collapse resolved nodes, uncover new downstream branches, and issue the next frontier round.
- **Key Point**: Probe edge cases: failure modes, security boundaries, migration paths, and non-happy paths.
- **Why**: Most architectural failures occur at boundaries that initial proposals casually gloss over.

### Step 4: Verify Alignment and Closure
- **Action**: Summarize the unified decision contract and ask for explicit user confirmation.
- **Key Point**: Confirm that the frontier is empty and zero unexamined assumptions remain.
- **Why**: Clear alignment prevents costly rewrites during implementation.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"The user's initial prompt looks clear enough, let's start coding."* | **Mandatory grilling on all non-trivial plans.** | Initial prompts almost always conceal edge-case ambiguities and conflicting constraints. |
| *"I'll ask questions one by one across multiple back-and-forth turns."* | **Batch the entire frontier into numbered rounds.** | Single-question ping-pong creates conversational fatigue and fragments context. |
| *"Ask the user which database schema or library version is used."* | **Discover environment facts autonomously.** | Agents must look up facts directly in code and configs rather than burdening the user. |
| *"Agree with the user's preferred approach without challenging trade-offs."* | **Stress-test every critical design decision.** | Sycophancy allows architectural bugs and scaling bottlenecks to slip into production. |

