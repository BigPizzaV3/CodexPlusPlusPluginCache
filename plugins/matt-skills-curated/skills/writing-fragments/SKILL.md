---
name: writing-fragments
description: "Capture and refine raw ideas, quotes, and observations before committing to an article outline. Use when collecting source material, brainstorming essay fragments, or exploring angles without structure pressure — even if the user says \"help me brainstorm notes\". Do NOT use for final draft formatting."
---

# Writing Fragments

Facilitate low-pressure idea capture and Socratic exploration by continuously extracting raw writing fragments, quotes, analogies, and leading metaphors into a delimiter-separated markdown notes file.

---

## Core Invariants

1. **Pure Exploration Mode**: Never force premature structuring, outlines, or paragraph grouping; keep capture friction near zero.
2. **Horizontal Rule Delimiters**: Separate every distinct fragment with horizontal rules (`---`) under a single top-level `# Working Title`.
3. **Continuous Disk Re-Read**: Always re-read the target fragments markdown file from disk before appending to preserve human out-of-band edits.
4. **Leading-Word Extraction**: Actively identify and coin compact metaphors ("leading words") that anchor core conceptual points.
5. **No Overhead Metadata**: Avoid adding tables of contents, timestamps, author frontmatter, or category tags into raw fragment files.

---

## Architecture & Map of Content (MOC)

```
[ Freeform Ideation / Grilling Dialogue ] ──► [ Extract Raw Fragment / Leading Word ] ──► [ Append to `notes.md` via `---` ] ──► [ Re-read Before Next Write ]
```

| Fragment Type | Structure | Purpose |
|---|---|---|
| **Sharp Sentence** | Single punchy line | Reusable hook or thesis anchor |
| **Vignette / Anecdote** | Short narrative paragraph | Concrete real-world grounding |
| **Quote / Dialogue** | Blockquote with attribution | Primary source evidence |
| **Leading Word** | Coined metaphor / terminology | Load-bearing concept for future shaping |

---

## Step-by-Step Procedure (TWI)

### Step 1: Initialize Working File & Settle Target Path
- **Action**: Ask the user once for the target file path (if omitted) and initialize with `# Working Title`.
- **Key Point**: Start capturing immediately from the user's first prompt.
- **Why**: Zero upfront bureaucracy maximizes creative momentum.

### Step 2: Socratic Exploration & Fragment Extraction
- **Action**: Interview the user relentlessly, surfacing non-obvious observations, contrarian takes, and sharp formulations.
- **Key Point**: When a powerful recurring theme appears, coin a compact "leading word" (e.g. *tracer bullet*, *fog of war*).
- **Inline Checklist**:
  - [ ] Fragments separated strictly by `---`
  - [ ] No internal subheadings (H2/H3) inside raw fragment file
  - [ ] File re-read from disk prior to every append

### Step 3: Incremental Silent Appends
- **Action**: Append agreed fragments to disk without interrupting conversational flow.
- **Why**: Continuous, non-blocking persistence ensures no fleeting ideas are lost.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Organize the raw fragments into numbered thematic sections."* | **Forbidden. Keep raw fragments unstructured.** | Premature organization closes off novel angles and creates cognitive friction. |
| *"Overwrite the file with a newly organized version."* | **Append only; preserve human manual edits.** | Overwriting destroys out-of-band human phrasing and edits. |
| *"Ask permission before writing every single fragment."* | **Append silently and mention in passing.** | Constant save confirmation prompts derail productive brainstorming flow. |

