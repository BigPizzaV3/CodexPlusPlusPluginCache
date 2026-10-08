# DX And Semantics

Use these rules when designing developer-facing behavior, semantic schemas, metrics, CLI output, YAML, LSP, traceback, docs, or tool interfaces.

## Semantic Contract First

Raw field names are not enough. Design the semantic contract.

For metrics, schemas, tool calls, traces, and generated artifacts, define:

- canonical names
- semantic types
- aliases when needed
- descriptions visible to users or models
- return contracts
- units and normalization rules
- which layer owns the meaning

Examples of semantic contract thinking:

- `money.cost` is different from a local field named `cost`
- `coverage.ratio` is different from an arbitrary score
- LLM token metrics should identify input/output and provider/model where relevant
- tool schema descriptions should tell the model what the parameter means, not only its raw type

Decision shape:

```text
Do not expose only raw field names. Define the semantic type, unit, canonical name,
display label, and owner layer. Then map local fields into that contract.
```

## Developer Experience Is Behavior

DX is not polish after correctness. It is part of the product contract.

For developer tools, correctness includes:

- clear CLI output
- readable YAML or config
- useful language-server behavior
- accurate hover text
- reliable goto definition
- correct diagnostics
- meaningful traceback display
- runnable docs and examples
- stable schema and completion behavior

"It works" is not enough if the user-facing surface is confusing, misleading, or ugly.

Bad DX acceptance:

```text
The command exits successfully.
```

Good DX acceptance:

```text
The command exits successfully, the output is scannable, labels preserve semantic meaning,
error states are clear, and the result is useful without reading implementation code.
```

## CLI, YAML, And Reports

Prefer outputs that users can scan and trust:

- rich tables when tabular data matters
- projections for comparing key metrics
- clear grouping and labels
- human-readable YAML when config/export is user-edited
- schema headers or completion metadata when appropriate
- report fields that carry semantic context, not only raw dumps

Avoid dumping markdown, JSON, or YAML only because it is easy.

Example:

- Weak: print a raw dict or markdown blob because the data exists.
- Strong: render a rich table for comparisons, include grouped metrics, and preserve export formats for machines.
- Weak YAML: serialize internal objects as-is.
- Strong YAML: produce human-editable config with stable keys, schema hints, and semantic grouping.

CLI decision pattern:

```text
If a human is expected to read the default output, make the default output human-first.
Keep machine export explicit with flags such as --json, --yaml, or --out.
```

Example CLI shape:

```python
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, kw_only=True)
class CheckResult:
    name: str
    status: str
    detail: str


def render_human(results: list[CheckResult]) -> str:
    lines = ["NAME            STATUS  DETAIL"]
    for item in results:
        lines.append(f"{item.name:<15} {item.status:<6} {item.detail}")
    return "\n".join(lines)
```

Default UX:

```text
$ tool check
NAME            STATUS  DETAIL
typing          pass    ty and basedpyright passed
coverage        warn    branch coverage is below target
```

Machine export should be explicit:

```text
$ tool check --json
```

## LSP And IDE Surfaces

For IDE integrations, fix the underlying language-server truth model rather than patching one symptom.

Hover, completion, semantic tokens, diagnostics, definitions, references, and source mapping should be fed by the same coherent model.

Avoid:

- special hover patches that hide broken Pyright/LSP integration
- fake stubs that cannot map back to source
- stale shadow files
- cache invalidation guesses without measurement
- IDE-specific hacks that break another editor

Prefer:

- virtual stubs with correct source mapping
- measured cache/reload behavior
- diagnostics tied to real source
- hover wording that reflects the semantic type
- verification in target editors when UI behavior matters

LSP decision pattern:

```text
Do not patch one editor symptom in isolation.
Fix the canonical semantic/source model so hover, completion, goto definition,
diagnostics, and references all improve together.
```

Example:

- Weak: add a custom hover response for the one symbol that looks wrong.
- Strong: fix the generated stub/source map/type model so hover, completion, diagnostics, and goto definition all agree.

## Traceback And Error Display

Tracebacks are user-facing DX.

A good traceback should:

- point to the right source line
- preserve useful call frames
- avoid dumping irrelevant implementation internals
- show readable context
- distinguish user code from runtime internals
- look intentional in terminals

Do not copy Python traceback formatting blindly when the product needs a clearer domain-specific display.

Example:

- Weak: print a raw Python traceback from runtime internals.
- Strong: show the user's source line, relevant call chain, concise runtime context, and hide irrelevant framework frames unless debug mode is requested.

Error rendering pattern:

```python
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, kw_only=True)
class UserFacingError:
    summary: str
    source_path: str
    source_line: int
    source_excerpt: str
```

Preferred display:

```text
Validation failed: field `timeout_secs` must be positive

config/settings.yaml:14
timeout_secs: -1

The runtime rejected this value before startup.
```

## Tool And Schema Surfaces

For model-facing tools, schema and description quality affect behavior.

Preserve:

- parameter descriptions
- return descriptions
- docstring-derived semantics
- adapter-specific metadata
- sync/async normalization
- native tool conversion contracts

Simplify public APIs without flattening the semantic payload models need to use the tool correctly.

Example:

- Weak: merge two tool registration APIs and drop docstring-derived parameter descriptions.
- Strong: expose one registration API while preserving names, parameter descriptions, return descriptions, schema metadata, sync/async behavior, and adapter-native conversions.

Schema decision pattern:

```text
If two layers use the same data with different local names, keep one canonical semantic contract
and add adapters or aliases at the edges. Do not let raw storage names become the public schema.
```

## Markdown And Documentation

Markdown should be clean, restrained, metadata-aware, and useful.

Rules:

- Do not add emoji clutter, decorative badges, banners, or filler prose unless the repo already uses them deliberately.
- Keep `README.md` focused on project intro, primary install paths, shortest getting-started path, and links to deeper docs.
- Move detailed CLI, configuration, API, testing, and development docs into focused files such as `docs/CLI.md`, `docs/CONFIGURATION.md`, `docs/API.md`, `docs/TESTING.md`, and `docs/DEVELOPMENT.md`.
- Do not turn README into the full manual.
- Use tables only when they improve scanning or comparison.

Documentation must be grounded in repo metadata:

- Read `pyproject.toml` for project name, package name, source URL, optional extras, and entry points.
- Do not invent package names, extras, commands, env vars, config keys, or placeholder URLs.
- Avoid placeholder values like `yourusername`, `your-org`, `your-project`, and `my-package`.
- Prefer omitting uncertain details over fabricating them.

Useful llms.txt links for Pydantic ecosystem docs:

- Pydantic Validation: https://pydantic.dev/docs/validation/latest/llms.txt
- Pydantic AI: https://pydantic.dev/docs/ai/llms.txt
- Pydantic Logfire: https://pydantic.dev/docs/logfire/llms.txt

Link policy:

- Prefer absolute repository links in generated Markdown when linking to project files/docs.
- Construct source links from project metadata.
- Avoid relative links in published docs unless the repo already uses them consistently.

Installation docs:

- Show `uv` first.
- For short-circuit style Python repos, keep `uv` as the canonical install and developer workflow.
- Include a `pip` fallback only when the project intentionally supports non-uv users or public user-facing docs require it.
- Distinguish production install from contributor/dev setup.
- Document optional extras only if they exist in project metadata.

Example:

```bash
uv add package-name
```

```bash
pip install package-name
```

Development docs should cover setup, linting, type checking, testing, local docs, and CLI workflows without crowding the README.

Documentation decision pattern:

```text
README should answer: what is this, how do I install it, how do I run the shortest successful path?
Move operational detail, advanced config, and contributor workflow to focused docs.
```
