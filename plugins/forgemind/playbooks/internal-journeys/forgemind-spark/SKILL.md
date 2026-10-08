---
name: forgemind-spark
description: "Use when you need to brainstorm disruptive options, frame a hard problem, run design thinking, craft a product story, or prepare a decision-ready pitch before Explore, Radical, Product, or Plan."
---

# Spark

When invoked without user text, load `playbooks/zero-input-defaults.md` and execute **Spark**. Do not ask what to brainstorm; derive the project opportunity and state it as a zero-input default.

Choose the smallest mode that creates a decision-ready artifact:

- **Brainstorm**: diverge, cluster, converge, then retain the strongest options and their assumptions.
- **Problem Solve**: define the job, causes, constraints, counter-hypotheses, and reversible solution experiments.
- **Design Thinking**: empathize, define, ideate, prototype, and test one observable outcome.
- **Story**: create a customer, product, launch, or investor narrative with audience, tension, proof, and call to action.
- **Pitch**: create a decision memo, demo flow, stakeholder brief, or sales pitch with evidence and an explicit ask.

Run `node <plugin-root>/bin/forgemind.mjs spark run --goal "<outcome>" --artifacts workspace --json`. Inspect the app and existing evidence first; mark all missing user, market, or competitor knowledge as assumptions. Do not use generic chatbot ideas as differentiation. Every selected direction requires a target audience, differentiator, evidence basis, metric, kill condition, and next handoff.

Hand off an existing application transformation to `$forgemind-evolve`, a commercial question to `$forgemind-venture`, a contested choice to `$forgemind-council`, and an approved thin slice to `$forgemind-ship`.
