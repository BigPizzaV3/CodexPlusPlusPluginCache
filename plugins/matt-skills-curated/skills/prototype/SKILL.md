---
name: prototype
description: "Build a throwaway prototype to answer a specific design, state model, or UI exploration question. Use when evaluating whether an interface feels right, exploring UI concepts, or testing logic before committing to a full spec — even if the user says \"mock this up\". Do NOT use for production implementation."
---

# Prototype

Build throwaway exploratory code designed to answer a single load-bearing architectural, state machine, or UI question rapidly without production overhead.

---

## Core Invariants

1. **Throwaway By Construction**: Prototypes must be explicitly marked throwaway with zero production persistence or abstraction overhead.
2. **Branch Isolation**: Separate logic/state-machine prototypes (`LOGIC.md`) from visual UI variant explorations (`UI.md`).
3. **Single-Command Launch**: UI prototypes run with one command (`pnpm dev`, `bun run ...`); logic prototypes are single double-clickable HTML/JS files.
4. **Transparent State Exposure**: Every action or transition must visually expose the complete underlying state payload.
5. **Decisions-Only Mainline Merge**: Merge only the validated decision/type into main; commit the prototype code to a separate scratch branch.

---

## Architecture & Map of Content (MOC)

```
[ Load-Bearing Design Question ] ──► [ Select Exploration Branch ] ──► [ Minimal Runnable Prototype ] ──► [ Extract Settled Decision ]
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
             [ Logic / State Prototype ]                         [ UI Variant Explorer ]
             - Single HTML/JS file                               - Multi-variant route
             - Free-play + guided tabs                           - Bottom floating bar
             - Full state visualizer                             - URL parameter toggle
```

| Branch | Question Answered | Artifact Format |
|---|---|---|
| **Logic / State** | "Does this state machine or business rule feel right?" | `skills/prototype/LOGIC.md` |
| **UI Variations** | "What should this visual interaction look like?" | `skills/prototype/UI.md` |

---

## Step-by-Step Procedure (TWI)

### Step 1: Identify the Question & Exploration Branch
- **Action**: Determine whether the core uncertainty is logical/stateful or visual/experiential.
- **Key Point**: Check if the component has complex transition states (choose Logic) or styling/layout decisions (choose UI).
- **Why**: Choosing the wrong format wastes time building UI for logical edge cases or state machines for static layouts.

### Step 2: Implement the Minimal Runnable Prototype
- **Action**: Create the prototype with zero database persistence and minimal abstractions:
  - Logic: Self-contained HTML with state buttons, transition logs, and guided walkthrough scenarios.
  - UI: Dedicated scratch route with 2–4 radically different variants toggled via query params.
- **Inline Checklist**:
  - [ ] Marked as throwaway in filenames and comments
  - [ ] Launches via single standard command or browser click
  - [ ] Displays live internal state on every interaction

### Step 3: Interactive Evaluation & Decision Extraction
- **Action**: Walk the user through the prototype to evaluate edge cases and record the verdict.
- **Key Point**: Extract the validated data shape, state machine reducer, or component layout into the issue tracker or spec.
- **Why**: Capturing the distilled finding prevents throwaway prototype code from accidentally morphing into production spaghetti.

### Step 4: Archive Prototype & Clean Main
- **Action**: Commit the prototype to a scratch branch (`prototype/<name>`), link it in the ticket, and keep `main` clean.
- **Key Point**: Never merge un-linted prototype hacks directly into main branches.
- **Why**: Strict separation keeps the main codebase pristine while retaining historical design context.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Let's build this prototype directly inside the main production file."* | **Forbidden. Keep prototypes in isolated scratch paths.** | Inlining prototypes into production code creates accidental dependencies and tech debt. |
| *"Add full unit tests and error handling to the prototype."* | **Skip production hardening in throwaway prototypes.** | Hardening exploratory code slows learning cycles and creates emotional attachment. |
| *"Merge the entire prototype into main since it works."* | **Extract decisions only; archive prototype branch.** | Prototypes lack production safety, validation, error boundaries, and documentation. |

