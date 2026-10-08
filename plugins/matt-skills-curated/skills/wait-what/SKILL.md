---
name: wait-what
description: "Re-pitch an explanation or proposal from a simpler angle with reset assumptions and plain English. Use when the previous explanation was confusing, jargon-heavy, or did not land — even if the user just says \"what?\" or \"I don't get it\". Do NOT use for general brainstorming or initial planning."
---

# Wait What

Reset conversational assumptions, strip out convoluted jargon, and re-explain technical proposals using ASD-STE100 Simplified Technical English grounded in canonical domain terminology (`CONTEXT.md`).

---

## Core Invariants

1. **Simplified Technical English (STE)**: Use clear, unambiguous sentences; restrict vocabulary to concrete, observable concepts without cognitive overload.
2. **Domain Glossary Fidelity**: Strictly utilize the canonical nouns established in `CONTEXT.md` (or `CONTEXT-MAP.md`); avoid colloquial synonyms.
3. **Reset Ground Assumptions**: Step back from complex implementation details and re-anchor the explanation in the core user problem and high-level architecture.
4. **Concrete Contrast (Before vs. After)**: Use simple side-by-side examples or ASCII diagrams to demonstrate the change visually.
5. **Check for Understanding**: Conclude with a single direct question confirming whether the new explanation lands clearly.

---

## Architecture & Map of Content (MOC)

```
[ Confusing / Jargon-Heavy Explanation ] ──► [ Step Back to Problem Statement ] ──► [ ASD-STE100 Re-Pitch with CONTEXT.md ] ──► [ Single Alignment Check ]
```

| Phase | Responsibility | Guidelines |
|---|---|---|
| **Context Reset** | Re-state the immediate goal in 1 sentence | Ground in user value |
| **STE Explanation** | Explain mechanism with short active verbs | 1 concept per sentence |
| **Visual/Concrete Anchor** | Show 3-line input/output or ASCII diff | High clarity, low noise |

---

## Step-by-Step Procedure (TWI)

### Step 1: Strip Jargon and Reset Context
- **Action**: Acknowledge the ambiguity, discard low-level implementation minutiae, and state the primary objective in plain English.
- **Key Point**: Check `CONTEXT.md` to ensure correct domain terms are used without inventing new terms.
- **Why**: Cognitive fatigue occurs when explanations introduce multiple competing mental models simultaneously.

### Step 2: Formulate Simplified Explanation
- **Action**: Deliver the re-pitch in short, structured bullet points:
  1. What is the current problem?
  2. What is the proposed change?
  3. Why does this solve the problem cleanly?
- **Inline Checklist**:
  - [ ] Sentences average under 15 words
  - [ ] Canonical domain vocabulary used
  - [ ] Abstract metaphors replaced with concrete mechanics

### Step 3: Align on Core Understanding
- **Action**: Ask a single targeted question to verify comprehension before moving forward.
- **Why**: Prevents continuing down a misaligned technical path.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Repeat the previous explanation louder or with more words."* | **Re-pitch from a completely fresh, simpler baseline angle.** | Repeating the same explanation fails to address the root cognitive confusion. |
| *"Use complex industry analogies and metaphors."* | **Use concrete, direct technical English (STE).** | Analogies introduce leaky abstractions and hide technical realities. |
| *"Assume the user understood and start modifying files."* | **Confirm alignment with a clean question before acting.** | Proceeding without mutual clarity leads to rejected work and reverted PRs. |

