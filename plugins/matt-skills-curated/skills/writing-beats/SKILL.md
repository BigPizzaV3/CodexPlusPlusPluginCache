---
name: writing-beats
description: "Develop long-form writing through an interactive progression of narrative and argumentative beats. Use when drafting essays, articles, documentation, or blog posts where structure evolves beat by beat — even if the user says \"write this post with me\". Do NOT use for quick single-sentence copy edits."
---

# Writing Beats

Drive an interactive, choose-your-own-adventure drafting loop where each beat introduces a focused narrative move, respects grounded prerequisites, and unlocks reachable subsequent pathways.

---

## Core Invariants

1. **One Beat per Turn**: Propose 2–3 candidate next moves, preview what each unlocks, and write strictly ONE chosen beat per turn to disk.
2. **Dynamic Reachability & Grounding**: A candidate beat is only reachable if all required concepts are already grounded (either as baseline prerequisites or introduced by previous beats).
3. **No Batch Writing Ahead**: Never jump ahead to write unapproved beats; each beat must establish state before subsequent branches are computed.
4. **Preserve Author Revisions**: Always re-read the draft file from disk before generating next candidates to incorporate user edits seamlessly.
5. **Complete Journey Over Empty Pile**: The essay concludes when the narrative journey is complete, not when every raw fragment in the pile is exhausted.

---

## Architecture & Map of Content (MOC)

```
[ Raw Fragment Pile ] ──► [ Settle Grounded Prerequisites ] ──► [ Present 2-3 Candidate Beats ]
                                                                             │
                                           ┌─────────────────────────────────┴─────────────────────────────────┐
                                           ▼                                                                   ▼
                                  [ Candidate Beat A ]                                                [ Candidate Beat B ]
                                  - Requires: Grounded X, Y                                           - Requires: Grounded X
                                  - Grounds: New Concept Z                                            - Grounds: New Concept W
                                  - Unlocks: Path Alpha                                               - Unlocks: Path Beta
                                           │
                                           ▼
                               [ User Chooses Beat A ] ──► [ Append Beat A to Disk ] ──► [ Compute Next 2-3 Candidates ]
```

| Beat Scale | Structure | Narrative Function |
|---|---|---|
| **Micro Beat** | 1 punchy sentence | Scene transition or timing pause |
| **Standard Beat** | 1 tight paragraph | Setup + punchline or claim + rationale |
| **Macro Beat** | 2–3 paragraphs | Self-contained vignette or code walkthrough |

---

## Step-by-Step Procedure (TWI)

### Step 1: Initialize Grounding Matrix & Prerequisites
- **Action**: Ingest the raw pile and agree with the user on what concepts the audience knows walking in.
- **Key Point**: Track the active list of grounded concepts in session memory.
- **Why**: Ensures every candidate branch is conceptually accessible to the reader.

### Step 2: Formulate Candidate Next Beats
- **Action**: Offer 2–3 candidate beats drawn from the pile, explicitly stating: (1) what concepts it requires, (2) what new concept it grounds, (3) what directions it unlocks.
- **Inline Checklist**:
  - [ ] All candidates reachable from currently grounded set
  - [ ] Each candidate represents a distinct narrative branch
  - [ ] Unlocked paths previewed for the user

### Step 3: Append Chosen Beat & Re-Read Disk
- **Action**: Write the user-selected beat to the draft file and re-read the entire draft before computing the next step.
- **Key Point**: If the user asks to backtrack or rewrite an earlier beat, edit it in place and re-compute available branches.
- **Why**: Gives the author complete interactive agency over article pacing and narrative tone.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Write 3 beats at once to speed up drafting."* | **Write exactly 1 beat per turn.** | Batching beats removes the author's ability to steer branch direction. |
| *"Force every leftover raw fragment into the draft."* | **Conclude when the journey is complete; leave excess in the pile.** | Forcing unused fragments into the draft dilutes clarity and clutters the narrative. |
| *"Offer candidate beats that require ungrounded concepts."* | **Enforce prerequisite reachability on all candidates.** | Leaping into ungrounded concepts confuses readers and breaks argument continuity. |

