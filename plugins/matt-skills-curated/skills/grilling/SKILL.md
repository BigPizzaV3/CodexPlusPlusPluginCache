---
name: grilling
description: "Relentlessly interview the user round-by-round to stress-test thinking and expose unexamined assumptions. Use when the user requests a grilling interview, wants their idea challenged, or uses trigger phrases like \"grill me\" — even if they just say \"poke holes in my plan\". Do NOT use when the user asks for immediate implementation."
---

# Grilling

Relentlessly stress-test thinking, expose hidden assumptions, and map the design space as an expanding decision tree until mutual understanding is reached.

---

## Core Invariants

1. **Frontier-Based Batched Rounds**: Ask all currently unblocked questions together in a single numbered round; never drip questions one by one.
2. **Mandatory Concrete Recommendations**: Every question must include a definitive recommended answer (`➡️ [Recommendation]`) to streamline decision-making.
3. **Autonomous Fact Exploration**: Investigate the codebase, configs, and dependencies with background exploration before asking questions; never query the user for discoverable facts.
4. **Strict Topological Dependency Ordering**: Questions whose answers depend on open decisions must wait for future rounds; never mix dependent questions into the current frontier.
5. **Verified Exhaustion Gate**: The interview concludes only when the frontier is completely empty and the user explicitly validates the final consensus.

---

## Architecture & Map of Content (MOC)

```
[ Problem Space / Initial Proposal ]
                │
                ▼
┌───────────────────────────────────────┐
│ 1. Compute Decision Frontier Tree     │
│    (Unblocked questions with defaults)│
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ 2. Issue Formatted Round (Q1..Qn)     │
│    (Questions + Strong Recommendations)│
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ 3. Ingest Answers & Advance Frontier  │
│    (Prune resolved, unlock downstream)│
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ 4. Verification & Consensus Handshake │
└───────────────────────────────────────┘
```

| Phase | Responsibility | Expected Output |
|---|---|---|
| **Frontier Extraction** | Identify independent decision nodes | Filtered list of unblocked questions |
| **Round Formatting** | Apply standardized Markdown question templates | User-facing numbered interview round |
| **Downstream Unblocking** | Re-evaluate tree based on user decisions | Updated frontier state |
| **Consensus Handshake** | Synthesize agreed architecture & requirements | Clean brief ready for specification |

---

## Step-by-Step Procedure (TWI)

### Step 1: Map the Design Space & Compute Frontier
- **Action**: Analyze the user's intent, identify all decision nodes, and select only those whose prerequisites are fully settled.
- **Key Point**: Filter out any question that requires guessing the answer to an unresolved peer question.
- **Why**: Asking dependent questions simultaneously forces the user into speculative, conditional answers that clutter context.

### Step 2: Format and Dispatch the Question Round
- **Action**: Present the current frontier using the standardized Markdown question format:
  ```markdown
  ❓ **Q1** - **<Question Title>**: <Detailed question body and options>

  ➡️ **Recommendation**: <Specific proposed answer and technical rationale>

  ---

  ❓ **Q2** - **<Question Title>**: <Detailed question body and options>

  ➡️ **Recommendation**: <Specific proposed answer and technical rationale>
  ```
- **Key Point**: Keep recommendations opinionated, clear, and grounded in industry best practices.
- **Inline Checklist**:
  - [ ] Every question numbered and titled
  - [ ] Concrete recommendation provided for each question
  - [ ] No dependent questions included in the same round

### Step 3: Ingest Answers & Advance the Frontier Tree
- **Action**: Parse user responses, record settled decisions, unlock newly available downstream questions, and generate the next round.
- **Key Point**: If a user response reveals a new unknown in the codebase, dispatch background exploration immediately to resolve it.
- **Why**: Real-time background discovery prevents passing factual burdens onto the user.

### Step 4: Verify Alignment and Completion
- **Action**: Once all branches of the decision tree have been explored and no frontier items remain, present a concise synthesis of all resolved decisions.
- **Key Point**: Require explicit user confirmation before proceeding to specification or execution.
- **Why**: Mutual alignment guarantees that the subsequent implementation phase proceeds without friction or false assumptions.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"I'll ask just one question now to see what they say."* | **Ask the entire frontier in one turn.** | Drip-feeding questions creates annoying latency and loses the macro structure of the design. |
| *"Let the user decide without biasing them with my recommendation."* | **Mandatory recommended answer for every question.** | Concrete recommendations speed up review and give users a clear baseline to react against. |
| *"Ask the user where configuration files or types are defined."* | **Discover environment facts autonomously.** | User interviews are exclusively for product and architectural decisions, not repo search. |
| *"The user gave a vague answer, but I can guess what they meant."* | **Clarify ambiguous answers immediately.** | Guessing user intent during grilling undermines the entire purpose of stress-testing. |

