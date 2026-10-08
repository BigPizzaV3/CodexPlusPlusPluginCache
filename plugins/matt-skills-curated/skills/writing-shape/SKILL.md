---
name: writing-shape
description: "Shape raw notes, transcript fragments, and research into a structured, coherent article draft. Use when assembling collected fragments into narrative sections, establishing flow, and building a draft block by block — even if the user says \"turn these notes into a draft\". Do NOT use for initial fragment generation."
---

# Writing Shape

Mine raw notes, transcript fragments, and research piles into a structured, coherent article draft by enforcing concept grounding, candidate opening hooks, and deliberate block-level formatting.

---

## Core Invariants

1. **Input Immutability**: The raw material file is strictly read-only; shape the article into a new separate document.
2. **Strict Concept Grounding**: Every concept must be grounded (either as a predefined reader prerequisite or introduced in an earlier block) before any subsequent paragraph leans on it.
3. **Multi-Opening Selection**: Always present 2–3 distinct opening hooks representing different angles/theses before building the body.
4. **Deliberate Block Formatting**: Formally justify the format of every block (prose vs. list, callout vs. inline, table vs. text, quote vs. paraphrase).
5. **Incremental Persistence**: Append and refine the article draft file paragraph-by-paragraph with live disk re-reads before every write.

---

## Architecture & Map of Content (MOC)

```
[ Raw Notes / Fragment Pile (Read-Only) ] ──► [ Establish Reader Prerequisites ] ──► [ Select Opening Hook (2-3 Options) ] ──► [ Block-by-Block Construction ]
```

| Decision Area | Tradeoff Analysis | Rule |
|---|---|---|
| **Prose vs. List** | Argumentative flow vs. scannable items | Prose carries thesis; lists carry strictly parallel items |
| **Inline vs. Callout** | Mainline continuity vs. aside context | Use callouts (`> [!NOTE]`) only if inline disrupts thesis |
| **Table vs. Paragraphs** | Repetitive structured schemas | 3+ items with matching keys $\rightarrow$ Table |
| **Quote vs. Paraphrase** | Historical phrasing vs. core idea | Quote when exact words matter; paraphrase for clarity |

---

## Step-by-Step Procedure (TWI)

### Step 1: Ingest Pile & Settle Prerequisites
- **Action**: Read the raw fragment pile end-to-end and establish what foundational knowledge the reader brings to the article.
- **Key Point**: Keep a live register of grounded concepts throughout the session.
- **Why**: Prevents cognitive gaps where articles lean on unintroduced jargon.

### Step 2: Draft 2–3 Candidate Openings
- **Action**: Present 2–3 distinct openings with different angles and force a selection.
- **Key Point**: The chosen opening sets the explicit contract for the rest of the draft.
- **Inline Checklist**:
  - [ ] Raw pile untouched
  - [ ] Prerequisites recorded
  - [ ] Opening agreed and written to target draft file

### Step 3: Grow Draft Paragraph-by-Paragraph
- **Action**: Ask "Given this block, what does the reader need next?", pull material from the pile, and debate the block format.
- **Key Point**: Re-read file before writing and append immediately.
- **Why**: Step-by-step composition ensures seamless transitions and eliminates fluff.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Generate the entire article all at once in one big turn."* | **Draft and debate block by block with the user.** | Single-shot generation produces generic prose and ignores user tone preferences. |
| *"Edit the raw notes file directly during shaping."* | **Raw material is read-only; write to a separate draft.** | Altering the source pile destroys raw fragments needed for future articles. |
| *"Use jargon before introducing the underlying concept."* | **Enforce prerequisite grounding before leaning on terms.** | Ungrounded concepts alienate readers and weaken argumentative structure. |

