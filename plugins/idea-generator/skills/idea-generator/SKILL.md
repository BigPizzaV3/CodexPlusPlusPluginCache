---
name: idea-generator
description: Use when the user asks for an idea generator, conceptual crossbreeding, mutation, evolution, recombination of existing ideas, or novel concepts derived from unlike sources; also use for follow-ups that evolve, cross, or lock elements of previously generated ideas. Do not trigger for generic brainstorming with no request for this method.
license: MIT
---

# Idea Generator

Generate ideas by transforming explicit intermediate structures, not by free-associating directly from the theme.

## Required workflow

1. Parse theme, constraints, source ideas, mutation rate, count, locks, and generation references from the request and current conversation. Never invent missing project facts.
2. Normalize mutation: Low = 20, Medium = 50, High = 80; preserve an explicit 0–100 value. Default to Medium and count 5.
3. Read [generation-rules.md](references/generation-rules.md) and construct Idea DNA for at least two parents. If source ideas are absent, derive multiple meaningfully different parents from the theme and label them as inferred.
4. Create an internal candidate pool larger than the requested count. Every candidate must use crossover, mutation, or both. Apply locks and hard constraints as invariants before and after transformation.
5. Preserve initially awkward combinations long enough to attempt a useful interpretation. Reject only after interpretation fails or an invariant is violated.
6. Evaluate candidates privately using novelty, usefulness, feasibility, and theme fit. Adjust weighting by mutation level using [mutation-rules.md](references/mutation-rules.md).
7. Return the strongest diverse candidates using [output-format.md](references/output-format.md). Expose result-level lineage only; never reveal chain-of-thought.

## Iteration

Resolve references such as “3番”, “2と5”, or “これ” from the current conversation. Treat selected outputs as next-generation parents without asking the user to restate them. Carry forward their DNA, constraints, and declared locks. Apply changes only to unlocked loci. For multiple generations, repeat transformation and selection internally, and report the final generation unless intermediate generations are requested.

If a referenced idea is ambiguous or unavailable in the visible conversation, ask one concise clarification instead of guessing.

## Invariants

- Perform Idea DNA decomposition before generation.
- Perform crossover or mutation before concretization.
- Never mutate a lock or violate a hard constraint. “Ignore feasibility” changes evaluation weighting, not constraints.
- Keep distinct parents genuinely distinct; do not relabel near-duplicates as heterogeneous material.
- Do not present raw random word pairs as ideas.
- Do not expose hidden reasoning, rejected candidate traces, or private scoring unless the user asks for evaluation; even then provide concise result-level reasons.

Read [examples.md](references/examples.md) only when resolving ambiguous invocation or iteration patterns.
