---
name: teach
description: "Teach a technical concept interactively using the workspace as an active learning lab with durable learning records. Use when the user asks to understand a codebase concept, learn a language feature, explore design patterns, or practice coding skills — even if they say \"explain how this works to me\". Do NOT use for silent autonomous code generation."
---

# Teach

Transform the current workspace into an interactive, stateful learning laboratory producing structured HTML lessons, reference materials, primary source bibliographies, and progressive learning records.

---

## Core Invariants

1. **Mission-Grounded Curriculum**: Every lesson, quiz, and exercise must directly anchor to `MISSION.md` (the learner's explicit real-world objective).
2. **Desirable Difficulty & Retrieval**: Target long-term storage strength through effortful retrieval, spaced practice, and interleaved exercises over fleeting in-the-moment fluency.
3. **Beautiful HTML Artifacts**: Lessons are rendered as self-contained, publication-grade HTML documents in `./lessons/000X-<name>.html` styled via shared assets (`./assets/style.css`).
4. **Durable Learning Records**: Capture key insights, non-obvious breakthroughs, and mental model shifts in `./learning-records/000X-<name>.md` to maintain the Zone of Proximal Development (ZPD).
5. **Primary-Source Grounding**: Never rely purely on model memory; cite and link verified primary sources in `RESOURCES.md` and inline lesson annotations.

---

## Architecture & Map of Content (MOC)

```
[ Learner Request / Mission ] ──► [ Assess ZPD via Learning Records ] ──► [ Build HTML Lesson & Quizzes ] ──► [ Record Progress in Learning Records ]
```

| Component | Responsibility | File Location / Template |
|---|---|---|
| **Mission Anchor** | Core motivation and real-world goal | `MISSION.md` ([MISSION-FORMAT.md](MISSION-FORMAT.md)) |
| **Lesson Artifacts** | Interactive HTML lesson modules | `./lessons/000X-<slug>.html` |
| **Reference Sheets** | Cheat sheets, syntax summaries, and glossaries | `./reference/*.html` |
| **Learning Records** | Milestone reflections and conceptual breakthroughs | `./learning-records/000X-<slug>.md` |
| **Shared Assets** | Typography, styles, and interactive quiz widgets | `./assets/*` |
| **Primary Sources** | Vetted documentation and book references | `RESOURCES.md` ([RESOURCES-FORMAT.md](RESOURCES-FORMAT.md)) |

---

## Step-by-Step Procedure (TWI)

### Step 1: Establish Mission and Assess Zone of Proximal Development
- **Action**: Check `MISSION.md` and existing `./learning-records/`. If uninitialized, grill the user to define their motivation and starting baseline.
- **Key Point**: Frame teaching around what the user needs to *do* rather than abstract theory.
- **Why**: Learning is significantly faster and more durable when grounded in immediate application.

### Step 2: Source Primary References
- **Action**: Identify and record the top primary source documentation or authoritative articles in `RESOURCES.md`.
- **Key Point**: Ensure claims and code patterns conform to modern best practices.
- **Why**: Citing primary sources builds user trust and teaches research habits.

### Step 3: Author Interactive HTML Lesson
- **Action**: Generate `./lessons/000X-<slug>.html` linking to `./assets/style.css`.
- **Key Point**: Include interactive self-check questions, code snippets, and direct links to reference sheets.
- **Inline Checklist**:
  - [ ] Standalone HTML opens cleanly in browser
  - [ ] Quiz answers formatted with balanced word/character counts
  - [ ] Follow-up discussion prompts included

### Step 4: Record Breakthroughs in Learning Records
- **Action**: After the user interacts with the lesson, capture the key concepts mastered and areas for next practice in `./learning-records/000X-<slug>.md`.
- **Why**: Keeps learning state synchronized across different sessions.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Dump a 2000-word explanation directly into chat."* | **Package learning into modular HTML lessons and reference files.** | Chat text scrolls away; structured files provide a lasting personal library. |
| *"Give easy multiple-choice questions with obvious answers."* | **Enforce balanced, high-friction retrieval practice.** | Obvious answers create false fluency without building long-term memory. |
| *"Teach without checking `MISSION.md`."* | **Mandatory mission alignment for every lesson.** | Disconnected theory causes learner disengagement and rapid forgetting. |

