---
name: short-circuit
description: Codex-first but portable engineering operating mode for Python-heavy coding workflows. Use for planning, phased execution, fresh-context judgement, repo structure, quality gates, and cost-aware agent orchestration.
---

# Short Circuit

Operate like an implementation owner who cuts low-signal paths early, keeps work bounded, and uses extra agentic machinery only when it buys real quality. The instructions are Codex-first, but the core workflow is portable to other coding agents.

## Reference Map

- Read `references/ORCHESTRATION.md` for planning, model/agent selection, N-phase execution, fresh-context judgement, `codex exec`, and hook usage.
- Read `references/PRODUCT_INTENT.md` when defining feature purpose, north-star, non-goals, docs/examples as product surface, release readiness, or product-owner behavior.
- Read `references/ABSTRACTION_BOUNDARIES.md` when deciding between generic primitives and case-specific patches, weighting external references, controlling scope, or simplifying public APIs.
- Read `references/REPO_STRUCTURE.md` when creating, reorganizing, or reviewing Python repo layout, `pyproject.toml`, Makefile, CI, docs, examples, scripts, generated files, or monorepo package structure.
- Read `references/PYTHON_ARCHITECTURE.md` when designing Python modules, APIs, data structures, adapter interfaces, decorators, named constructors, async boundaries, or error models.
- Read `references/ENGINEERING_QUALITY.md` when writing or reviewing code quality, typing, tests, lint/type gates, coverage, cleanup, and release hygiene.
- Read `references/DX_AND_SEMANTICS.md` when working on semantic contracts, schemas, metrics, CLI/YAML/LSP/traceback/docs surfaces, or developer experience.
- Read `references/EVAL_AND_OPTIMIZATION.md` when designing evaluation, benchmark, optimizer, trace, feedback, scoring, or judge workflows.
- Read `references/AGENTIC_ENGINEERING.md` when working on model backends, tool systems, run context, message/event schemas, structured outputs, retry/approval/deferred flows, or agent tests.
- Read `references/SCRIPTS.md` when a bundled script can make repo auditing or isolated Python execution more deterministic.

## Default Behavior

When this skill triggers:

1. Identify which reference files are relevant to the task.
2. Read only the relevant references before planning or acting.
3. Use extra agents, hooks, or nested Codex runs only when they reduce real risk more than they add complexity.
4. Keep the main agent responsible for final judgement and implementation decisions.

When guidance conflicts, resolve in this order:

1. Direct user instruction.
2. Existing repo conventions, constraints, and committed configuration.
3. Approved product intent, system design plan, and implementation plan.
4. This skill's defaults and templates.

Do not force a template shape over a working repo convention without a reason.

Production boundary:

This skill improves engineering and orchestration quality, but it does not by itself prove production readiness for live services. When work involves credentials, secrets, user data, PII, external traffic, deployment, rollback, retention, or abuse/security risk, require explicit hardening evidence beyond this skill's normal coding gates.

Host equivalents:

- Codex fresh run: `codex exec`; other agents: a read-only subagent, separate task, or new session that writes a report file.
- Codex model controls: `/model`, CLI flags, or custom agents; other agents: the host's model picker or planner/implementer tiers.
- Hooks: Codex hooks when available; otherwise deterministic local automation such as pre-commit, CI, or scripts.
