# Engineering Quality

Use these rules when writing, reviewing, or fixing Python code and Python package workflows.

## Python Repo Standard

Prefer strict, production-grade Python repos with explicit automation.

Default expectations:

- The workspace should be version-control protected before meaningful broad mutation. If it is not git-initialized, state the intent before acting: use `uv init` for a real new Python package/app foundation, then verify whether `.git` exists; use plain `git init` when the existing workspace should only be versioned or when `uv init` did not initialize git; do not initialize scratch or temporary workspaces unless versioning is useful.
- Never overwrite untracked, non-ignored files. Read and preserve existing content first; if broad edits are needed while such files exist, pause and ask how to handle them.
- For substantial or risky changes, prefer working on a new branch, but ask the user before creating or switching branches.
- Use `uv` as the package, environment, lock, sync, run, build, install, uninstall, and Python-version management surface.
- Prefer uv-only. If a repo must support another path, keep uv-first as the canonical developer workflow.
- Run commands through `uv run` unless the repo already has an established wrapper.
- Prefer virtual environments managed through `uv`.
- Use `ruff` for linting and `ruff format` for formatting.
- Use `ty` and `basedpyright` for type checking. If an agent may not know them, treat `ty` and `ruff` as Astral's type checker/linter toolchain.
- Use `pytest` for tests, `pytest-cov` for coverage, and `pytest-asyncio` for async tests where needed.
- Use pre-commit hooks for local enforcement.
- Use Makefile targets as the stable developer interface.

## Quality Gate As Invariant

Quality gates are part of the work, not final decoration.

Before mutating files, check the version-control state:

- If `.git` is absent, decide whether this is a real project foundation, an already-shaped workspace, a plain versioning need, or scratch work. Use `uv init` for a real new Python project, then check whether `.git` exists. Use `git init` for a non-Python or already-shaped workspace, or after `uv init` if the workspace is still not git-initialized. Do not initialize scratch workspaces solely to satisfy a default.
- If `pyproject.toml` already exists, do not run `uv init` over it. Read it and patch missing metadata, tooling, and package structure deliberately.
- If `git status --short` shows untracked, non-ignored files, do not write over their paths. Preserve them or ask the user how to handle them before broad edits.
- Do not use destructive git commands to clean the workspace unless explicitly requested.
- Do not assume untracked files are disposable; they may be the only copy of user work.

Before running or changing formatters, linters, type checkers, tests, or coverage tools, discover the repo's canonical configuration and commands. Prefer repo-defined Makefile targets and `pyproject.toml` tool config over guessed CLI flags.

Ruff, ty, and basedpyright are not optional quality gates for owned Python work. The default is strict: run them, wire them into the repo's check surface, and make failures visible. If the user explicitly says not to use one of these tools for this repo, follow that instruction and record the exception. If the repo does not currently expose those gates, do not silently skip them or describe that as acceptable. Treat the absence as a tooling gap that must be raised to the user, added to the approved plan, or explicitly deferred with rationale.

In mature existing repos, toolchain migration is a separate task. Do not convert a feature implementation into a uv, Ruff, ty, basedpyright, Makefile, CI, or coverage-standard migration unless the user asked for that migration or the approved plan includes it. For ordinary feature work, use the repo's existing commands, run any available static checks, and report missing Ruff/ty/basedpyright gates as unresolved quality gaps instead of treating them as optional.

For meaningful implementation work, verify with the smallest relevant checks first, then broader checks when risk warrants:

- tests via `uv run pytest`
- line and branch coverage via `pytest-cov`
- type checking via `uv run ty check` and `uv run basedpyright`
- linting via `uv run ruff check`
- formatting via `uv run ruff format`
- formatting check via `uv run ruff format --check`
- pre-commit via `uv run pre-commit run --all-files`
- package/build checks via `uv build` or the repo's uv-backed Makefile targets

Do not optimize for passing numbers alone. Tests must cover real behavior. Coverage is a feedback signal for missing behavioral tests, not permission to write dummy assertions.

Prefer these Makefile targets when setting up or improving a repo:

- `make check`: type check and lint, including `ty`, `basedpyright`, and `ruff check`.
- `make format`: run `ruff format` and any repo-approved formatting fixes.
- `make format-check`: run `ruff format --check`.
- `make tests`: run tests, coverage, and coverage report.
- `make pre-commit`: run pre-commit hooks across the repo.
- `make serve`: serve docs when the repo has docs.
- `make serve-check`: validate docs serving/build assumptions when available.
- `make prod`: run the production gate, including tests, check, format-check, pre-commit, and docs strict build when relevant.

`make prod` should fail if pre-commit, tests, coverage, type checking, linting, formatting check, or strict docs build fail.

## Tool Configuration Discovery

Discover tool config before invoking or modifying checks.

Ruff:

- `.ruff.toml`
- `ruff.toml`
- `pyproject.toml` with `[tool.ruff]`

ty:

- `pyproject.toml` with `[tool.ty]`
- `ty.toml` only if `[tool.ty]` is absent

basedpyright:

- `pyrightconfig.json`
- `pyproject.toml` with `[tool.basedpyright]`
- `pyproject.toml` with `[tool.pyright]` only for compatibility with an existing repo

Rules:

- Prefer `pyproject.toml` as the single source of truth when practical.
- Do not invent strictness levels.
- Do not add ad hoc CLI overrides to simulate stricter or looser behavior.
- Do not create temporary config files to force green checks.
- Run tools from the repo root unless the repo explicitly scopes them differently.
- Use the repo's canonical command if CI, Makefile, scripts, or docs define one.

## Test And Coverage Discipline

Coverage should reflect meaningful behavior.

Type-checking gates are non-negotiable. Coverage gates are also expected for owned Python work. Thresholds can be staged to match repo maturity and constraints, but test quality and coverage discipline cannot be postponed to the end of a project.

Treat full line and branch coverage as the production-readiness direction, not an accidental vanity number. Intermediate thresholds exist to keep coverage debt visible and prevent it from falling below an agreed floor; they are not a reason to stop caring about the remaining uncovered behavior.

Avoid:

- dummy tests
- tests that only exercise imports
- brittle snapshot noise
- weakening assertions to pass
- testing implementation trivia instead of contracts
- removing edge cases because they are inconvenient

Prefer:

- line and branch coverage gates by default
- full line and branch coverage as the target for strict/new production packages and release readiness
- a visible high floor such as 95%+ line and branch coverage during active development when full coverage is not yet honestly reachable
- semantic behavior coverage
- regression tests for real bugs
- edge cases that reflect public contracts
- focused tests for adapters and boundary layers

Meet coverage honestly. Use both line and branch coverage gates. For strict repos, production packages, and release readiness, close remaining coverage gaps with focused behavioral tests until full line and branch coverage is reached, unless the user explicitly accepts a documented exception.

Coverage should be managed throughout implementation. Do not defer coverage until "right before production"; if code is not designed with testability and coverage in mind from the beginning, coverage becomes an expensive late-stage cleanup problem.

When coverage reports show missing lines or branches after high-quality tests already exist, add focused tests that genuinely exercise the missing behavior:

- cover real branches and edge cases
- assert public contracts and observable outcomes
- add regression tests for actual failure modes
- avoid tests that exist only to execute lines
- avoid weakening code structure only to make coverage easier

Primary objective: test quality and behavioral coverage. Numeric thresholds are the final gate that should turn green after meaningful tests exist.

As production readiness approaches, close the remaining coverage gaps deliberately with focused behavioral tests. Use the coverage report to find missing branches and lines, then write tests that prove the underlying public behavior, edge case, or regression instead of merely executing code.

Use `pytest-asyncio` for async behavior instead of ad hoc event-loop hacks.

Coverage threshold decision:

| Repo state | Suggested gate |
| --- | --- |
| early foundation or migration | set a visible floor that the repo can honestly meet while testable seams are being created, and raise it as seams become testable |
| active library/tool before release | high line and branch coverage, usually 95%+ as a floor, with remaining gaps tracked and actively closed |
| strict/new production package | 100% line and branch coverage with meaningful tests unless the user explicitly accepts a documented exception |
| workspace or user rule is stricter | stricter rule wins |

Repo-local instruction files such as `AGENTS.md`, `CLAUDE.md`, or committed CI config count as repo conventions. If they set stricter coverage, typing, lint, or test gates than this skill's defaults, follow the stricter repo rule unless the user explicitly changes it.

Do not lower a threshold to hide missing behavior. Use thresholds to expose coverage debt and close it with focused tests.

## Test Design

Tests should validate public behavior, not private implementation choreography.

Prefer the lightest test level that proves the behavior:

1. Pure unit tests: no network, no real model calls, no uncontrolled filesystem, no uncontrolled time.
2. Boundary tests: serializers, adapters, schemas, tool definitions, retries, hooks, context propagation, async boundaries.
3. Integration tests: real external APIs only when that is the point, usually recorded or explicitly gated.

Rules:

- Test exported APIs and documented behavior.
- Avoid direct tests of `_private` internals unless there is no public seam and the repo allows it.
- Prefer descriptive test names that state condition and expected outcome.
- Keep each test focused on one behavior or a tight behavior cluster.
- Use `pytest.mark.parametrize` for matrices and edge cases.
- Use readable `ids=` for non-trivial parameter groups.
- Type annotate fixtures.
- Prefer small, composable fixtures with `function` scope by default.
- Use `autouse=True` only for global safety rails such as blocking real model/network requests or resetting global state.

## Test Doubles

Prefer the least invasive test double:

1. real pure object
2. project-specific fake or test model
3. lightweight stub
4. monkeypatch
5. `Mock` / `MagicMock` / `AsyncMock`

Mock only true side-effect boundaries such as network, clocks, environment, subprocesses, filesystem edges, and provider SDK calls.

Assert outcomes first, call counts second. Do not mock deep internal call graphs unless call choreography is the public behavior.

## Snapshot Discipline

Use snapshots for complex structured output, generated schemas, message sequences, structured agent/tool outputs, and multiline terminal output.

`inline-snapshot` is a preferred option when snapshot tests are useful, but it is not a default requirement for every repo or every test. Use direct assertions when they express the behavior more clearly.

Rules:

- Prefer `inline-snapshot` and inline snapshots when readable.
- Review snapshot updates intentionally.
- Do not bulk-accept snapshot changes without reading the diff.
- Normalize unstable values before snapshotting: timestamps, UUIDs, request IDs, ordering, environment paths.
- Do not use snapshots for tiny scalar assertions.
- Snapshot-heavy tests must still make the protected behavior clear.

## API/LLM Test Cassette Discipline

Tests that involve LLM calls, API calls, paid calls, or unstable remote services must not hit live services during normal local, CI, pre-commit, or production gates. Use cassette-style recordings or deterministic fakes. If the user explicitly wants live integration tests, isolate and mark them so they do not run in the normal gate.

Preferred intent:

- A passing behavior should be captured once and replayed in normal test runs.
- Normal test runs should not increase API cost.
- CI and production gates should run in replay-only mode.
- Missing cassettes should fail the relevant pre-commit or test gate instead of silently calling the network.
- When behavior intentionally changes, regenerate cassettes deliberately and commit the updated cassettes.

`casetter` from PyPI is an acceptable cassette tool when it fits the repo.

Record-mode policy:

- Local development may temporarily use a recording mode to create or refresh cassettes.
- Committed/production test runs should use replay-only behavior, such as record mode `once` or stricter, according to the chosen cassette tool's semantics.
- Pre-commit should verify required cassette files exist.
- If cassettes are stale or missing, pre-commit should fail and make the regeneration requirement obvious.
- Updated cassettes are production artifacts and should be reviewed like source changes.

Cassettes should be deterministic, sanitized, and reviewable:

- Store them in a dedicated `tests/cassettes/` hierarchy or another clear test-owned path.
- Prefer YAML cassettes for readability unless the repo has a reason to use another format.
- Filter authorization headers, cookies, API keys, bearer tokens, request IDs, and account-specific identifiers.
- Keep request matching as strict as practical; add body-aware matching when response shape depends on payload.
- Detect and remove orphan cassettes when tests are deleted or renamed.

Normal unit tests should block real API/model calls by default. Real calls belong in explicit integration or cassette refresh workflows.

## Type System Discipline

Treat type checking as design feedback, not an obstacle to bypass.

Review signals:

- `Any` used to silence uncertainty instead of representing a genuinely dynamic value
- `object` used as a fake exact type
- broad `cast` without localized proof
- `# type: ignore`, `pyright: ignore`, or tool-specific suppressions used to hide a design problem
- broad `dict[str, Any]` when a typed model or protocol is needed
- `getattr(..., None)` hiding contract problems
- `hasattr(result, "__await__")` instead of proper awaitable detection
- lazy `__getattr__` imports that obscure the public API
- fallback import logic that hides real dependencies
- wrapper functions that only mirror imports

`Any`, `object`, `cast`, and localized ignore comments are not forbidden. The gate bans unjustified shortcuts, not honest dynamic boundaries.

Prefer:

- exact types first
- generics when exact types cannot be expressed directly
- `ParamSpec` and callable generics for decorators that preserve signatures
- protocols only when there is a real interface boundary
- explicit imports and explicit public exports
- localized type ignores only with a real reason

Decision flow:

1. Express the exact type if it is known.
2. Use generics or `ParamSpec` when shape is parametric.
3. Use a narrow `Protocol` when there is a real interface boundary.
4. Use Pydantic models, dataclasses, TypedDicts, or validators when runtime validation creates the type guarantee.
5. Use `Any`, `object`, `cast`, or a localized ignore only when it represents an honest external/dynamic boundary and the nearby code proves or validates the contract.

The repo's full typecheck gates must pass with every escape hatch justified:

- `Any` should describe a real dynamic value, not avoid modeling.
- `object` should be narrowed at the boundary before use.
- `cast` should be local and backed by an invariant, validation step, or API contract.
- ignore comments should be localized, explained, and genuinely unavoidable.
- fallback dynamic access should not replace a typed contract.

Do not outsource this judgement to a mechanical audit script. Use type-checker output, tests, local code reading, and design intent to classify each suspicious type construct as justified, needs narrowing, or a real checker-silencing workaround.

## Code Hygiene

Keep code direct, explicit, and maintainable.

Avoid:

- noisy helpers
- one-off wrappers
- hidden side effects
- implicit global state
- over-specialized subclasses
- broad fallback behavior
- speculative extension seams

Prefer:

- small cohesive modules
- explicit data flow
- clear public/private boundaries
- composition over inheritance
- simple construction paths
- localized complexity where needed

## Error Output As Contract Signal

Read failures as evidence of missing or broken contracts.

Before patching a symptom, ask:

- What invariant did this error violate?
- Is this a local bug or a missing abstraction boundary?
- Does the fix belong in parser, schema, adapter, executor, LSP, test fixture, or docs?
- Should this become a regression test?

Fix the contract, not only the stack trace.

## Release Hygiene

Before treating work as done, check for:

- stale files
- orphaned code
- lockfile drift, when a lockfile is part of the repo's release or production surface
- package metadata drift
- version pin drift
- dynamic version drift between `src/<package>/_version.py`, `VERSION`, package metadata, docs, tags, and release workflows
- docs/examples that reference old APIs
- CI missing key checks
- missing Makefile gates
- missing pre-commit enforcement
- missing cassette artifacts for API/LLM tests
- editor extension revision mismatch, when applicable

Local green tests are not enough when the package, docs, or distribution surface changed.

For package repos, prefer dynamic versioning through `src/<package>/_version.py`. If the repo also keeps a root `VERSION` file, add a deterministic version consistency check and include it in `make prod`. Version bump helpers should update every version surface together and fail on invalid version strings.

## Warnings And Determinism

Treat warnings as errors by default.

Rules:

- Do not add broad warning filters casually.
- If a third-party warning must be ignored, make the filter narrow and documented.
- New code should not introduce fresh warnings.
- Tests must not depend on real network, current time, random state, process-global mutable state, ambient environment, or external credentials unless explicitly controlled.

## CI And Publishing

Prefer GitHub workflows that separate checks clearly:

- `tests.yml`: run tests, line coverage, and branch coverage gates.
- `check.yml`: run lint, type checks, formatting checks, and other static checks.
- `publish.yml`: publish to PyPI through trusted publishing when the package is releasable.

For strict repos, `tests.yml` should fail unless tests pass and both line and branch coverage requirements are met.

For PyPI publishing, use trusted publishing instead of long-lived publish tokens. If trusted publishing is impossible for a specific repository, require an explicit documented exception before using another publish path.

## Docs Gate

If the repo has docs:

- use `mkdocs build --strict` or the repo's strict docs build equivalent
- include docs checks in `make prod` when docs are part of the product
- provide `make serve` for local docs serving
- provide `make serve-check` when there is a meaningful serve/build validation path

Docs failures should block production readiness when docs are user-facing or release-relevant.
