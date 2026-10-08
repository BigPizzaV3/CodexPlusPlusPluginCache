---
name: competitive-research
description: Research and structure competitors, alternatives, substitutes, claims, pricing, channels, proof, positioning openings, and source-backed market comparisons.
compatibility: Requires Python 3.11+ only when using the optional bundled table helper.
---

# Competitive Research

Research the competitive landscape only when a strategy decision depends on external market reality.

Do not invent competitors, pricing, claims, channels, traction, customer segments, or weaknesses.

Use current external research when needed. Prefer primary sources:

- Competitor websites.
- Pricing pages.
- Product pages.
- Official documentation.
- App marketplace listings.
- Public case studies.
- Public customer reviews when relevant.

Ask one question at a time if the research scope is unclear.

## Evidence Rules

Every competitor claim must be labeled:

- Verified: directly observed in a cited source.
- Assumption: inferred from available evidence but not directly stated.
- Hypothesis: plausible but requires validation.

For web research, cite URLs in the response and record them in the live document.

Never present scraped or recalled pricing as current unless it has been checked during this task.

When competitor pricing becomes central to the decision, hand off to `pricing-strategy` after collecting source-backed pricing evidence.

## Competitive Set

Separate:

- Direct competitors: same category, similar buyer, similar job.
- Indirect competitors: different solution, same job.
- Substitutes: workaround, manual process, agency, spreadsheet, internal team, doing nothing.
- Non-consumption: the buyer currently accepts the pain or ignores the job.

## What To Extract

For each relevant competitor or alternative:

- Name.
- URL.
- Category.
- Target audience.
- Core claim.
- Offer.
- Pricing.
- Pricing basis if observable.
- Proof.
- Channels or acquisition clues.
- Strength.
- Weakness or opening.
- Evidence status.
- Source.

## Live Documents

Use or create these documents only when there is real content to record:

- `consultor/strategy/competitive-research.md`
- `consultor/strategy/competition.md`
- `consultor/strategy/pricing-strategy.md`
- `consultor/strategy/positioning.md`
- `consultor/marketing/messaging.md`
- `consultor/assumptions.md`
- `consultor/risks.md`

Use the shared [`competitive-research.md`](../../templates/competitive-research.md) template when creating a new research document.

## Research Output

Prefer a concise table plus notes:

```text
Competitor | Type | Audience | Claim | Offer | Pricing | Proof | Opening | Evidence | Source
```

When the user provides CSV or loose notes, use the table helper:

```bash
python3 ../../scripts/consultor_competitive_table.py <input-file>
```

Resolve the script path relative to this `SKILL.md` file before running it.

Use `--stdout` when the user wants to see the normalized table in chat.

After the table, add:

- Positioning implications.
- Messaging implications.
- Risks.
- Open questions.
- Validation steps.

## Done Threshold

Pause when the decision has enough competitive context to choose or challenge category, alternative, differentiation, proof, pricing, channel, or next validation step.
