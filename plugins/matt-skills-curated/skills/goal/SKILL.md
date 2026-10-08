---
name: goal
description: "Design and synthesize high-leverage autonomous goal prompts and contracts for unattended execution. Use when crafting a /goal prompt, planning an overnight autonomous coding run, converting rambling specifications into a self-contained agentic mission, or setting up multi-agent autonomous loops — even if they don't explicitly say \"goal prompt\". Do NOT use when the user asks for immediate single-turn execution in the current conversation without an autonomous goal contract."
---

# Autonomous Goal & Contract Synthesis

Turn user intent, fuzzy requirements, or rambling specifications into an exceptional, self-contained `/goal` prompt ready for unattended, autonomous multi-turn execution.

## Core Principle

> **An autonomous goal prompt specifies the destination, quality bar, and verification loops — never micromanaged step-by-step scripts.**

---

## Core Invariants

1. **Observable Done Condition**: Every deliverable must possess a concrete completion state the autonomous session can verify itself (e.g., test suite passes, CLI runs on fixtures, build outputs exist).
2. **Upfront Authority & Creative Freedom**: Grant explicit permission to make design decisions, choose internal workflows, and resolve ambiguities without interrupting the user.
3. **Verified Resource Inventory**: Name only 2–4 tools or paths that were verified against the live environment. Pair with an explicit discovery mandate.
4. **Mandatory Multi-Pass Verification**: Mandate at least 3 distinct iteration passes matched to the target medium.
5. **Terminal Goal Line**: End with a single recency-anchored sentence containing the deliverable and autonomy directive (`"... is your /goal. Work completely autonomously and do not ask me for anything until you are all done."`).

---

## The Seven-Part Goal Prompt Anatomy

```
┌──────────────────────────────────────────────────────────┐
│ 1. Core Desire & High-Stakes Context                     │
│ 2. Uncompromising Quality Bar & Principles               │
│ 3. Verified Resource Inventory & Discovery Mandate       │
│ 4. Explicit Decision Authority & Creative Freedom        │
│ 5. Medium-Matched Multi-Pass Verification Loop           │
│ 6. Concrete Delivery Destination                         │
│ 7. Terminal Goal Line & Autonomy Directive               │
└──────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Procedure (TWI)

### Step 1: Extract Intent & Fill Gaps
- **Action**: Extract deliverable, scope, real stakes, mentioned tools, quality standards, and target destination.
- **Key Point**: Synthesize sensible defaults for minor gaps. If an ambiguity is critical, resolve it upfront.
- **Why**: Multi-round back-and-forth defeats the speed advantage of autonomous delegation.

### Step 2: Verify Resources & Compose Anatomy
- **Action**: Verify paths and tools before naming them, then weave the 7 components into natural flowing prose (150–350 words).
- **Key Point**: State the outcome and constraints clearly while explicitly granting the agent freedom to navigate internal implementation steps.
- **Inline Checklist**:
  - [ ] Word count is within 150–350 words
  - [ ] Named resources verified against live repository
  - [ ] Creative freedom & decision authority explicitly granted
  - [ ] Medium-specific verification passes defined (3 iterations)
  - [ ] Destination explicit (link, directory path, file artifact)
  - [ ] Concludes with terminal goal line and autonomy directive

### Step 3: Mechanical Validation & Delivery
- **Action**: Verify the drafted prompt against the seven invariants and output in a clean code block.
- **Key Point**: Deliver the prompt ready to copy-paste with zero clutter.
- **Why**: Clean delivery prevents formatting and syntax mistakes during execution.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"I listed step-by-step instructions so the agent won't get lost."* | **Specify destination, not micromanaged steps.** | Micromanagement prevents the agent from adapting to unforeseen obstacles. |
| *"I named several tools from memory without checking if they exist."* | **Verify all resources before naming.** | Unverified resources cause agents to burn turns searching for phantom paths. |
| *"The task is subjective, so verification passes aren't needed."* | **Every deliverable requires verification criteria.** | Unverified tasks lead to premature completion and unspotted defects. |
| *"I added notes and explanations after the goal line."* | **Terminal goal line must be the final sentence.** | Recency bias ensures the terminal directive anchors the model's primary objective. |
