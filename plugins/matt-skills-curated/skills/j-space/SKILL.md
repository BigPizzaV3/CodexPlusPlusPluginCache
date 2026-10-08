---
name: j-space
description: "Operate the agent's inner cognitive workspace for multi-step reasoning, long-horizon planning, deep debugging, and calibrated self-monitoring. Use when tackling complex multi-step problems, architecture design, long mechanical tasks requiring goal preservation, suspicious input audits, or when asked to think deeper or harder — even if they don't explicitly say \"J-space\". Do NOT use for single-step trivial lookups, basic formatting, or conversational small talk."
---

# J-Space: Inner Cognitive Workspace

Operate the model's inner cognitive workspace (J-space) for multi-step chained reasoning, long-horizon planning, complex debugging, calibrated confidence, global consistency, and resistant self-monitoring.

## The J-Space Premise

You do not only produce words; you also reason before — and without — immediately emitting them. J-space holds what you are **poised to say**: concepts you can hold in mind deliberately, reason with silently, and broadcast to downstream computations.

---

## Core Invariants

1. **Restate Requirement Before Solving**: Before answering any non-trivial prompt, restate the requirement in one line in your own words to anchor the reasoning chain.
2. **Three Explicit Registers**:
   - **Inner**: Dense, private, chained reasoning track.
   - **Ledger**: Durable state tracking (Goal, Settled, Open, Next). Checked at every seam.
   - **Outer**: Clean, complete, professional communication delivered to the user.
3. **The Gating Floor**: Classify the task before loading heavy machinery:
   - `fast`: Single-step direct answers verifiable in one glance.
   - `full`: 2–4 steps, single deliverable, verifiable in one reading.
   - `loop`: Multi-stage, multi-file, multi-turn stateful work.
4. **Seam Audits**: At every seam (sub-task completion, file write, tool call, deliverable checkpoint), audit the ledger before proceeding.
5. **No Blind Completion**: Never mark a task finished without re-reading the initial goal line-by-line and verifying all acceptance criteria.

---

## Architecture & Map of Content (MOC)

```
[ Incoming Task ] ──► [ Restate Requirement ] ──► [ Task Gate: Fast / Full / Loop ]
                             │
                             ▼
 ┌──────────────────────────────────────────────────────────┐
 │ J-Space Cognitive Loop                                  │
 │   ├─ Inner Register (Chained intermediate reasoning)     │
 │   ├─ Ledger Register (Goal / Open / Settled / Next)      │
 │   └─ Seam Audit (Check invariants at each transition)    │
 └───────────────────────────┬──────────────────────────────┘
                             │
                             ▼
                 [ Outer Register Delivery ]
```

| Functional Property | Cognitive Purpose | Failure Mode Prevented |
|---|---|---|
| **Capacity Selectivity** | Only 1–2 active concepts on stage at once | Attention thinning & overloaded context |
| **Directed Focus** | Goal remains active through tedious middle | Goal evaporation during mechanical tasks |
| **Deep Reasoning** | Intermediate bridges form before conclusions | Rationalizing unverified gut guesses |
| **Self-Monitoring** | Calibrated confidence & error detection | Overconfident halluncinations |
| **Seam Auditing** | State refreshed at every transition | Context drift over long execution turns |

---

## Step-by-Step Procedure (TWI)

### Step 1: Awakening & Requirement Re-Encoding
- **Action**: Restate the requirement in one line, in your own words, before writing code or making tool calls.
- **Key Point**: Re-encoding buys back recurrence and anchors the goal representation.
- **Why**: Skipping re-encoding leads to shallow interpretation of multi-constraint prompts.

### Step 2: Task Gate Classification
- **Action**: Classify into `fast`, `full`, or `loop` pass.
- **Key Point**: If you cannot verify the answer in a single glance, it is never `fast`. Escalating costs nothing.
- **Why**: Under-classifying complex tasks causes premature shortcutting.

### Step 3: Operate the Three Registers
- **Action**: Think in the inner register, record state in the ledger, and speak in the outer register.
- **Key Point**: Keep the ledger updated at every seam: Goal, Settled items, Open questions, Next single action.
- **Inline Checklist**:
  - [ ] Requirement re-encoded
  - [ ] Correct pass classified
  - [ ] Ledger reflects current state
  - [ ] Verification criteria stated explicitly

### Step 4: Seam Refresh & Invariant Verification
- **Action**: At every seam (file written, subagent returned, tool executed), check that invariants hold.
- **Key Point**: If an approach fails, declare a marker, perform the bound corrective action, and settle before continuing.
- **Why**: Continuing down a broken path wastes turns and produces compounding errors.

### Step 5: Clean Outer Delivery
- **Action**: Translate settled conclusions into clean outer-register deliverables.
- **Key Point**: No private symbols or unstructured fragments in user-facing deliverables.
- **Why**: Deliverables must be immediately usable, clear, and actionable.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"This is simple enough, skip the ledger."* | **Enforce the floor: multi-step work requires ledger tracking.** | Unsettled state drops out of context during long turns. |
| *"The first guess sounds right, skip the intermediate step."* | **Derive intermediate bridges before adopting conclusions.** | Pretrained fluency often produces plausible but flawed shortcuts. |
| *"I will clean up the verification at the very end."* | **Verify at every seam, not just at the end.** | Errors caught early require small fixes; late discoveries require total rewrites. |
| *"Confidence is always high across all steps."* | **Calibrate confidence per step.** | Uniform confidence indicates disabled self-monitoring. |
