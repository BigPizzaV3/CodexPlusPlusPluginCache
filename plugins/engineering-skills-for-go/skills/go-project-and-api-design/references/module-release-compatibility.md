# Module release compatibility

A semantic-version label describes an intended compatibility boundary; it does not prove that consumers can upgrade. Freeze the old release, candidate commit, module path, minimum Go version, supported platforms, and consumer contracts before deciding the release number.

## Inventory the real surface

Review more than exported names:

- package and module import paths, exported declarations, function signatures, method sets, interface implementations, type identity, assignability, and generic constraints;
- exported struct fields and literals, including external keyed and unkeyed construction;
- sentinel and typed error identity, `errors.Is`/`errors.As` behavior, cancellation, nil and zero-value behavior, defaults, ordering, ownership, concurrency safety, and side effects;
- serialized fields, enum values, database or event schemas, configuration keys, environment variables, CLI flags, generated clients, and protocol behavior;
- the declared `go` and `toolchain` requirements and transitive module-graph changes.

Compilation catches only part of this surface. A change can compile while breaking error handling, wire data, resource ownership, or an operational default. Conversely, not every behavior change is avoidable: document intentional corrections and provide a migration when consumers may depend on the old behavior.

The Go 1 compatibility promise governs future Go language and standard-library releases, with stated exceptions. It does not automatically grant the same promise to a third-party module, its tools, its performance, or its external protocols.

## Choose the version boundary

For a stable `v1+` module, prefer additive evolution or a deprecation bridge when it preserves a coherent contract. Adding a method to a published interface breaks external implementations. Removing or changing an exported declaration breaks source consumers. Adding an exported struct field can break unkeyed literals and may change encoding or comparison behavior, so do not treat it as universally harmless.

A breaking `v2+` release is a distinct module: append `/vN` to the module path and to imports, and use matching tags. Plan for old and new majors to coexist in one build graph. State the support and security-fix policy for the old major; a new major does not migrate users automatically.

A type alias can preserve type identity while code moves, but it is a staged compatibility tool, not proof that constructors, variables, errors, side effects, documentation, or import paths remain equivalent. Check for import cycles and define when the old package will be deprecated or retained.

## Prove the release from the consumer side

Build a matrix that includes:

1. representative external consumers compiled and exercised against the last supported release and the candidate;
2. old and new major versions imported together when coexistence is expected;
3. the minimum supported Go version and current guidance versions without a workspace or accidental local `replace` masking publication errors;
4. module zip contents, license and generated artifacts, internal self-imports, examples, and installation from the intended proxy or repository path;
5. behavioral contracts that compilation cannot see, including errors, defaults, serialization, cancellation, ownership, and resource lifecycle.

Use a pre-release for feedback. If a published version is unusable or unsafe, publish a corrected version and use module retraction only as an ecosystem signal with a precise rationale; do not rewrite an immutable tag.

## Cutover and rollback

Publish the new major before removing old paths. Provide mechanical import and API migration guidance, mixed-major risk, rollback conditions, and data or protocol compatibility across versions. If old and new code share storage or messages, use expand/migrate/contract sequencing independently of the module tag.

Release evidence should identify the source commit, tag, module path, Go matrix, consumer fixtures, compatibility findings, artifact hashes, and unresolved behavior changes. A green producer repository alone is insufficient evidence.
