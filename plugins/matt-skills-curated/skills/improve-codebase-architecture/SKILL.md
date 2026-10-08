---
name: improve-codebase-architecture
description: "Survey codebases for shallow modules, weak seams, and deepening opportunities, producing a visual report. Use when conducting architectural reviews, identifying design debt, finding deepening opportunities, or preparing codebase refactors — even if the user says \"analyze our architecture\". Do NOT use for basic syntax linting or formatting."
---

# Improve Codebase Architecture

Survey codebases for shallow modules, leaky abstractions, and weak seams, generating an interactive, visual HTML report in the OS temp directory with before/after architectural refactoring models.

---

## Core Invariants

1. **YAGNI Scope First**: Prioritize hotspots in recent commit history (`git log --oneline`) where architectural friction is actively slowing development.
2. **Strict Design Vocabulary**: Frame all findings using canonical terms (**module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality**) and domain vocabulary from `CONTEXT.md`.
3. **External Temp Report**: Write the visual report to the OS temporary directory (`<tmpdir>/architecture-review-<timestamp>.html`) with Tailwind CDN and Mermaid diagrams; never litter the repository with review HTML.
4. **Before/After Visual Models**: Every deepening candidate must feature a clear before/after structural diagram illustrating interface simplification and implementation depth.
5. **No Speculative Interface Proposing**: Propose candidate problem areas and deepening directions; do not propose concrete code interfaces until the user selects a candidate.

---

## Architecture & Map of Content (MOC)

```
[ Hotspot & Git Log Analysis ] ──► [ Deepening Candidate Survey ] ──► [ Generate HTML Report in /tmp ] ──► [ Grilling on Chosen Candidate ]
```

| Component | Responsibility | Reference |
|---|---|---|
| **Hotspot Scanner** | Identify frequently changed, high-friction files | Git log & subagent exploration |
| **HTML Visual Report** | Render side-by-side Mermaid & Tailwind cards | `skills/improve-codebase-architecture/HTML-REPORT.md` |
| **Candidate Deepening** | Socratic review of selected candidate | `skills/grilling/SKILL.md` + `skills/codebase-design/SKILL.md` |

---

## Step-by-Step Procedure (TWI)

### Step 1: Scan Recent Codebase Hotspots
- **Action**: Inspect `git log --oneline -n 100` and `CONTEXT.md` to identify high-churn modules and domain boundaries.
- **Key Point**: Focus on modules where understanding one concept requires hopping between multiple fragmented files.
- **Why**: Deepening stable, untouched legacy files yields low ROI compared to active hotspots.

### Step 2: Survey Deepening Opportunities
- **Action**: Evaluate candidate modules using the deletion test and locate shallow pass-throughs.
- **Key Point**: Check for extracted pure functions that lack locality and leak callers' state.
- **Inline Checklist**:
  - [ ] Hotspot files identified from git churn
  - [ ] 2–4 distinct deepening candidates formulated
  - [ ] Candidates categorized by recommendation strength (`Strong`, `Worth exploring`, `Speculative`)

### Step 3: Generate Self-Contained Visual HTML Report
- **Action**: Write `<tmpdir>/architecture-review-<timestamp>.html` with Tailwind and Mermaid CDN scripts.
- **Key Point**: Include problem descriptions, leverage/locality benefits, and side-by-side before/after Mermaid diagrams.
- **Why**: Visual architecture diagrams communicate structural improvements far more effectively than walls of text.

### Step 4: Open Report & Facilitate Candidate Selection
- **Action**: Launch the HTML report via `open <path>` (macOS) / `xdg-open` (Linux) / `start` (Windows) and ask the user which candidate to explore.
- **Key Point**: Upon selection, enter the grilling loop to settle module boundaries and update `CONTEXT.md` / ADRs.
- **Why**: Collaborative candidate selection ensures team buy-in before investing in refactoring.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Write the HTML review report directly into the repo root."* | **Write reports exclusively to the OS temp directory.** | Review artifacts should never pollute project Git history. |
| *"Draft full replacement code files immediately in the report."* | **Present architectural direction and diagrams first.** | Premature coding before agreeing on architectural seams leads to wasted effort. |
| *"Re-open settled ADR decisions without strong evidence."* | **Respect existing ADRs unless severe friction is demonstrated.** | Constant relitigation of settled decisions stalls progress. |

