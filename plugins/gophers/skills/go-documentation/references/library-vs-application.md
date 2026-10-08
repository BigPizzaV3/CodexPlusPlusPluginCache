# Library vs Application Documentation

The shape of "good documentation" depends on the project. A library's surface is its exported API; an application's surface is its CLI flags, environment variables, and ops behaviour.

## Detect Project Type

Quick test:

```bash
# library: no main package
$ go list -f '{{.Name}}' ./... | grep -v '^main$' | head

# application: at least one main
$ go list -f '{{.Name}}' ./... | grep '^main$'
```

Some repos are **both** — a library that also ships a CLI under `cmd/`. Document both surfaces; do not let one starve the other.

## Library Documentation

Surface:

- **godoc on every exported name** — packages, types, functions, methods, constants, sentinel errors.
- **`Example*` test functions** for the common entry points — they appear on `pkg.go.dev` next to the symbol and are verified by `go test`.
- **README** with: one-paragraph summary, install (`go get`), minimal usage example, link to `pkg.go.dev`.
- **`pkg.go.dev` rendering check** — view the rendered docs before tagging a release. Catch broken headings, missing examples, accidental TODOs.
- **Optional documentation site** (Docusaurus, MkDocs) for large libraries with guides + reference + how-tos.

```bash
go doc ./...                      # quick local preview
godoc -http=:6060                 # full browse (legacy)
pkg.go.dev/github.com/you/proj    # the canonical view
```

Things readers expect to find in a library README:

- The single most common usage pattern, runnable.
- The minimum supported Go version.
- Concurrency safety statement ("safe for concurrent use" or "not safe — see …").
- Stability promise (semver, breakage policy).

## Application/CLI Documentation

Surface:

- **`--help` is the primary documentation.** It's the first thing every user reads and the only thing many users will read. Make it complete: every flag, every subcommand, sensible examples in the footer.
- **Installation paths** — pre-built binaries (GoReleaser), `go install`, `brew install`, Docker image, package manager (apt/yum). Document each that you support.
- **Configuration** — every env var, every config-file key, every CLI flag — in one table. Include defaults and example values.
- **Behaviour docs** — exit codes, signal handling (`SIGTERM` → graceful shutdown?), file/directory layout.
- **Operations guide** for daemons — metrics endpoint, log format, health checks, upgrade procedure.

A `--help` should look like this:

```
widgetctl - manage widgets

Usage:
  widgetctl [flags] <command>

Commands:
  list       List widgets
  create     Create a widget
  delete     Delete a widget by id

Flags:
  --config string   Path to config file (default: $HOME/.widgetctl.yaml)
  --verbose         Verbose output
  --version         Print version and exit

Examples:
  widgetctl list --verbose
  widgetctl create --name foo --kind bar
```

Use a library that gives you this for free (`spf13/cobra`, `urfave/cli`, `kong`) — do not hand-roll flag parsing.

### Configuration Table

A README table is the lowest-friction way to document the full config surface:

| Env var | Flag | Default | Description |
|---|---|---|---|
| `WIDGET_ADDR` | `--addr` | `:8080` | listen address |
| `WIDGET_LOG_LEVEL` | `--log-level` | `info` | one of `debug`, `info`, `warn`, `error` |
| `WIDGET_TIMEOUT` | `--timeout` | `30s` | per-request timeout |

## API Documentation

If the application exposes an API, generate machine-readable specs and link them:

| API | Format | Tooling |
|---|---|---|
| REST | OpenAPI 3.x | `swaggo/swag` (annotations) or hand-write the YAML |
| gRPC | proto + reflection | `buf`, `grpc-gateway` |
| Async messaging | AsyncAPI | hand-write or code-gen |

Prefer specs generated from code annotations — they cannot drift out of sync.

## Universal Files (Both Project Types)

- **README** — covered above.
- **LICENSE** — file at the repo root. Match the SPDX identifier in any metadata.
- **CONTRIBUTING.md** — how to build and submit changes.
- **CHANGELOG** — what changed per release.
- **CODE_OF_CONDUCT.md** — if you accept external contributions.
- **SECURITY.md** — how to report vulnerabilities responsibly.

## Anti-Patterns

- Documenting a library by linking to a blog post instead of writing godoc.
- A CLI whose `--help` says "see the website" — the user is already at the wrong place.
- Mixing "user-facing" documentation with "implementation notes" in the same README section.
- Configuration scattered across `--help`, environment variables, and a separate config-file format — pick one table that lists all three.
- Versioned docs (v1, v2) that no longer match the current code.
