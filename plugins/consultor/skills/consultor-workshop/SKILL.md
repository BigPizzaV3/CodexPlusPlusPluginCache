---
name: consultor-workshop
description: Main Consultor workshop controller. Use when the user wants strategic consulting, a business idea interrogated, a workshop flow, or help choosing which Consultor skill should handle the next branch.
compatibility: Requires Python 3.11+ only when using the optional bundled workspace and audit helpers.
---

# Consultor Workshop

Run a consulting workshop that turns fuzzy business thinking into precise decisions, hypotheses, evidence, risks, and next actions.

Ask one question at a time. Do not ask clusters.

Do not recommend by default. If the user explicitly asks for a recommendation, give it and then return to one question.

## Workshop Flow

Use this sequence as a map, not a rigid script:

1. Clarify the object of consultation: business, product, offer, campaign, market, channel, sales motion, or validation plan.
2. Identify the highest-risk unknown.
3. Route to the relevant Consultor skill:
   - `marketing-grill` for marketing strategy, audiences, messaging, and funnels.
   - `resume-consultor` for resuming existing project state before asking new questions.
   - `business-model` for revenue logic, offers, cliductes, margins, constraints, and business viability.
   - `value-proposition` for jobs, pains, gains, promise, mechanism, proof, and scope.
   - `customer-research` for interviews, feedback, reviews, quotes, triggers, and objections.
   - `competitive-research` for source-backed competitors, alternatives, substitutes, pricing, and claims.
   - `pricing-strategy` for pricing basis, packaging, tiers, discounts, margin, and price objections.
   - `offer-design` for concrete offer structure, deliverables, boundaries, onboarding, and risk reversal.
   - `positioning` for category, alternatives, differentiation, proof, and market perception.
   - `go-to-market` for channels, launch sequence, distribution, acquisition, activation, retention, and growth motion.
   - `experiment-plan` for hypotheses, tests, evidence, metrics, and decision criteria.
   - `sales-objections` for objections, buyer risk, sales narrative, pricing friction, and proof.
   - `landing-copy` for landing page copy structure after strategy is clear.
   - `dafo-builder` for evidence-backed SWOT/DAFO artifacts.
   - `canvas-builder` for Business Model Canvas / Lean Canvas artifacts.
   - `workshop-facilitator` for explicit workshop phase control.
   - `strategy-synthesis` for consolidating decisions, risks, open questions, and action plans.
4. Update live documents as decisions crystallize.
5. Stop when the current branch has enough clarity to act or validate.

## Audit Script

When starting in a project that lacks a `consultor/` workspace, initialize it before creating live documents:

```bash
python3 ../../scripts/consultor_init.py <project-root> --base-files --resume-note
```

When resuming a project or when the user asks for a score, risk map, unanswered questions, contradictions, or synthesis, run the local audit script before asking more questions:

```bash
python3 ../../scripts/consultor_audit.py <project-root> --mode workshop
```

Resolve script paths relative to this `SKILL.md` file before running them.

The report summarizes confirmed decisions, active hypotheses, evidence, risks, open questions, experiments, immediate actions, potential contradictions, and an assumption-to-evidence-to-risk-to-experiment map.

## Live Documents

Before creating documents, inspect the project for existing strategy, marketing, sales, or consulting material. Respect the structure if it is clear.

If none exists, use:

```text
consultor/
|-- context.md
|-- assumptions.md
|-- decisions.md
|-- risks.md
|-- strategy/
|-- marketing/
|-- research/
|-- sales/
|-- experiments/
`-- reports/
```

Create documents lazily. Never create empty files or empty sections.

Generated documents must be written in the user's or project's language.

## Evidence Discipline

Label claims as:

- Verified: checked against a source, artifact, analytics, customer evidence, or direct inspection.
- Assumption: plausible but not verified.
- Hypothesis: requires validation.

When current market facts, competitors, pricing, platform behavior, laws, or benchmarks matter, verify them through official docs, primary sources, direct inspection, or web research.

## Done Threshold

A branch can pause when these are clear enough:

- Who this is for.
- What job, pain, or desire matters.
- What the alternative is.
- Why this should win.
- What the offer or action is.
- What evidence supports it.
- What the main risk is.
- What the next validation step is.
