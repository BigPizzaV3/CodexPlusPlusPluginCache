# Python Architecture

Use these rules when designing Python modules, public APIs, data structures, adapters, decorators, state, async boundaries, and errors.

## Module And Package Conventions

Start Python modules with:

```python
from __future__ import annotations
```

Prefer:

- explicit public exports through `__all__`
- `_private.py` implementation modules
- selective re-export from package `__init__.py`
- clear public/private boundaries
- cohesive modules grouped by responsibility
- `if TYPE_CHECKING:` for type-only imports

Do not claim to follow repo conventions unless the repo context is visible. Inspect package layout, import style, tool config, typing idioms, testing patterns, and public API boundaries before copying local style.

## Optional Imports

For optional dependencies, prefer checking module availability with `importlib.util.find_spec()` before importing.

Avoid broad import-time `try/except ImportError` blocks when the goal is simply to detect whether an optional dependency is installed.

Good optional dependency behavior:

- check for the module with `find_spec`
- if absent, raise an actionable error
- mention the relevant optional extra or dependency group when one exists
- prefer uv-first install guidance
- include pip fallback only when user-facing docs or errors should support non-uv users

Example error shape:

```text
foobar[baz] is required for this feature.
Install with `uv add foobar --group baz` or `pip install "foobar[baz]"`.
```

Do not import optional dependencies speculatively and then hide failures with broad fallbacks.

## Data Structures

Prefer typed data structures over loose dictionaries.

Use:

- `@dataclass(kw_only=True)` for data-heavy structures
- `frozen=True` when mutation is not required
- `dataclasses.replace()` for explicit state evolution
- `TypedDict` for intentionally flexible dict-shaped settings
- discriminated unions with stable `Literal` discriminator fields such as `kind`, `type`, or `part_kind`
- `TypeAlias` or `TypeAliasType` for repeated or complex types
- dedicated sentinels when `None` is a valid value

Avoid:

- broad `dict[str, Any]` config bags
- ambiguous tuple returns
- unrelated return shapes without overloads
- mutable global state for runtime overrides
- `None` semantics that conflate "not provided" with "explicitly set to None"

For data validation, Pydantic is a first-class recommendation when it fits the repo and problem. Do not force Pydantic into code that is better served by dataclasses, TypedDict, or plain typed functions.

## API Design

Prefer small, explicit APIs.

Rules:

- Keep public APIs narrow and intentional.
- Prefer keyword-only arguments for several optional parameters.
- Avoid boolean traps in public APIs.
- Return rich typed values instead of loose tuples or dictionaries.
- Use typed settings containers instead of broad `**kwargs` where the shape is stable.
- If legacy kwargs are required, isolate them and warn explicitly.
- Keep docstrings concise and contract-bearing when downstream tooling consumes them.

Fluent APIs can be useful when they make a builder, pipeline, query, or staged configuration flow easier to read. Do not make fluent chaining the default style for every codebase. Use it only when it improves the domain model, matches repo conventions, and remains easy to type, test, and debug.

## Adapter Pattern

Use adapters to bridge incompatible interfaces while keeping core contracts stable.

Preferred adapter shape:

- define the interface with `typing.Protocol`
- use a covariant result type when the adapter produces typed values
- make semantic inputs keyword-only
- model the schema/input boundary explicitly with domain types
- expose both async and sync methods only when both are real public surfaces
- keep stable options as named parameters
- use `**provider_options` only for genuinely provider-specific knobs
- use `@runtime_checkable` only when runtime checks are genuinely needed
- keep adapters thin and focused on translation
- keep provider-specific behavior behind adapter boundaries
- do not leak implementation-specific details through the shared interface

Example intent:

```python
from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol, TypeAlias, TypeVar, runtime_checkable

OptionValue: TypeAlias = str | int | float | bool | None
T_co = TypeVar("T_co", covariant=True)


@dataclass(frozen=True, kw_only=True)
class FieldSpec:
    kind: str
    required: bool = True


@runtime_checkable
class RenderAdapter(Protocol[T_co]):
    async def render(
        self,
        *,
        template: str,
        fields: Mapping[str, FieldSpec],
        **provider_options: OptionValue,
    ) -> T_co: ...

    def render_sync(
        self,
        *,
        template: str,
        fields: Mapping[str, FieldSpec],
        **provider_options: OptionValue,
    ) -> T_co: ...
```

Then implementations can wrap concrete runtime behavior while satisfying the protocol. The protocol is the contract; the concrete adapter is just one implementation.

Do not use `@runtime_checkable` as decoration. It only enables shallow runtime structural checks; static protocol conformance remains the main contract. If a sync method is exposed, define its lifecycle semantics deliberately instead of hiding an unsafe event-loop bridge inside the adapter.

## Decorator Pattern

Use the decorator pattern when responsibilities can be layered without changing the wrapped object's core contract.

This includes both object composition and Python decorator syntax.

Object composition example:

```python
compiler = TracingCompiler(CachingCompiler(RuntimeCompiler(runtime)))
```

Use composition like `Compiler(Runtime())` or wrapper chains when each wrapper adds a meaningful responsibility.

Python decorator syntax is appropriate when adding behavior to a function or class is the cleanest public API:

```python
@agent.safe_plain
def tool(name: str) -> str:
    return name
```

Prefer decorator APIs that support both bare and configured usage only when both are real user needs:

```python
@agent.safe_plain
def simple_tool(x: str) -> str: ...

@agent.safe_plain(name='custom', retries=3)
def configured_tool(x: str) -> str: ...
```

For decorators with multiple call shapes:

- use `@overload` to preserve accurate typing
- use `ParamSpec` when preserving the wrapped callable signature
- make the decorated function/class positional-only, typically `func: Callable[...] | None = None, /`
- make decorator configuration keyword-only after `*`
- support bare usage as `@deco` by receiving `func` directly
- support configured usage as `@deco(option=True)` by returning the inner decorator
- keep wrapper/inner functions small and direct
- avoid erasing callable signatures with `Callable[..., Any]`
- avoid adding configurable decorator forms unless the configuration is meaningful

Preferred call-shape:

```python
def safe(
    self,
    func: Callable[ToolParams, T] | None = None,
    /,
    *,
    name: str | None = None,
    deps: Deps = Deps(),
    retries: int | None = None,
    strict: bool | None = None,
    autofix: bool = False,
    fix_now: bool = False,
    reload_function: bool = True,
    **options: object,
) -> ToolFunc[ToolParams] | Callable[[Callable[ToolParams, T]], ToolFunc[ToolParams]]:
    def decorator(func: Callable[ToolParams, T]) -> ToolFunc[ToolParams]:
        ...

    if func is not None:
        return decorator(func)
    return decorator
```

This represents the two valid user forms:

```python
@agent.safe
def bare_tool(...) -> ...: ...

@agent.safe(name='tool_name', retries=3)
def configured_tool(...) -> ...: ...
```

Do not accept config positionally. `deco(fn_or_cls)` is the bare decorator path; `deco(some_config=True)(fn_or_cls)` is the configured path.

Do not introduce decorator machinery for trivial forwarding.

## Named Constructors

Use named constructors for meaningful construction paths.

Prefer:

- `cls.from_config(...)`
- `cls.from_env(...)`
- `cls.from_path(...)`
- `cls.with_defaults(...)`

Use named constructors when construction requires validation, normalization, dependency wiring, or a clearer semantic entry point than `__init__`.

Keep `__init__` simple, direct, and unsurprising. Do not overload `__init__` with unrelated construction modes.

If a fluent or builder-style API is appropriate, keep each step typed and intention-revealing. Avoid chains that hide validation, mutate surprising state, or make errors harder to localize.

## Factories

Use factory functions or methods when object creation needs more than direct construction.

Good factory responsibilities:

- validate inputs
- normalize config
- wire dependencies
- choose an implementation behind a stable interface

Do not hide application logic inside factories.

## Protocols And ABCs

Prefer `Protocol` for structural contracts.

Use `ABC` when runtime-enforced inheritance is important.

Rules:

- Mark abstract members with `@abstractmethod`.
- Raise `NotImplementedError` only in real abstract boundaries.
- Do not use ABCs as unfinished design placeholders.
- Use protocols for adapter contracts, tool contracts, model backends, serializers, transports, and cache backends when structural typing is enough.

## State And Runtime Context

Keep state explicit and typed.

Prefer:

- immutable or minimally mutable state
- explicit state transitions
- typed context objects for dependencies
- `contextvars.ContextVar` for task-safe scoped overrides
- context managers for deterministic setup and teardown
- `@asynccontextmanager` for async lifecycle flows

Avoid:

- vague service containers
- hidden global dependencies
- import-time runtime state
- mutable globals for async-sensitive behavior
- surprising caches with unclear invalidation

When state can be touched concurrently, name the ownership model explicitly. Prefer immutable snapshots, per-task state, queues, or narrow locks over shared mutable dictionaries. If a race would corrupt a file, cache, database row, job ledger, or token budget, design the write path before adding concurrency.

## Async And Streaming

Keep async and sync boundaries explicit.

Rules:

- Do not block the event loop with sync I/O or CPU-heavy work.
- When sync I/O must be called from async code, prefer `asyncio.to_thread(...)` for the boundary.
- Use a dedicated helper around `asyncio.to_thread(...)` when the same sync dependency is called from many async paths.
- Do not call sync methods directly from async request handlers, streaming loops, or agent tool loops if they can block.
- Use async iterators for streaming, buffering, peeking, debouncing, or grouping when the abstraction is naturally sequential.
- Keep streaming utilities single-purpose and predictable.
- Make cancellation and cleanup paths testable.

Example boundary:

```python
from __future__ import annotations

import asyncio
from pathlib import Path


def load_index(path: Path) -> bytes:
    return path.read_bytes()


async def load_index_async(path: Path) -> bytes:
    return await asyncio.to_thread(load_index, path)
```

Do not use `asyncio.to_thread(...)` as a blanket escape hatch. It is for blocking sync work that must stay sync. Prefer native async libraries when the dependency, lifecycle, and test surface are already async.

## Persistent IO And Atomic Writes

Treat persistent storage and filesystem writes as concurrency-sensitive.

Use atomic writes when replacing durable artifacts:

1. Write to a temporary file in the same directory.
2. Flush and, when durability matters, `fsync` the temporary file.
3. Replace the destination with `Path.replace(...)` or `os.replace(...)`.
4. Clean up temporary files on failure.
5. Use a lock or single-writer queue when multiple tasks can write the same target.

Example:

```python
from __future__ import annotations

import os
import tempfile
from pathlib import Path


def write_text_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", text=True)
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            file.write(text)
            file.flush()
            os.fsync(file.fileno())
        tmp_path.replace(path)
    except BaseException:
        tmp_path.unlink(missing_ok=True)
        raise
```

For append-only logs, databases, caches, cassette files, coverage artifacts, and eval traces, decide whether the storage model is single-writer, append-only, transactional, or replace-in-place. Do not assume concurrent writes are safe because tests passed once locally.

## HTTP Clients

Prefer `httpx` over `requests` for HTTP work.

Use:

- `httpx.Client` for sync HTTP workflows
- `httpx.AsyncClient` for async HTTP workflows

Keep client lifecycle explicit. Do not create hidden global clients unless the repo already has a clear lifecycle pattern.

## Error Model

Fail loudly and semantically.

Prefer:

- specific exception types
- useful error context
- semantic exception hierarchies when the domain benefits
- clear distinction between misuse, runtime failure, transport failure, validation failure, retry, approval, deferred execution, and model behavior errors

Do not swallow exceptions without a concrete reason. Do not use generic exceptions where callers need structured meaning.

## Pattern Selection

Use design patterns only when they materially improve clarity, extensibility, or correctness.

Prefer:

- composition over inheritance
- adapter interfaces for provider or backend variation
- decorators for layered behavior
- strategy-style extension points for optional behavior
- iterators for natural sequential traversal

Avoid:

- design patterns as decoration
- speculative extension seams
- unnecessary inheritance hierarchies
- wrappers that only mirror another function
- pattern usage that makes simple logic harder to follow
