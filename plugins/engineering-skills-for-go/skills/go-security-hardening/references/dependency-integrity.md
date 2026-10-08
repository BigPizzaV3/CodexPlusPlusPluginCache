# Dependency and build integrity

Treat a dependency update as a change to executable authority, not a version-string edit.

## Separate the guarantees

- The Go command checks downloaded public-module content against `go.sum` and, for a previously unseen hash, the checksum database by default. This authenticates repeatable bytes; it does not establish that the maintainer, release, or source is benign.
- `go mod verify` detects changes to downloaded module archives and extracted cache directories relative to hashes recorded when they entered the cache. It does not download every missing module, adjudicate source trust, or scan for vulnerabilities.
- `govulncheck` narrows known Go vulnerability reports using symbol reachability. A clean result is bounded by the vulnerability database, analyzed build configuration, source or binary mode, and current tool/database; it is not proof of absence.
- A release checksum identifies artifact bytes. Provenance links an artifact to a builder, build definition, parameters, and resolved inputs; its strength depends on the builder and verification policy.

## Find bypasses and omitted inputs

Review `GOSUMDB`, `GONOSUMDB`, `GOPRIVATE`, `GOPROXY`, `GONOPROXY`, `GOINSECURE`, `GOVCS`, `GOWORK`, and `-mod` settings as part of the build contract. `GOSUMDB=off` or an overbroad `GONOSUMDB` removes first-use public checksum verification. Private-module exclusions avoid leaking private paths, but require an explicit trusted proxy or source/authentication policy.

Inspect every `replace`, workspace, vendor, and local path. A local replacement has no module version and is outside public checksum authentication; it can be valid for development while making a release depend on uncommitted local bytes.

The module graph does not cover every executable build input. Inventory generators, tool directives, checked-in generated files, cgo libraries, compilers, container bases, CI actions, downloaded scripts, release configuration, and environment-selected workspaces. Pin or constrain them at the authority boundary and record enough provenance to explain the resulting artifact.

## Review an update

Establish why the dependency is needed, the selected module graph and build tags, source and release identity, maintenance and ownership changes, license, vulnerability evidence, generated diffs, behavior changes, and rollback. Prefer a narrow verified update over a blanket graph upgrade. Preserve the project's private-module privacy boundary while keeping public-module authentication enabled.
