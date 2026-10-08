---
name: post-scorer
description: Score a social post draft against the user's historical performance data or, when no history is supplied, with a clearly labeled heuristic rubric. Use when the user asks to score, benchmark, predict, or critique a draft for performance.
---

# Post Scorer

## Preferred evidence

Use one of:

- LinkedIn analytics export
- CSV of post history
- spreadsheet with impressions, reactions, comments, saves, clicks, followers, or dates
- a set of past posts paired with performance metrics

If the data is available as files, use host file tools. Use Python for deterministic calculations when the host provides it.

## Data-backed mode

1. Clean the post history.
2. Choose metrics that are actually present.
3. Normalize rate metrics where possible.
4. Compare the draft's structural features to the user's stronger and weaker posts.
5. Separate correlation from causation.
6. Produce a score from 0 to 100 with an explanation of how it was derived.
7. Give the smallest set of changes most likely to improve the draft.

## Heuristic mode

If no historical performance data exists, label the result `Heuristic score`. Evaluate:

- clarity
- opening strength
- specificity
- credibility
- reader relevance
- pacing
- novelty
- payoff
- CTA fit

Do not imply the heuristic predicts actual reach.

## Output

- mode: data-backed or heuristic
- score
- strongest element
- main risk
- 3 highest-priority edits
- revised opening if useful
- evidence limits
