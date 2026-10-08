# CI Integration

A linting setup that is not enforced in CI is decoration. This reference covers GitHub Actions, pre-commit hooks, and the incremental-adoption patterns that keep large legacy codebases from drowning the team in findings.

## GitHub Actions

The maintained `golangci/golangci-lint-action` handles install, cache, and version pinning:

```yaml
# .github/workflows/lint.yml
name: lint

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  pull-requests: read

jobs:
  golangci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: stable
          cache: true
      - uses: golangci/golangci-lint-action@v6
        with:
          version: v2.0.0   # pin; bump deliberately
          args: --timeout=5m
```

Pin the version (`v2.0.0`, not `latest`) and bump in a dedicated PR — that way upgrades surface their findings on a single commit.

For pull-request-only linting on changed code:

```yaml
      - uses: golangci/golangci-lint-action@v6
        with:
          version: v2.0.0
          only-new-issues: true   # honours new-from-rev under the hood
```

## Pre-commit hooks

Local feedback is the cheapest. A pre-commit hook on `--new-from-rev` lints only what's about to be committed:

```sh
#!/bin/sh
# .git/hooks/pre-commit
exec golangci-lint run --new-from-rev=HEAD ./...
```

Or, using the `pre-commit` framework:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/golangci/golangci-lint
    rev: v2.0.0
    hooks:
      - id: golangci-lint
        args: [--new-from-rev=HEAD]
```

## Incremental adoption on legacy code

Turning lint on for a large codebase from a cold start produces thousands of findings. Two strategies make this manageable.

### 1. `new-from-rev`

In `.golangci.yml`:

```yaml
issues:
  new-from-rev: origin/main
```

Now `golangci-lint run` only reports findings on lines that differ from `origin/main`. Legacy code is grandfathered; new and modified code must meet the bar. Drop this setting once the legacy backlog is cleared.

### 2. Path-scoped exclusions

For directories you cannot touch yet:

```yaml
linters:
  exclusions:
    paths:
      - cmd/legacy/
      - vendor/
      - testdata/
```

Combine with `--new-from-rev` for the active code paths.

### 3. Per-linter ramp

Start with the minimum set, ship a clean build, then add one linter at a time in its own PR. Each PR has a single category of findings to address, which is much easier to review than "we enabled 30 new linters."

## Caching

`actions/setup-go@v5` already caches the module download and build cache. `golangci-lint-action` adds a second cache for the lint result database. The combined effect is:

- First run on a clean cache: 1–3 minutes for a medium-sized service.
- Subsequent runs with no changes: 10–30 seconds.

If CI feels slow, check `--verbose` output: the linters with the longest runtimes are usually `staticcheck`, `gosec`, and the complexity bundle.

## Required vs advisory checks

Make `lint` a required status check in branch protection. Once a project's lint is green, every new lint failure is either:

- a regression worth fixing, or
- a deliberate suppression with a documented reason.

Both should appear in the PR diff.

## Reporting

The default output is `path:line:col: message (linter)`. CI-friendly formats:

```bash
golangci-lint run --output.tab.path=stdout ./...     # tab-separated
golangci-lint run --output.json.path=lint.json ./... # JSON
golangci-lint run --output.checkstyle.path=lint.xml ./...
```

GitHub Actions auto-annotates PRs when the action is used; nothing extra needed.

## Drift prevention

Two periodic chores:

1. Bump the pinned `golangci-lint` version every quarter or two. New checks land; old checks get smarter.
2. Re-audit the `//nolint` directives (see [nolint-directives.md](nolint-directives.md)) — `nolintlint` with `allow-unused: false` finds stale ones.

A linting setup, like a test suite, rots if untended.
