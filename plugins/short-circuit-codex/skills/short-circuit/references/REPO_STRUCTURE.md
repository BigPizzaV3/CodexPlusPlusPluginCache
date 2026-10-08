# Repo Structure

Use these rules when creating, reorganizing, or reviewing Python repositories and package layouts.

## Default Python Package Layout

Prefer a `src/` layout for package repos:

```text
.
├── pyproject.toml
├── .python-version
├── .gitignore
├── .pre-commit-config.yaml
├── pyrightconfig.json
├── Makefile
├── README.md
├── LICENSE
├── CHANGELOG.md
├── docs/
├── examples/
├── scripts/
├── src/
│   └── package_name/
│       ├── __init__.py
│       ├── __main__.py
│       ├── _version.py
│       └── py.typed
└── tests/
    ├── conftest.py
    └── test_package_name.py
```

Use this as a starting point, not as a reason to create empty directories. Add `docs/`, `examples/`, `scripts/`, `.github/`, or `packages/` only when the project needs them.

If an existing repo already has `pyproject.toml`, a build backend, package layout, or CI convention, preserve it by default. Move toward this structure incrementally unless the user explicitly approves a migration.

## Root Ownership

Keep repo-level coordination at the root:

- `pyproject.toml`: project metadata, dependencies, build backend, and Python tool config.
- `uv.lock`: ignored by default for reusable template/library repos unless exact builds, applications, CI reproducibility, or production deployment require it.
- `Makefile`: stable command interface for humans, agents, CI, and pre-commit.
- `.pre-commit-config.yaml`: local enforcement entrypoint.
- `pyrightconfig.json`: editor and basedpyright integration surface when the repo benefits from explicit file-based config.
- `.github/workflows/`: CI, docs, and publishing workflows.
- `mkdocs.yml`: docs site config when docs are part of the product.
- `src/package_name/_version.py`: preferred package version source for dynamic versioning.
- `VERSION`: optional release-facing mirror only; never an independent version truth.

Avoid scattering tool configuration across many files unless a tool requires it or the repo already has that convention. Prefer `pyproject.toml` for Ruff, ty, pytest, coverage, and package metadata.

Lockfile policy:

| Repo type | `uv.lock` | CI sync |
| --- | --- | --- |
| reusable library or template | ignored or absent by default | `uv sync --all-extras` unless the repo deliberately commits a lock |
| application, production service, exact build, or release artifact | committed deliberately | `uv sync --frozen --all-extras` |

Do not treat `uv.lock` as universally required. Choose it based on release and reproducibility needs.

## `pyproject.toml` Shape

Prefer:

- `[project]` with `name`, `dynamic = ["version"]`, `description`, `readme`, `requires-python`, license, authors, classifiers, keywords, dependencies, scripts, and URLs.
- `[project.optional-dependencies]` groups:
  - `dev`: `ruff`, `ty`, `basedpyright`, `pytest`, `pytest-cov`, `pytest-asyncio`, `pre-commit`
  - `docs`: `mkdocs-material`, `mkdocstrings[python]` when docs exist
  - `all`: package extra combining relevant optional groups
- `hatchling` as a solid default build backend unless the repo already uses another backend.
- `[tool.hatch.version]` pointing at `src/package_name/_version.py` when dynamic versioning is used.
- `[tool.hatch.build.targets.wheel] packages = ["src/package_name"]`.

Build backend config is backend-specific. For Hatchling, keep the wheel target aligned with the actual `src/` layout and verify the package builds; do not blindly copy build keys between Hatchling, setuptools, Poetry, or PDM.

Do not keep placeholder project URLs, authors, classifiers, or package names. If metadata is unknown, ask or keep the package private until it is known.

## Dynamic Versioning

Prefer dynamic versioning for package repos:

```toml
[project]
dynamic = ["version"]

[tool.hatch.version]
path = "src/package_name/_version.py"
```

Use a dedicated private version module:

```python
from __future__ import annotations

__version__ = "0.1.0"
```

Then re-export the version from `src/package_name/__init__.py`:

```python
from ._version import __version__

__all__ = ["__version__"]
```

Rules:

- Do not hard-code version in both `[project]` and `_version.py`.
- If a root `VERSION` file exists, treat it as a mirror for release ergonomics, not a second source of truth.
- Add `scripts/check_version.py` when both `_version.py` and `VERSION` exist; it should fail if they diverge.
- Add a small `bump.sh` or equivalent release helper only when version bumping is part of the repo workflow.
- Include version consistency in `make prod` or a dedicated `make check-version` target.
- Keep package build config aligned with the dynamic version source.
- In a monorepo, packages that release independently should have their own dynamic version source. Packages that intentionally share the main package's version should derive it from the main package's `_version.py` instead of keeping a second independent `__version__`.

## Tool Config

Ruff:

- `line-length = 100`
- `target-version = "py311"` or the repo's actual floor
- lint families such as `E`, `F`, `I`, `N`, `W`, `UP`, `B`, `C4`, `SIM`
- ignore `E501` when line length is handled by formatter

ty:

- keep `[tool.ty]`, `[tool.ty.environment]`, and `[tool.ty.rules]` in `pyproject.toml`
- set `python-version` to the repo's floor
- only ignore rules deliberately; do not use ty config to hide design issues

basedpyright:

- Keep basedpyright explicit. `pyrightconfig.json` is important when editor integration, `extraPaths`, or cross-tool visibility matters.
- Prefer `pyrightconfig.json` for repos where Cursor/VS Code/Pyright should immediately understand `src/`, exclusions, and Python version.
- `[tool.basedpyright]` in `pyproject.toml` is also acceptable when the repo already standardizes on pyproject-owned tool config.
- Include `src`, `tests`, `examples`, and `scripts` when those directories exist.
- Exclude generated and cache directories.
- Do not disable `reportAny` or similar rules as a reflex. If a repo chooses a permissive setting, it must be a conscious compatibility decision, not a type-silencing default.

pytest:

- Prefer `[tool.pytest.ini_options]` in `pyproject.toml` over a separate `pytest.ini` for new repos.
- Use `asyncio_mode = "auto"` when async tests exist or are expected.
- Set `testpaths = ["tests"]`.
- Use strict markers and concise tracebacks.

Coverage:

- Configure line and branch coverage in `pyproject.toml`.
- Keep coverage thresholds aligned with `ENGINEERING_QUALITY.md`: meaningful behavioral tests first, strict numeric gates after.

## Makefile

Use Makefile targets as a stable public interface:

- `format`: `uv run --extra dev ruff format`
- `format-check`: `uv run --extra dev ruff format --check`
- `check`: `ruff check`, `ty check`, `basedpyright`
- `tests`: `pytest` with line and branch coverage gates
- `pre-commit`: `pre-commit run --all-files`
- `docs`: `mkdocs build --strict` when docs exist
- `serve`: `mkdocs serve` when docs exist
- `serve-check`: docs serve/build validation when there is a meaningful check path
- `prod`: production gate, including format-check, check, tests, pre-commit, and docs when relevant

If an existing repo uses `check-formatted`, keep compatibility if needed, but prefer `format-check` for new repos because it matches the command name.

## Source Package

Inside `src/package_name/`:

- Keep `__init__.py` small and explicit.
- Re-export public API intentionally and maintain `__all__`.
- Include `py.typed` for typed packages.
- Keep `_version.py` private if used as version source.
- Use `__main__.py` only when `python -m package_name` should work; it should delegate to a real `cli.py` entrypoint rather than contain CLI logic.
- Keep CLI code in `cli.py` or a focused CLI module.
- Put domain models, adapters, renderers, providers, and runtime layers in separate modules when they are real boundaries.

Do not create a package module only to mirror imports. Avoid broad `__getattr__` lazy imports unless the repo has a measured reason.

## Tests

Keep tests in `tests/` and test public behavior:

- `tests/conftest.py` for shared fixtures and path setup only when needed.
- `tests/test_<package_or_feature>.py` for behavior tests.
- `tests/cassettes/` for recorded API/LLM interactions when cassettes are used.
- `tests/fixtures/` for reusable static fixtures.

Keep test configuration concerns in `tests/conftest.py` instead of leaking them into individual tests:

- shared fixtures
- temporary path setup
- environment patching
- test config loading
- network/model blocking
- cassette defaults
- common monkeypatch setup

Individual test functions should focus on behavior and assertions. If many tests repeat setup, move it into a typed fixture or helper in `conftest.py`.

Avoid checking in `__pycache__`, `.pytest_cache`, generated coverage output, or temporary scratch files.

## Docs

Use `docs/` for user-facing docs:

```text
docs/
├── index.md
├── getting-started/
├── development.md
├── testing.md
├── release.md
├── api/
└── llms.txt
```

Use `mkdocs.yml` with `strict: true` when docs are part of the product. Prefer `mkdocs-material` and `mkdocstrings[python]` when API docs should be generated from typed Python sources.

Do not commit the built `site/` directory unless the repo intentionally publishes static artifacts that way. Treat `site/` as generated output by default.

## Examples And Scripts

Use `examples/` for small runnable examples that demonstrate public APIs. Examples should not become hidden tests unless they are also covered by real tests.

Use `scripts/` for repo maintenance tools:

- version consistency checks
- release helpers
- repo rename or migration helpers
- cassette refresh helpers
- docs/build utilities

Scripts should be deterministic, documented by Makefile targets when important, and covered by tests when they encode production-relevant behavior.

## GitHub Workflows

Prefer separated workflows:

- `tests.yml`: Python matrix, dependency sync, tests, line and branch coverage. Use `uv sync --frozen --all-extras` only when `uv.lock` is committed; otherwise use an unfrozen sync appropriate for libraries/templates.
- `check.yml`: formatting check, Ruff, ty, basedpyright, build checks when useful.
- `docs.yml`: strict docs build or deploy when docs exist.
- `publish.yml`: tag/manual publish with `id-token: write`, `uv build`, and PyPI trusted publishing.

Use concurrency groups to cancel stale branch/PR runs. Use `astral-sh/setup-uv` in CI.

## Monorepo Layout

Do not choose a monorepo by default. Use a monorepo only when multiple packages genuinely need to live together because of shared development, coordinated releases, local integration tests, or close ownership.

If a monorepo is appropriate, prefer category-based package grouping:

```text
packages/
└── <category>/
    └── <package_name>/
        ├── pyproject.toml
        ├── README.md
        ├── VERSION  # optional mirror only when release tooling needs it
        ├── src/
        │   └── package_name/
        │       ├── __init__.py
        │       ├── _version.py
        │       └── py.typed
        └── tests/
```

Examples of categories: `helpers`, `adapters`, `providers`, `plugins`, `integrations`, `examples`, `benchmarks`, `apps`.

Use categories to communicate role and ownership, not arbitrary nesting. A helper package can live at `packages/helpers/autoptimize`; an adapter can live at `packages/adapters/pydantic-acp`.

Rules:

- Each package should have its own `pyproject.toml` when it can be built, versioned, or released independently.
- If a package shares the root/main package's release version, point its dynamic version config at the main version source or import from that source in a tiny `_version.py` shim. Do not duplicate the literal version across packages.
- Root Makefile/CI should still provide aggregate gates across packages.
- Package-local Makefiles are optional; prefer root commands unless package independence requires local commands.
- Keep shared test fixtures either package-local or in a clearly named root test helper package. Do not create ambiguous cross-package imports.
- Do not split into packages only for aesthetics. Split when release cadence, dependency boundary, ownership, or reuse justifies it.

## Ignore And Generated Files

Ignore generated or local-only artifacts:

- `*_PLAN.md`
- `.venv/`
- `.ruff_cache/`
- `.pytest_cache/`
- `.mypy_cache/`
- `__pycache__/`
- `build/`
- `dist/`
- `site/`
- `htmlcov/`
- `.coverage*`
- local environment files such as `.env`
- OS/editor local files such as `.DS_Store` and `settings.local.json`

Ignore `uv.lock` by default for reusable templates and libraries unless exact builds, applications, CI reproducibility, or production deployment require a lockfile. If the project is going to production or must be reproduced exactly, run `uv sync`, then `uv lock`, and include the resulting lockfile deliberately.

Draft planning artifacts should not leak into production or releases. Write temporary implementation and design plans as `*_PLAN.md` files and ignore that pattern unless the user explicitly wants to promote a plan into durable docs.

## Editor And Agent Files

`.editorconfig` is optional. Add it only when the repo benefits from portable editor whitespace defaults; do not treat it as a required file.

Keep `.vscode/` or editor config only when it provides portable project behavior. Avoid checking in user-local editor state.

Agent guidance files such as `AGENTS.md`, `CLAUDE.md`, or `llms.txt` are useful when they encode actual repo behavior. Keep them short and consistent with the canonical docs.

## What Not To Copy From Templates

Templates often contain artifacts that should not be copied into a real repo:

- `.venv/`
- `.ruff_cache/`
- `.pytest_cache/`
- `__pycache__/`
- `dist/` wheels and sdists
- built `site/`
- `.DS_Store`
- temporary generated projects under `tmp/`
- placeholder URLs, authors, package names, or docs titles

When using a template as inspiration, extract structure and configuration intent. Do not copy stale caches, generated builds, placeholders, or project-specific names.
