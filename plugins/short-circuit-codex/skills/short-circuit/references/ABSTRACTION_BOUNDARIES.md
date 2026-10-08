# Abstraction Boundaries

Use these rules when deciding what belongs in core, what belongs in adapters/examples, and how much abstraction is justified.

## Reference Discipline

External references are not automatically design authority.

When using a reference repo, article, prior ChatGPT output, or another tool's design:

- state whether it is authority, evidence, inspiration, or weak signal
- extract useful ideas without blindly copying architecture
- keep the user's product intent above external suggestions
- compare designs without letting the reference own the local design
- avoid forcing a reference pattern into a system where it does not fit

Use references to sharpen judgement, not to outsource design ownership.

Reference prompt shape:

```text
Read <reference> for perspective. Do not copy its architecture.
Extract feature ideas, tradeoffs, and risks. Keep this repo's product intent authoritative.
```

If a reference conflicts with the user's stated intent, explain the conflict and keep the user's intent first unless they explicitly revise it.

## Generic Primitive Vs Case-Specific Patch

For every real-world example or failing scenario, ask:

- Is this need repeated across possible users or only this case?
- Is the fix a framework primitive, adapter behavior, example glue, or test fixture?
- Would this make the core more general or more polluted?
- Can the real scenario be expressed cleanly without adding domain-specific logic to core?

Rules:

- Extract a generic primitive when the same need appears across scenarios.
- Keep domain-specific work in examples, adapters, fixtures, or user code.
- Do not make core own CUDA, a specific benchmark, a specific IDE quirk, or a specific provider unless the product explicitly owns that domain.
- Dogfood real examples to discover primitives, not to smuggle example-specific logic into core.

Decision examples:

- Weak: add `run_cuda_benchmark()` to core because the dogfood script uses CUDA.
- Strong: add a repeated-measurement primitive that accepts any callable, then keep CUDA setup in the example.
- Weak: special-case one editor hover issue.
- Strong: fix the shared language-server model so all IDE features use the same truth.

## Public API Surface

Prefer a small public API with rich semantic payload.

When simplifying API surface:

- remove redundant entry points
- preserve metadata
- preserve schema and docstring-derived descriptions
- preserve sync/async contracts
- preserve adapter-specific conversion behavior
- keep native conversion logic in the right adapter layer

Do not trade API simplicity for silent metadata loss.

API simplification example:

- Weak: collapse `register_python_tool` and `register_tool` by discarding adapter-specific schema metadata.
- Strong: expose one `register_tool` entry point while retaining docstring parsing, field descriptions, return metadata, and adapter-specific native conversion.

## Scope Guardrails

Scope control is two-sided:

- Do not add extra logic, features, helpers, abstractions, or integrations beyond the approved plan.
- Do not use "avoid extra work" as an excuse to skip required behavior, metadata, tests, cleanup, or docs.

When the user says "do not overcomplicate this", still implement the required behavior fully.

When the user gives a narrow task, do not invent adjacent architecture unless it is required to solve the task correctly.

Scope prompt shape:

```text
Implement the requested behavior fully.
Do not add adjacent features.
Do not skip required metadata/tests/docs because the scope is narrow.
```

## Overengineering Smells

Challenge these patterns:

- two public surfaces where one normalized surface is enough
- wrappers that only mirror another function
- protocols that wrap a concrete type without meaningful decoupling
- helper functions used once without reducing complexity
- lazy import or fallback logic that hides real API boundaries
- "future-proof" abstractions without a current extension need

Prefer direct imports, explicit contracts, and narrow composition unless a real extension point exists.

Review question:

```text
Is this abstraction removing real duplication or expressing a real extension point,
or is it only making the code look more architected?
```
