---
name: retro
description: "Conduct a retrospective on a coding session to systematically improve agent environment, navigation pointers, automated checks, coding standards, tool economy, or AGENTS.md instructions. Use when reflecting on completed work, auditing agent mistakes, or optimizing repository rules — even if the user says \"run a retro\". Do NOT use during active mid-task implementation."
---

# Retro

Conduct systematic, evidence-grounded retrospectives on past agent coding sessions to improve repository navigation pointers, automated lint/type checks, reviewer standards, and instruction ergonomics.

---

## Core Invariants

1. **Context Pressure Separation**: Differentiate implementation agents (high context pressure; need minimal steering and navigation pointers) from review agents (low context pressure; enforce deep coding standards).
2. **Push Rules Down the Pyramid**: Whenever possible, convert instructions into automated compiler/linter checks $\rightarrow$ reviewer rules $\rightarrow$ documentation $\rightarrow$ only as a last resort `AGENTS.md`.
3. **No-Op Instruction Pruning**: Actively audit and eliminate non-operational or redundant instructions from `AGENTS.md` and `CLAUDE.md`.
4. **Tool Economy Analysis**: Identify and streamline token-inefficient MCP tool calls or large file payload reads.
5. **Severity-Ranked Recommendations**: Present actionable improvement candidates ordered strictly by impact on agent reliability and token efficiency.

---

## Architecture & Map of Content (MOC)

```
[ Session Logs & Past Mistakes ]
                │
                ▼
┌───────────────────────────────────────┐
│ 1. 6-Category Retrospective Audit     │
│    (Nav, Checks, Standards, Steering, │
│     Tooling, Info Access)             │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ 2. Rule Hierarchy Placement           │ ──► Auto-Check > Reviewer Rule > Doc Pointer > AGENTS.md
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ 3. Severity-Ranked Action Items       │ ──► Concrete diffs to configs, linters, or standards
└───────────────────────────────────────┘
```

| Audit Category | Evaluation Focus | Remediation Action |
|---|---|---|
| **Navigation** | Time spent searching files | Add concise navigation pointers in `docs/` |
| **Automated Checks** | Preventable syntax/type/path bugs | Add linter rules, Husky hooks, TypeScript strictness |
| **Coding Standards** | Missed architectural guidelines | Add rules to `CODING_STANDARDS.md` (read during review) |
| **Steering Hygiene** | Unwieldy `AGENTS.md` / `CLAUDE.md` | Prune no-ops, trim prose, push rules to sub-docs |
| **Tool Economy** | Expensive/redundant tool calls | Cache results, scope searches, optimize grep patterns |
| **Info Access** | Missing logs or credentials | Provision read-only logs or environment variables |

---

## Step-by-Step Procedure (TWI)

### Step 1: Ingest Session Logs & Primary Sources
- **Action**: Read the transcript logs of the specified session (or current session) and identify friction points, wrong turns, and repeated failures.
- **Key Point**: Ground all critiques in observable events rather than generic advice.
- **Why**: Retrospectives must solve real developer and agent friction observed in actual execution.

### Step 2: Audit Against the 6 Improvement Categories
- **Action**: Evaluate where the failure should ideally have been caught (e.g. automated check vs. reviewer vs. prompt pointer).
- **Inline Checklist**:
  - [ ] Can this mistake be caught by a linter or compiler flag?
  - [ ] Does this belong in `CODING_STANDARDS.md` for the review agent?
  - [ ] Are `AGENTS.md` files lean ($<100$ lines) and free of no-ops?

### Step 3: Propose Severity-Ordered Action Items
- **Action**: Format recommendations with concrete file diffs and command-line instructions.
- **Key Point**: Clearly explain the trade-offs of each proposed rule change.
- **Why**: Concrete proposals allow maintainers to accept improvements with a single confirmation.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Add a 50-line instruction to AGENTS.md for every bug encountered."* | **Push rules down to automated checks or review docs.** | Overloading `AGENTS.md` bloats context window on every turn and degrades reasoning. |
| *"Impose heavy coding standard rules on the implementer prompt."* | **Place coding standards in `CODING_STANDARDS.md` for review.** | Implementers need context space for reasoning, debugging, and file exploration. |
| *"Keep no-op instructions because they sound good."* | **Prune all instructions that do not demonstrably steer model behavior.** | Dead instructions consume tokens and dilute attention on critical invariants. |

