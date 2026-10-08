---
name: scaffold-exercises
description: "Scaffold course, workshop, or tutorial exercises following repository conventions. Use when creating exercise folders, problem/solution/explainer variants, numbered lesson files, or workshop boilerplate — even if the user says \"add a new exercise\". Do NOT use for routine application feature scaffolding."
---

# Scaffold Exercises

Scaffold standardized educational exercise directories, problem/solution/explainer variant subfolders, and boilerplate TypeScript modules that strictly pass repository linter rules.

---

## Core Invariants

1. **Strict Dash-Case Numeric Hierarchy**:
   - Section folders: `exercises/XX-section-name/` (2-digit zero-padded number).
   - Exercise folders: `exercises/XX-section-name/XX.YY-exercise-name/` (section.exercise format).
2. **Mandatory Variant Subfolders**: Every exercise must contain at least one of `problem/`, `solution/`, or `explainer/` (defaulting to `explainer/` for stubs).
3. **Non-Empty Readme Standards**: Every variant folder must contain a non-empty `readme.md` with a clean `# Title`, description, and zero broken links.
4. **Git-Aware Moves**: Always use `git mv` instead of raw filesystem renames when renumbering or restructuring existing exercises to preserve commit history.
5. **Mandatory CLI Lint Gate**: Execute and verify `pnpm ai-hero-cli internal lint` before concluding the scaffolding step.

---

## Architecture & Map of Content (MOC)

```
[ Curriculum Plan / Outline ] ──► [ Generate Numbered Directories ] ──► [ Scaffold Variant Subfolders ] ──► [ Lint & Commit Gate ]
```

| Variant Folder | Student Purpose | Required Files |
|---|---|---|
| `problem/` | Active student workspace with `// TODO:` markers | `readme.md`, `main.ts` |
| `solution/` | Complete reference implementation | `readme.md`, `main.ts` |
| `explainer/` | Conceptual deep-dive without code tasks | `readme.md` |

---

## Step-by-Step Procedure (TWI)

### Step 1: Parse Curriculum Plan & Compute Hierarchy
- **Action**: Extract section names, exercise titles, and required variant types from the provided outline.
- **Key Point**: Formulate proper 2-digit numeric prefixes (`01`, `02`, `01.01`, `01.02`).
- **Why**: Consistent numbering ensures exercises display in correct chronological order in the CLI and UI.

### Step 2: Scaffold Directory Tree and Variant Files
- **Action**: Create folders (`mkdir -p`) and populate `readme.md` stubs with titles and descriptions.
- **Key Point**: If code execution is involved, generate a non-empty `main.ts`.
- **Inline Checklist**:
  - [ ] Dash-case directory naming strictly enforced
  - [ ] Non-empty `readme.md` created in each variant subfolder
  - [ ] No forbidden `.gitkeep` or `speaker-notes.md` files introduced

### Step 3: Run Internal Linter & Fix Issues
- **Action**: Execute `pnpm ai-hero-cli internal lint` to validate the exercise structure.
- **Key Point**: Iterate on any reported broken links or missing files until the linter passes completely.
- **Why**: Pre-commit linting prevents breaking curriculum builds and automated runner harnesses.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Use raw `mv` when renumbering exercises."* | **Mandatory `git mv` for all renames and moves.** | Raw moves break Git blame and make diffs unreadable in PR reviews. |
| *"Create empty `.gitkeep` files in exercise folders."* | **Forbidden. Populate meaningful `readme.md` stubs.** | Linter rules forbid `.gitkeep` files in exercise packages. |
| *"Skip running `pnpm ai-hero-cli internal lint` on stubs."* | **Mandatory green linter verification.** | Missing title headers or invalid subfolder names break downstream test runners. |

