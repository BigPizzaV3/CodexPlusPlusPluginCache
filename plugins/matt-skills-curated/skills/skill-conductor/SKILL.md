---
name: skill-conductor
description: "Author, refine, evaluate, and package agent skills across their full lifecycle. Use when building a new skill from scratch, improving an existing skill, fixing a skill that triggers unreliably, running skill evals, benchmarking skill performance, or packaging skills for distribution — even if they don't explicitly say \"skill conductor\". Do NOT use for general software coding tasks or using pre-existing skills."
---

# Skill Conductor

Full lifecycle management for agent skills: **draft → test → review → improve → package**.

One master discipline to govern skill creation and optimization, rooted in the 10 canonical authoring principles.

---

## Core Invariants & The 10 Canonical Authoring Principles

1. **Pre-flight verification**: Check dependencies and environment before executing workflows.
2. **No process in descriptions**: Descriptions define triggering boundaries (`Use when...`, `Do NOT use for...`), never workflow recipes.
3. **Map of Content (MOC)**: `SKILL.md` is a clear architectural map (< 500 lines) pointing to modular references.
4. **Fresh practitioner empathy**: Explain the rationale behind steps so agents understand context.
5. **Training Within Industry (TWI)**: Structure critical instructions as `Action`, `Key Point`, and `Why`.
6. **Blind agent testability**: Ensure instructions are unambiguous when executed without prior conversation history.
7. **Inline risk checklists**: Place verification checklists directly at high-risk seams.
8. **One term per concept**: Use consistent domain terminology throughout.
9. **Zero secrets / environment cleanliness**: Never hardcode credentials, tokens, or absolute user home paths.
10. **Match form to failure**: Counter specific failure modes with targeted structural constraints and anti-rationalization tables.

---

## Core Lifecycle Modes

| Mode | Trigger / Context | Key Output |
|---|---|---|
| **1. CREATE** | "build a skill", "new skill for..." | Full lifecycle: intent → architecture → scaffold → write → eval |
| **2. IMPROVE** | "fix this skill", "it doesn't trigger" | Diagnose → eval loop → gated self-update → iterate |
| **3. VALIDATE** | "test this skill", "run evals" | Structural checks + trigger testing + BinEval scoring |
| **4. REVIEW** | "review this skill", quality audit | 11-point quality gate assessment |
| **5. OPTIMIZE** | "improve triggering", "optimize description" | Automated description optimization with train/test splits |
| **6. PACKAGE** | "package for distribution" | Validation + bundle into release artifact |

---

## Step-by-Step Procedure (TWI)

### Step 1: Capture Intent & Define Triggers
- **Action**: Extract 2–3 concrete user scenarios and establish positive and negative trigger boundaries.
- **Key Point**: Specify exact phrases users say and adjacent domains the skill must reject.
- **Why**: Clear boundaries prevent undertriggering and false-positive overtriggering.

### Step 2: Architecture & Progressive Disclosure
- **Action**: Select the architectural pattern (sequential, iterative, context-aware) and structure files.
- **Key Point**: Keep `SKILL.md` concise (< 500 lines) and push heavy schemas or tables into references.
- **Why**: Bloated instruction files exhaust attention budgets and degrade execution quality.

### Step 3: Write Frontmatter & Body
- **Action**: Draft YAML frontmatter with kebab-case name and trigger-rich description, followed by MOC, TWI steps, and guardrails.
- **Inline Checklist**:
  - [ ] Frontmatter name matches directory name
  - [ ] Description is $\le 1024$ characters and contains no process steps
  - [ ] Negative triggers specified (`Do NOT use for...`)
  - [ ] Anti-rationalization table included
  - [ ] No hardcoded tokens, passwords, or machine-specific paths

### Step 4: Validate with BinEval 5 Dimensions
- **Action**: Evaluate across **Discovery, Clarity, Structure, Robustness, Completeness**.
- **Key Point**: Pass every critical gate check before declaring release readiness.
- **Why**: Multi-dimensional evaluation catches hidden failure modes before distribution.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Putting steps in the description helps the model."* | **Forbidden: zero process in description.** | Models follow description steps and skip the comprehensive body instructions. |
| *"The skill is small, so negative triggers are unneeded."* | **Mandatory negative triggers in description.** | Without negative boundaries, skills trigger falsely on loosely related queries. |
| *"One big 1200-line markdown file is easier to manage."* | **Progressive disclosure: SKILL.md < 500 lines.** | Overloaded contexts dilute attention and lead to instruction-skipping. |
| *"We can skip testing if the markdown looks clean."* | **Trigger evaluation on positive and negative test cases.** | Clean prose can still fail in actual agent routing. |
