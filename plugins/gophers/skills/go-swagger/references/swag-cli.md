# swag CLI

The `swag` command parses Go source annotations and writes `docs/docs.go`, `docs/swagger.json`, `docs/swagger.yaml`.

## Install

```bash
go install github.com/swaggo/swag/cmd/swag@latest
```

Pin the version in `tools.go` to keep all developers (and CI) generating the same output:

```go
//go:build tools
package tools

import _ "github.com/swaggo/swag/cmd/swag"
```

Then:

```bash
go tool swag init -g cmd/api/main.go
```

## Frequent Flags

| Flag | Purpose |
|---|---|
| `-g <file>` | Where to find the general API info annotations. Defaults to `main.go` in cwd. |
| `-d <dirs>` | Comma-separated source dirs to scan. Defaults to cwd. |
| `-o <dir>` | Output directory (default `docs`). |
| `--parseDependency` | Resolve types defined in vendored or external packages. |
| `--parseInternal` | Allow scanning packages under `internal/`. |
| `--parseDepth N` | How deep to walk struct dependencies (default 100). Lower if generation is slow. |
| `--instanceName <name>` | Generate multiple separate specs in the same binary (`v1`, `v2`). |
| `--ot` | Output types: `go,json,yaml` (default all three). |
| `--exclude <paths>` | Skip directories during scanning. |

## Typical Layout

```
cmd/api/main.go         # @title, @host, @securityDefinitions
internal/transport/http/
    orders_handler.go   # @Summary, @Param, @Success on handler funcs
    customers_handler.go
docs/                   # generated; do not edit
```

For a monorepo where each binary has its own spec:

```bash
swag init -g cmd/api-public/main.go -d ./cmd/api-public,./internal/public -o cmd/api-public/docs --instanceName public
swag init -g cmd/api-admin/main.go  -d ./cmd/api-admin,./internal/admin   -o cmd/api-admin/docs  --instanceName admin
```

Each spec is registered under its own instance name; the framework integration picks the one to mount.

## Format

```bash
swag fmt                # rewrite annotation comments (like gofmt for swag)
swag fmt -g cmd/api/main.go
```

Run before commit. The formatter aligns columns and keeps the diff stable when annotations grow.

## Makefile Integration

```makefile
SWAG := go tool swag

.PHONY: docs
docs:
	$(SWAG) fmt -g cmd/api/main.go
	$(SWAG) init -g cmd/api/main.go --parseDependency --parseInternal -o docs

.PHONY: check-docs
check-docs: docs
	@if [ -n "$$(git status --porcelain docs)" ]; then \
		echo "docs/ is stale; run 'make docs' and commit"; \
		git --no-pager diff docs; \
		exit 1; \
	fi
```

Wire `check-docs` into CI. Stale docs is the most common Swagger bug; this catches it.

## go generate

```go
//go:generate go tool swag init -g main.go --parseDependency --parseInternal
package main
```

Then `go generate ./...` regenerates as part of the standard Go toolchain. Useful in IDE workflows.

## Common Issues

- **"cannot find type definition: X"** — the type is in an external package; add `--parseDependency`.
- **"cannot find type definition: internal/..."** — you're scanning a non-internal location; add `--parseInternal` or `-d ./internal/...`.
- **Slow generation** — `--parseDepth` and `--exclude` cut scan time. Avoid `--parseDependency` if not needed.
- **Generic types unresolved** — requires swag v2 and Go 1.21+. Re-run with the latest CLI.
- **`docs.go` causes `import cycle`** — never import the docs package from packages it depends on. Keep the import in `main.go`.

## Versioning the Spec

For a public API, expose the spec at a stable path:

```go
mux.Handle("/openapi.json", http.FileServer(http.Dir("docs/")))
```

Pin clients to that version. When you bump the API, generate a `v2` spec via `--instanceName v2` and mount alongside.
