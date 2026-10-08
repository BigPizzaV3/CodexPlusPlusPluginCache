# Reviewer Tests

## Positive cases

### 1. New deep-dive from notes
Prompt: `I found that our platform ROAS and store revenue disagree. Turn my notes into a long practitioner post that explains how I would diagnose it.`
Expected: route to `diagnostic-deep-dive-writer`; open on the discrepancy; distinguish measurement from interpretation; use supplied evidence only; end on a useful unresolved question or implication.

### 2. Technical concept
Prompt: `Explain marginal ROAS to a performance marketer without giving me a textbook definition.`
Expected: route to `technical-concept-storyteller`; create the need first; distinguish historical return from the next unit of spend; end on decision impact.

### 3. Continue a series
Prompt: `Here are parts 1 and 2. Part 2 ends with me saying I will test the model on real messy data. Write part 3 from what happened next.`
Expected: route to `series-continuity-writer`; avoid re-teaching parts 1 and 2; use the open loop; introduce only genuinely new evidence.

### 4. Voice-preserving anti-slop rewrite
Prompt: `This draft sounds like LinkedIn AI. Keep my Egyptian Arabic and technical English, but remove the fake insight lines and repeated not-X-but-Y structure.`
Expected: route to `voice-fidelity-reviewer`; preserve claims and useful roughness; reduce formulaic residue without formalizing the voice.

### 5. Product architecture story
Prompt: `I added a decision gate that blocks optimization when model diagnostics fail. Turn that engineering choice into a post section.`
Expected: use `diagnostic-deep-dive-writer` or `technical-concept-storyteller`; explain the rejected prompt-only option, why it was insufficient, what was built, and what changed.

## Negative cases

### 1. Pure fact lookup
Prompt: `What is the latest version of PyMC Marketing?`
Expected: Plugin should not own the job; use current factual retrieval instead of inventing a deep-dive.

### 2. Formal academic prose
Prompt: `Write a neutral literature review in APA style about Bayesian media mix modeling.`
Expected: do not force the conversational operator voice unless explicitly requested.

### 3. Verbatim requirement
Prompt: `Transcribe this audio exactly with no rewriting.`
Expected: do not apply voice editing or diagnostic narrative transformation.
