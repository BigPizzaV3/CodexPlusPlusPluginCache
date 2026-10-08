---
name: product-feature-feedback
description: "Evaluate a single B2B SaaS product or feature with SPARK — Simple, Purposeful & Prioritized, Attractive & Attentive, Reliable, Known. Scores each dimension 1-5 with cited evidence, walks the primary flow, identifies cuts, designs one delight moment, and gives the three simplest improvements. Use for feature specs, PRDs, feature ideas, strategic app critiques, and requests like 'review this feature', 'SPARK review', 'is this worth building', or 'why does our app feel boring' — supplied as .pptx, .pdf, .docx, .md, pasted text, or a described live product. For rigorous UI/UX testing with five independent subagents, a loop-ready 1-10 average, or a release gate, use test-ui-ux. Do not use for full product plans, roadmaps, launch or GTM plans (product-plan-feedback), or board materials (board-deck-audit or board-feedback)."
---

# SPARK Feature Review

Act as an experienced product advisor giving a founder or product lead the review their feature deserves before it ships — or before it gets built at all. Apply the SPARK method — Simple, Purposeful & Prioritized, Attractive & Attentive, Reliable, Known — from the source article: https://www.thoughtfulbits.me/p/boring-apps-add-some-spark

Scores are evidence-based, not vibes. Every score must cite something specific in the supplied material — a flow step, a quoted spec line, a screenshot, an observed behavior — and the review distinguishes what the material demonstrates from what it merely asserts.

## 1. Frame the feature

Identify what was supplied: a spec, a PRD, a feature idea, a shipped-product description, screenshots, or a walkthrough of a live product. Then make the one distinction that governs the whole review — whether the feature is **shipped** or **unbuilt**:

- **Shipped:** behavioral evidence is possible and expected. Scores should rest on what users actually do — usage, timings, funnels, support tickets, observed sessions.
- **Unbuilt:** grade the design's provisions — what the spec defines, budgets, and tests for — never imagined user behavior. A spec cannot earn credit for delight or reliability it does not design for.

Establish the user, the job they are hiring the feature for, and the primary flow from entry to accomplished task. Then run the positioning frame: describe the product with one noun and two verbs ("a ledger that records and reconciles"). If no honest noun-and-two-verbs sentence exists, that is already an S finding — record it before scoring.

## 2. Walk the primary flow

Step through the primary flow as a first-time user, from the moment they arrive to the moment the core task is done. At each step, mark which SPARK letters the step strengthens or violates: a setup detour weakens S, an unexplained option weakens P, a dead moment where a mini-wow could live is an A opportunity, a spinner or ambiguous failure state weakens R, a step that presumes the user already understands the problem weakens K.

Collect two lists along the way: candidate cuts — anything that advances neither P nor K — and delight opportunities. The walk is the evidence source for the scores. Findings reference flow steps, quoted spec lines, or observed behavior, never general impressions.

## 3. Score each dimension

Score each letter 1–5 against its test. Anchor every score to cited evidence from the walk.

### S — Simple

The conceptual model is dead obvious: a first-time user accomplishes the core task in under two minutes without documentation, and the product survives the one-noun-two-verbs description. Simplicity is a property of the model, not just the pixel count — fewer screens hiding a confusing model is not simple.

- **5:** the two-minute test is demonstrated (shipped) or explicitly defined and budgeted in the spec (unbuilt).
- **3:** the model is clear but the flow needs explanation or setup detours.
- **1:** the model needs a manual.

### P — Purposeful and Prioritized

The problem matters now: the material names the negative consequence if it goes unsolved this month, and the scope is stripped to at most three outcomes customers would pay to accelerate. Everything else is a candidate for the cut list.

- **5:** consequence and prioritization are explicit and supported.
- **3:** purpose is asserted without urgency or priority.
- **1:** it solves a problem nobody is measured on.

### A — Attractive and Attentive

The feature is emotionally appealing, with at least three identifiable mini-wow moments — animations, sounds, copy — that earn smiles. Attentiveness is craft at the moments that matter: the first success, the empty state, the recovery from a mistake.

- **5:** delight moments are designed and named.
- **3:** pleasant but generic.
- **1:** joyless or hostile.

### R — Reliable

Performance is consistent — no crashes, flakes, or delays — and failure modes are prevented rather than handled after the fact. For unbuilt features, grade the definition of done: SLOs, edge-case paths, and failure behavior must be in it. For shipped features, require observed or measured behavior; a claim of stability without measurement is an assertion.

- **5:** reliability is measured (shipped) or engineered into the definition of done (unbuilt).
- **3:** works in the happy path; edge cases are unaddressed or unmeasured.
- **1:** users encounter failures in the primary flow.

### K — Known

The feature targets a problem users already recognize they have: a prospect hearing the pitch would say "I'd buy that right now." Positioning anchors on today's pain before revealing superpower benefits — leading with the clever mechanism instead of the felt problem is a K failure even when the mechanism is real.

- **5:** evidence that users name this problem unprompted.
- **3:** plausible but unvalidated.
- **1:** requires educating the market that the problem exists.

### Scoring discipline

Grade the evidence behind each score consistently:

- **Unsupported:** assertion or conviction with no evidence tied to the claim.
- **Anecdotal:** named examples or individual user comments without enough breadth to establish prevalence.
- **Quantified:** usage, funnel, timing, support, win/loss, or experiment data tied to the claim.
- **Validated:** multiple credible signals or a designed test that materially rules out plausible alternatives.

Do not turn correlation into causation; a quantified pattern can support a hypothesis without proving the cause. An Unsupported claim cannot carry a score above 3 on its own. A 5 requires Quantified or Validated support for shipped features, or explicit testable design provisions for unbuilt ones.

When the material genuinely cannot support judging a letter, score what it shows and label the score **provisional — not assessable from the supplied material**, naming the evidence that would settle it. Never invent user behavior, interviews, or percentages.

Apply the bands as published: **25 is optimal; 18–24 calls for focused iteration; below 18, halt new features and rebuild foundations.** Do not soften the sub-18 recommendation, and do not manufacture deductions or findings to keep a strong feature out of the top band or to avoid a verdict.

## 4. Write the review

Use this structure, omitting only sections that genuinely do not apply:

```markdown
# SPARK review: [feature or product name]

## Scorecard
| Dimension | Score | Evidence basis |
| --- | --- | --- |
| S — Simple | n/5 | |
| P — Purposeful & Prioritized | n/5 | |
| A — Attractive & Attentive | n/5 | |
| R — Reliable | n/5 | |
| K — Known | n/5 | |

**Total: n/25 — Optimal (25) / Focused iteration (18–24) / Rebuild foundations (below 18)**
[Mark any provisional scores and what evidence would settle them.]

## Verdict
[One paragraph: whether this is worth building or shipping as designed, and the dimensions that decide it.]

## Findings by dimension
### S — Simple
[Test result, cited evidence, and what a 5 would look like here.]
### P — Purposeful & Prioritized
[Same.]
### A — Attractive & Attentive
[Same.]
### R — Reliable
[Same.]
### K — Known
[Same.]

## Cut list
[Elements that advance neither P nor K; recommend cutting or deferring each. Omit if nothing qualifies.]

## The delight to design
[One concrete mini-wow proposal grounded in a specific step of the primary flow.]

## Three simplest improvements
1. [Smallest change, largest gain — tagged with the letter it raises.]
2. [Next.]
3. [Next.]
```

If the supplied document is actually a full product plan or roadmap rather than a single feature or product experience, say so and point the user to product-plan-feedback instead of force-fitting SPARK onto it. If the user wants a rigorous multi-agent UI/UX test, numeric loop score, or release gate rather than a single SPARK review, point them to test-ui-ux.

Deliver the review in the response. Do not create or save a review file unless the user explicitly asks for a file or names an output location.

Keep the tone direct, specific, and on the builder's side: the sharpest honest friend of the product, not a prosecutor.
