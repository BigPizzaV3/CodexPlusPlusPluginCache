---
name: forgemind-innovate
description: "Use when a SaaS team needs disruptive, AI-central USP hypotheses, rather than generic AI features."
---

# ForgeMind Innovate

Use this explicit journey for disruptive SaaS innovation: AI-central product bets, defensible moats, activation, retention, pricing, tenant safety, integration health, and staged release cohorts.

Ask only for a missing product outcome. Do not ask for a technical solution before examining the opportunity report. Then run:

`node <plugin-root>/bin/forgemind.mjs innovation saas --goal "<outcome>" --artifacts workspace --json`

Return the highest-ranked opportunity card, the interaction it replaces, its moat, first experiment, metric, guardrails, kill condition, and the recommended next action. Clearly distinguish imported evidence from repository-aware assumptions.

This command creates local planning evidence only. It does not contact customers, change billing, read production tenants, or invoke external integrations. Hold when tenant scope, permissions, or audit evidence are missing.
