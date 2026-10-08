---
name: go-language-engineering
description: "Use for local Go semantics, errors, interfaces, generics, and data. Do not use for exported API evolution."
license: Apache-2.0
compatibility: "Go 1.24 or newer; current guidance targets Go 1.25 and 1.26, with older forms labeled legacy."
---

# Go language engineering

Make the code expose ownership, mutation, failure, and control flow. The specification defines validity; conventions are evidence about clarity, not universal laws.

## Establish the local contract

Before editing, identify the inputs, zero-value behavior, aliasing, mutation, error identity, concurrency exposure, and exported compatibility. Follow established public behavior unless the request changes it.

## Choose representations from invariants

- Use a value when copying is meaningful and identity is irrelevant; use a pointer when shared identity, mutation, or absence is contractual.
- Treat slices and maps as descriptors over shared storage. Copy at trust or ownership boundaries when later mutation would violate the contract.
- Preserve `nil` versus empty only when serialization or API behavior distinguishes them.
- Use a struct when fields form one invariant; avoid parallel slices and loosely related maps.
- Introduce generics only when one algorithm genuinely applies across types without erasing domain meaning.
- Define interfaces at the consumer boundary and keep them as small as the required behavior permits.

## Make failure inspectable

- Add context with `%w` when callers need causal inspection; use `%v` when intentionally hiding the underlying identity.
- Choose sentinel, typed, or opaque errors from the caller decision, not from habit.
- Return or log an error at one owning boundary. Never string-match an error contract.
- Reserve panic for violated internal invariants or startup failure where continuing is unsafe; recover only at an isolation boundary.

## Keep control flow causal

Prefer guard clauses when they make the main path visible. Keep variables in the smallest useful scope, but do not compress logic until shadowing or mixed responsibilities become hard to see. A switch is useful when it represents one classification; chained conditions are fine when they express a sequence.

## Reject universal style claims

Do not require pointers for every struct, interfaces for every dependency, constructors for every type, channels over mutexes, or named returns by default. Each is conditional. Preserve compatible repository conventions when alternatives are equally correct.

Read [references/decision-record.md](references/decision-record.md) for API, generics, and error counterexamples. When a slice, map, view, or pooled buffer crosses a lifetime or trust boundary, read [references/memory-ownership-and-aliasing.md](references/memory-ownership-and-aliasing.md) and name the borrow, transfer, sharing, or snapshot contract.

## Output contract

For implementation, make the smallest coherent change and keep semantic ownership visible. For review, cite the concrete input or call path that breaks an invariant. Separate correctness from optional style.
