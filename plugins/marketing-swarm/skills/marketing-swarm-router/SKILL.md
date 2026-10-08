---
name: marketing-swarm-router
description: Use for broad or multi-part paid-media questions that need routing across campaign diagnosis, budget allocation, creative analysis, fatigue planning, simulation, attribution, historical evidence, and quality review.
---

# Marketing Swarm Router

Route a marketing question to the smallest useful set of specialist Skills. Do not answer every request with every Skill.

## First classify the job

Identify one or more of these jobs:

- **diagnose**: performance drop, pacing, spend anomaly, account health, delivery instability -> `campaign-diagnostics`
- **allocate**: budget split, platform mix, marginal spend, media opportunity -> `budget-media-allocation`
- **decode creative**: understand why ads differ, identify hook/promise/proof/CTA patterns -> `creative-genome-analysis`
- **refresh creative**: fatigue, decay, rotation, next variants, test matrix -> `creative-fatigue-mutation`
- **forecast**: what-if, sensitivity, expected ranges, budget scenarios -> `scenario-simulation`
- **test causality**: attribution, incrementality, lift, confounders, counterfactual claims -> `causal-attribution`
- **compare history**: past campaigns, benchmarks from supplied history, reusable lessons -> `marketing-memory`
- **review decision**: check evidence quality, contradictions, risk, overclaiming -> `decision-quality-gate`

## Evidence inventory

Before routing, identify what is actually available:

- business objective and primary KPI
- platform/account/campaign/ad set/creative grain
- reporting period and comparison period
- spend, impressions, clicks, conversions, revenue or value
- attribution window/model where relevant
- creative identifiers and launch dates where relevant
- prior tests, holdouts, experiments, or historical campaigns
- known constraints: budget floors, inventory, geography, policy, learning phase, margin, capacity

Do not block on every missing field. Continue with the evidence available and state which missing fields materially lower confidence.

## Routing principles

1. Use the narrowest specialist that can solve the job.
2. Parallelize independent analyses when the host supports it, but reconcile them before answering.
3. Do not treat platform-reported attribution as causal proof.
4. Do not treat a forecast as observed evidence.
5. Do not recommend a budget shift without checking whether the apparent winner is affected by volume, learning, attribution, inventory, or creative fatigue.
6. For high-impact decisions, invoke `decision-quality-gate` before finalizing.

## Standard answer frame

For multi-Skill work, return:

- **What changed**: the observed pattern
- **Most likely explanations**: ranked, with evidence for/against
- **What is uncertain**: missing evidence or confounders
- **What to do next**: prioritized actions/tests
- **Decision thresholds**: what result would make you continue, stop, scale, or reverse

If a compatible host app can make campaign changes, analysis and execution remain separate. Never turn a recommendation into a live mutation without explicit user authorization for the material change.
