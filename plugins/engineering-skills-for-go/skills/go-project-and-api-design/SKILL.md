---
name: go-project-and-api-design
description: "Use for exported Go APIs, packages, modules, versioning, and compatibility. Do not use for local semantics or wire protocols."
license: Apache-2.0
compatibility: "Go 1.24 or newer; module and toolchain behavior must match the repository's declared versions."
---

# Go project and API design

Organize code around stable behavior and dependency direction, not a universal directory tree.

## Map the dependency graph

Identify the domain decision, its inputs and effects, the outer mechanisms that provide them, and the package that owns each contract. Core behavior should not need to import HTTP, SQL, a broker, or process bootstrap merely to be exercised.

## Design packages

- Give a package one coherent reason to change and a name describing what it provides.
- Keep `internal/` boundaries deliberate; they control import visibility, not architecture quality.
- Avoid catch-all `util`, `common`, `models`, and `interfaces` packages.
- Put interfaces with consumers unless an external implementation contract requires otherwise.
- Use `cmd/<name>` for multiple binaries when useful; keep `main` thin enough that startup can report errors deterministically.

## Design APIs from caller decisions

- Make zero values useful when that is cheap and unambiguous; otherwise require construction.
- Use functional options for a growing set of independent optional settings, not required arguments or every constructor.
- Validate immutable configuration at startup and distinguish secret values from ordinary settings. For reloadable configuration, parse and validate a complete candidate snapshot before atomic publication; retain the last known-good snapshot on failure.
- Return concrete types unless callers need substitution at that boundary.
- Preserve error, cancellation, and ownership contracts in names and documentation.

## Manage evolution

Treat exported Go APIs, serialized fields, schemas, config keys, CLI flags, and default behavior as compatibility surfaces. For breaking storage or protocol changes, design expand/migrate/contract steps that tolerate mixed versions and rollback.

Pin CI and release inputs by immutable versions. Keep generated files reproducible and make the source of truth explicit. Do not add dependencies or frameworks without a demonstrated capability or maintenance benefit.

Read [references/api-evolution.md](references/api-evolution.md) for compatibility and constructor decisions. For a public-module release or major-version migration, use [references/module-release-compatibility.md](references/module-release-compatibility.md) to inventory consumer-visible contracts and prove the cutover outside the producer repository.

## Output contract

State the dependency invariant, compatibility constraints, and smallest design that satisfies them. Avoid architecture ceremony, speculative abstractions, and repository-wide reshaping.
