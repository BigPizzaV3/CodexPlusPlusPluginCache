---
name: handoff
description: "Compact current conversation context, decisions, evidence, and next actions into a portable markdown handoff for a fresh agent session. Use when ending a session, transferring work to another agent, switching workspaces, or preparing a resume point — even if the user just says \"save progress\". Do NOT use for committing code to git or creating branch PRs."
---

# Handoff

Compact complex conversational history, locked architectural decisions, unblocked next actions, and verification evidence into a self-contained markdown handoff document for a fresh agent session.

---

## Core Invariants

1. **External Temp Storage**: Save handoff documents to the OS temporary directory (`/tmp/handoff-<timestamp>.md`) or designated scratch folder—never pollute the project root repository files.
2. **Context Pointer Economy**: Point directly to repository artifacts, issue URLs, commit SHAs, and test suites rather than duplicating walls of text.
3. **Suggested Skills Routing**: Explicitly declare the `## Suggested Skills` block indicating which specialized skills the resuming agent should invoke first.
4. **Strict Secret Redaction**: Ensure zero credentials, tokens, API keys, or private auth headers are leaked into the handoff file.
5. **Exact Next Command**: Provide the exact command line or next prompt required to continue execution without ambiguity.

---

## Architecture & Map of Content (MOC)

```
[ Active Multi-Turn Session ] ──► [ Extract Invariants, Decisions & Blockers ] ──► [ Write `/tmp/handoff-*.md` ] ──► [ Output Resume Command ]
```

| Section | Purpose | Example Content |
|---|---|---|
| **Goal & Scope** | What this initiative accomplishes | Spec boundary, user requirements |
| **Decisions & Invariants** | Hard architectural contracts settled | Domain model choices, ADR pointers |
| **Current State & Diff** | Exact working tree status | Git status, modified files, passing tests |
| **Suggested Skills** | Tools the next session needs | `[skills/implement-spec/SKILL.md](file:///...)` |
| **Exact Next Action** | Atomic next step | Command or task frontier claim |

---

## Step-by-Step Procedure (TWI)

### Step 1: Synthesize Session Delta & Decisions
- **Action**: Extract the critical path decisions settled, active files modified, and outstanding questions.
- **Key Point**: Check that all decisions link to their primary ADRs or specs.
- **Why**: Resuming agents need the "why" behind choices without re-litigating settled discussions.

### Step 2: Format Handoff Document & Redact Secrets
- **Action**: Structure the markdown document with Goal, Completed Work, Active Blockers, Suggested Skills, and Next Actions.
- **Key Point**: Scan the text to ensure no private tokens or environment secrets are included.
- **Inline Checklist**:
  - [ ] Saved in `/tmp/` (e.g. `/tmp/handoff-2026-08-30.md`)
  - [ ] Suggested skills explicitly listed
  - [ ] Zero secrets present

### Step 3: Emit Resume Instructions
- **Action**: Output a clean completion summary to the user with the exact path to the handoff file and how the next agent can ingest it.
- **Why**: Allows instant session resumption without context loss.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Write the handoff directly into the project repository root."* | **Save handoffs to `/tmp/` or temporary OS directory.** | Ephemeral session dumps pollute git history and clutter repo source trees. |
| *"Paste full file contents into the handoff document."* | **Use concise context pointers and file paths.** | Pasting entire files consumes context budget on the resuming agent session. |
| *"Omit suggested skills and let the next agent guess."* | **Mandatory 'Suggested Skills' section.** | Direct skill guidance prevents the resuming agent from drifting into generic workflows. |

