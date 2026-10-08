---
name: setup-engineering-workflows
description: "Configure repository issue-tracking, triage-label, domain-doc, and agent-instruction conventions. Use when initializing engineering workflows in a repo, configuring GitHub/GitLab issue labels, or establishing CONTEXT.md conventions — even if the user says \"setup our workflows\". Do NOT use for general project package installs."
---

# Setup Engineering Workflows

Configure and standardize repository issue-tracking, triage-label vocabularies, domain-modeling architecture (`docs/agents/domain.md`), and agent instructions (`AGENTS.md` / `CLAUDE.md`).

---

## Core Invariants

1. **Prompt-Driven Exploration**: Inspect existing remotes, directories, and labels before proposing changes; do not blindly overwrite existing tracker setups.
2. **Single vs Multi-Context Prudence**: Default to single-context (`CONTEXT.md` at root); only suggest multi-context (`CONTEXT-MAP.md`) when monorepo signals (workspaces, `packages/*`) are detected.
3. **Preserve Agent Instruction File**: If `CLAUDE.md` or `AGENTS.md` exists, edit it in-place; if neither exists, ask the user before creating one. Never create both.
4. **Conditional Triage Configuration**: Only configure triage label files (`docs/agents/triage-labels.md`) if the `triage` skill is present in the repository.
5. **Durable Workspace Documentation**: Persist all configured decisions into `docs/agents/issue-tracker.md`, `docs/agents/domain.md`, and `docs/agents/triage-labels.md`.

---

## Architecture & Map of Content (MOC)

```
[ Codebase Inspection (Remotes, Monorepos) ] ──► [ Interactive Setup Sections A/B/C ] ──► [ Update AGENTS.md / docs/agents/ ]
```

| Component | Responsibility | Seed Template |
|---|---|---|
| **Issue Tracker Config** | GitHub (`gh`), GitLab (`glab`), or Local Markdown | `skills/setup-engineering-workflows/issue-tracker-github.md` |
| **Triage Vocabulary** | 5 canonical roles mapping to repo labels | `skills/setup-engineering-workflows/triage-labels.md` |
| **Domain Docs Layout** | Single-context vs multi-context conventions | `skills/setup-engineering-workflows/domain.md` |

---

## Step-by-Step Procedure (TWI)

### Step 1: Autonomous Repository Exploration
- **Action**: Check `git remote -v`, root instruction files (`AGENTS.md`, `CLAUDE.md`), `docs/adr/`, and workspace configurations (`pnpm-workspace.yaml`, `packages/`).
- **Key Point**: Identify whether the repository already has a tracker or triage convention.
- **Why**: Avoids re-asking the user for facts already evident in git and configuration files.

### Step 2: Configure Issue Tracker & Triage Labels
- **Action**: Present recommendations section-by-section:
  - **Section A (Tracker)**: GitHub (`gh`), GitLab (`glab`), or Local Markdown (`.scratch/`).
  - **Section B (Labels)**: Canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`).
  - **Section C (Domain)**: Single-context vs. Multi-context.
- **Inline Checklist**:
  - [ ] Tracker confirmed and documented in `docs/agents/issue-tracker.md`
  - [ ] Triage labels mapped in `docs/agents/triage-labels.md`
  - [ ] Domain doc rules written to `docs/agents/domain.md`

### Step 3: Wire Instructions into AGENTS.md / CLAUDE.md
- **Action**: Add or update the `## Agent skills` block inside `AGENTS.md` (or `CLAUDE.md`):
  ```markdown
  ## Agent skills
  
  ### Issue tracker
  [Summary of issue tracking]. See `docs/agents/issue-tracker.md`.
  
  ### Domain docs
  [Single or multi-context]. See `docs/agents/domain.md`.
  ```
- **Why**: Context pointers ensure newly spawned subagents read repository conventions immediately.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Create both AGENTS.md and CLAUDE.md for maximum coverage."* | **Forbidden. Maintain exactly one canonical agent file.** | Multiple instruction files lead to configuration drift and conflicting rules. |
| *"Force multi-context on single-package repositories."* | **Default to single-context unless monorepo exists.** | Unnecessary multi-context structures create excessive directory nesting. |
| *"Overwrite existing custom issue labels without asking."* | **Map existing repo labels to canonical roles.** | Overwriting existing team labels breaks active project boards and workflows. |

