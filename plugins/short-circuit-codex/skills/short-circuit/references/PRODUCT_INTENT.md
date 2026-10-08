# Product Intent

Use these rules when framing work as product engineering instead of isolated task completion.

## North Star First

Before implementing non-trivial work, state the product intent:

- why the feature exists
- which user or developer workflow it improves
- what real scenario proves the feature is valuable
- what the feature must not become
- which constraints define success

Do not frame framework, SDK, DSL, LSP, benchmark, optimizer, or documentation work as a one-off code change. Frame it as a product surface with a user-facing contract.

Good kickoff shape:

```text
This is not just fixing <specific failure>. The product intent is <north star>.
The real user workflow is <workflow>. The feature must not become <non-goal>.
Use <real example> as the proof that the abstraction works.
```

Bad kickoff:

```text
Fix this error and update whatever is needed.
```

## Feature Purpose

When introducing or changing a feature:

- identify the real product primitive behind the request
- explain how the primitive will be reused
- define the behavior that users should experience
- preserve the long-term product direction over local fixes
- avoid local optimum changes that only satisfy the immediate failing case

For framework work, ask: "Does this make the intended real-world script or workflow easier, clearer, and more reliable?"

Example:

- Weak: "Add benchmark support for this CUDA script."
- Strong: "Use this CUDA script to discover missing generic benchmark primitives. Do not add CUDA-specific logic to core unless the framework explicitly owns CUDA."

## Docs And Examples Are Product

Treat docs, examples, and release notes as product surfaces, not afterthoughts.

Good examples should:

- run
- use realistic data or realistic workflows
- demonstrate the actual value proposition
- stay current with the public API
- avoid being shallow syntax demos
- expose missing primitives when the framework is awkward to use

Prefer real dogfood examples over mock examples once the core surface is stable enough.

Example standards:

- Weak example: a toy function that only proves the import path works.
- Strong example: a real benchmark, real CLI run, real tool registration, or representative dataset flow that would catch missing primitives.
- Weak docs: "Here is the syntax."
- Strong docs: "Here is the shortest real workflow, why each object exists, and how to extend it without leaving the intended API."

Docs should be:

- current
- executable where practical
- specific to the actual API
- clear about basic, intermediate, and advanced usage
- aligned with the package's release state

## Release Readiness

Release readiness means more than code passing locally. Check the surrounding ecosystem:

- docs
- examples
- changelog or release notes
- package metadata
- lockfile consistency, when a lockfile is part of the release surface
- CI workflows
- coverage and type-check gates
- pre-commit or production checks
- editor extension revision pins, when relevant
- README and contribution instructions

Do not call a package or tool ship-ready while its install path, metadata, docs, examples, or distribution workflow is stale.

Release prompt shape:

```text
Check release readiness as a product surface:
- install path
- README/docs examples
- package metadata
- lock/rev consistency
- CI gates
- publishing workflow
- stale/orphan files
Report gaps before changing code.
```

## Product Owner Behavior

When acting as product owner:

- keep the user-facing workflow visible during implementation
- reject changes that make the code pass while making the product less coherent
- use real examples to test whether the abstraction works
- preserve semantic clarity over superficial compatibility
- ensure surrounding docs and examples explain the intended experience

The goal is not more features. The goal is a coherent, usable product primitive.
