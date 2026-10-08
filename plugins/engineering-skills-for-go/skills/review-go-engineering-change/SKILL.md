---
name: review-go-engineering-change
description: "Use for general Go diff/PR review. Do not use when distributed-systems or fintech correctness dominates."
license: Apache-2.0
compatibility: "Go 1.24 or newer; changed repository contracts outrank generic conventions."
---

# Review a Go engineering change

Review behavior created by the diff, not resemblance to a checklist.

## Establish scope

Inspect changed code and only the callers, callees, schemas, configs, tests, and history needed to determine the changed contract. State the input, decision, side effects, output, and compatibility surfaces.

Load the focused engineering skills for the risks actually present; this review skill sets finding quality and precedence rather than duplicating their conditional guidance.

## Trace applicable risk

- Language: aliasing, mutation, nil and zero values, error identity, interface method sets, generics, overflow.
- API: exported behavior, serialization, config defaults, mixed versions, migrations, rollback.
- Boundary: validation, authorization, body/stream lifetime, cancellation, protocol status, shutdown.
- Verification: missing oracle for a changed invariant, nondeterminism, mocks standing in for claimed dependency semantics.
- Performance: unbounded allocation or work on a reachable path; do not report speculative micro-optimization.
- Security: attacker-controlled input reaching authority, storage, execution, filesystem, or network destinations.
- Operations: readiness, telemetry, overload, recovery, and incident ambiguity.

When concurrency, persistence, messaging, leases, or money movement dominates the change, route to the corresponding distributed or fintech review skill.

## Write findings

Each finding needs a tight changed line, trigger, impact, causal mechanism, and smallest correction. Rank severity from impact and plausible reachability. Report defects and material risks; omit preferences unless requested. Do not demand tests, interfaces, comments, abstractions, or retries by default.

Read [references/finding-standard.md](references/finding-standard.md) before finalizing findings.

## Output contract

Lead with actionable findings in descending severity. If none exist, say so and name only significant residual uncertainty. Never claim a check ran when it did not.
