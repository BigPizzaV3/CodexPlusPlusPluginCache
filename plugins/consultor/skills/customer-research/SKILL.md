---
name: customer-research
description: Prepare customer interviews and synthesize interviews, feedback, reviews, support notes, sales calls, and testimonials into jobs, pains, gains, triggers, objections, quotes, patterns, evidence, and hypotheses.
compatibility: Requires Python 3.11+ only when using the optional bundled extraction helper.
---

# Customer Research

Turn customer voice into useful consulting evidence.

Ask one question at a time when the research scope is unclear. Do not recommend unless explicitly asked.

## What To Challenge

- Compliments treated as demand.
- Opinions treated as behavior.
- Future promises treated as evidence.
- Founder interpretation presented as customer language.
- One loud customer treated as a segment.
- Survey answers used where past behavior or purchase behavior is needed.
- Personas invented without quotes, examples, triggers, or situations.
- "People want this" without who, when, why now, and what they do instead.

## Evidence Hierarchy

Prefer stronger evidence:

1. Purchase or renewal behavior.
2. Recent past behavior.
3. Concrete attempts to solve the problem.
4. Repeated objections in sales/support.
5. Specific quotes tied to a situation.
6. Stated preference or opinion.
7. Compliments and enthusiasm.

Label each insight:

- Verified: grounded in a source, transcript, call note, review, support ticket, or behavior.
- Assumption: plausible interpretation of available material.
- Hypothesis: pattern that needs more research or validation.

## Interview Discipline

When preparing interviews:

- Ask about recent past behavior, not imagined futures.
- Ask for concrete examples.
- Ask what happened before, during, and after the problem.
- Ask what they tried instead.
- Ask what triggered action.
- Ask what made them hesitate.
- Avoid pitching during discovery.

## Extraction Script

When the user provides a transcript, notes, reviews, support messages, or call text as a local file, use the extraction helper before synthesizing:

```bash
python3 ../../scripts/consultor_customer_extract.py <input-file>
```

Resolve the script path relative to this `SKILL.md` file before running it.

Use `--stdout` when the user wants to see the extraction in chat.

## What To Extract

From interviews, feedback, reviews, notes, or transcripts, extract:

- Segment or situation.
- Job to be done.
- Pain.
- Desired gain.
- Trigger.
- Current alternative.
- Buying criteria.
- Objections.
- Exact customer quotes.
- Evidence strength.
- Patterns across sources.
- Implications for value proposition, positioning, pricing, sales, or experiments.

## Handoff Rules

Use related Consultor skills when the branch shifts:

- Use `value-proposition` when customer research clarifies job, pain, gain, promise, mechanism, or proof.
- Use `positioning` when research changes category, alternative, differentiation, or reason to believe.
- Use `sales-objections` when research surfaces objections, trust gaps, or risk reversal needs.
- Use `experiment-plan` when an insight needs validation.
- Use `pricing-strategy` when willingness to pay, budget, price objections, or value metric appear.

## Live Documents

Use or create these documents only when there is real content to record:

- `consultor/research/customer-research.md`
- `consultor/research/interview-guide.md`
- `consultor/strategy/value-proposition.md`
- `consultor/strategy/positioning.md`
- `consultor/sales/objections.md`
- `consultor/experiments/experiments.md`
- `consultor/assumptions.md`
- `consultor/risks.md`

Use the shared [`customer-research.md`](../../templates/customer-research.md) or [`interview-guide.md`](../../templates/interview-guide.md) template when creating new research documents.

## Output

Prefer:

- Patterns, not anecdotes.
- Quotes with context.
- Evidence labels.
- Implications for decisions.
- Hypotheses and next research questions.

## Done Threshold

Pause when the target segment, research source, repeated job/pain/gain, current alternative, trigger, objection, quote evidence, and next validation step are clear.
