---
name: reef-agent-improvement
description: Use when the user asks to design, evaluate, troubleshoot, or operate a continual-learning or self-improvement
  workflow for AI agents using Reef.
license: Apache-2.0
compatibility: Guidance works anywhere; executing Reef requires Python 3.10+, the reef-infra runtime, and any additional dependencies
  required by the chosen recipe.
---

# Reef Agent Improvement

## Overview

Use this skill to work with **Reef**, the continual-learning infrastructure for self-improving agents. Reef connects live inference, recorded interactions, feedback, learning/update jobs, evaluation, and versioned artifact delivery.

Treat the bundled reference files as the source of truth for Reef-specific commands and configuration. Do not infer undocumented flags, APIs, or installation state.

## When to Use

Use Reef-oriented guidance when the task involves one or more of these needs:

- improving an agent harness over repeated interactions;
- learning from scored or structured feedback;
- evolving prompts, rules, skills, or other harness artifacts;
- model-weight training through a supported recipe;
- test-time training or search with a measurable objective;
- managing versioned agent artifacts and accepted updates;
- integrating a harness adapter, processor, executor, recipe, or evaluation policy;
- diagnosing a Reef deployment, configuration, or feedback pipeline.

Do not introduce Reef for a one-off prompt edit, a simple static agent, or a task with no repeated feedback/evaluation loop unless the user explicitly asks for Reef.

## Runtime Check

Before giving commands that assume Reef is installed, inspect the environment when tool access is available. Suitable checks include:

```bash
python --version
python -c "import reef; print(getattr(reef, '__version__', 'reef import OK'))"
reef --help
```

If the runtime is unavailable, explain that the plugin supplies **guidance and references**, not the Reef package itself. Use `references/installation.rst` and `references/quickstart.rst` for setup guidance rather than pretending execution succeeded.

## Workflow Selection

Determine which Reef surface matches the user's goal before proposing configuration:

1. **Harness optimization** — prompts, rules, skills, adapters, or other agent artifacts improve from representative tasks plus evaluation. This generally does not require local training GPUs.
2. **Model-weight training** — a supported trainable model and training stack update weights from eligible feedback.
3. **Test-time training / scientific search** — an execution environment and correctness or objective function drive iterative improvement.

When uncertain, ask what is being improved, how success is measured, and what feedback is available.

## Core Loop

Reason about Reef systems using its four-stage loop:

- **Serve:** handle requests and record interactions.
- **Observe:** associate feedback with recorded interactions and determine eligibility.
- **Grow:** generate candidate updates through the configured recipe/training path.
- **Commit:** evaluate candidates, apply selection policy, and publish accepted artifacts as version history.

Use this model to diagnose where a learning loop is failing instead of changing several layers at once.

## Working Method

1. Read the relevant bundled reference before changing commands or config.
2. Identify the user's current surface: harness, weights, or test-time training.
3. Identify the measurable evaluator or feedback signal.
4. Map the system onto Serve → Observe → Grow → Commit.
5. Make the smallest change that tests one hypothesis.
6. Verify with a health check, evaluator result, artifact/version change, or recipe-specific test.
7. Preserve rollback/version history when proposing changes to a live agent.

## References

Start with the smallest relevant file:

- `references/README.md` — project overview and architecture.
- `references/intro.rst` — conceptual introduction.
- `references/installation.rst` — installation requirements.
- `references/quickstart.rst` — initial end-to-end setup.
- `references/core-loop.rst` — learning-cycle model.
- `references/harness-adapters.rst` — adapting agent harnesses.
- `references/write-a-harness-method.rst` — implementing harness improvement methods.
- `references/write-a-recipe.rst` — recipe authoring.
- `references/configuration.rst` — configuration reference.
- `references/cli.rst` — command-line reference.

## Safety and Accuracy

- Never claim training, evaluation, deployment, or an update succeeded without fresh verification evidence.
- Do not invent Reef configuration keys or CLI flags.
- Do not expose credentials, tokens, or private training data.
- Treat feedback datasets and interaction records as potentially sensitive.
- Prefer reversible, versioned changes to live-agent artifacts.
