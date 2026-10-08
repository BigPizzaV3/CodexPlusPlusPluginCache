from __future__ import annotations

from dataclasses import dataclass
from importlib import metadata
from typing import Any, Protocol


@dataclass(frozen=True)
class AdapterContext:
    case_ids: tuple[str, ...] = ()


@dataclass(frozen=True)
class AdapterOutput:
    provider: str
    records: tuple[dict[str, Any], ...]
    provenance: dict[str, Any]
    warnings: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": "0.1",
            "provider": self.provider,
            "records": [dict(item) for item in self.records],
            "provenance": self.provenance,
            "warnings": list(self.warnings),
        }


class Adapter(Protocol):
    name: str
    version: str

    def convert(self, payload: Any, context: AdapterContext) -> AdapterOutput: ...


@dataclass(frozen=True)
class AdapterDescriptor:
    name: str
    version: str
    source: str
    adapter: Adapter | None = None

    def to_dict(self) -> dict[str, str]:
        return {"name": self.name, "version": self.version, "source": self.source}


BUILTIN_ADAPTERS = ("custom", "deepeval", "langsmith", "mlflow", "phoenix", "promptfoo", "ragas")


def discover_adapters(*, include_entry_points: bool = True) -> tuple[AdapterDescriptor, ...]:
    discovered = [AdapterDescriptor(name, "1.0", "builtin") for name in BUILTIN_ADAPTERS]
    if include_entry_points:
        for entry_point in metadata.entry_points(group="ragops.adapters"):
            loaded = entry_point.load()
            adapter = loaded() if isinstance(loaded, type) else loaded
            discovered.append(
                AdapterDescriptor(
                    name=str(adapter.name),
                    version=str(adapter.version),
                    source=f"entry-point:{entry_point.name}",
                    adapter=adapter,
                )
            )
    by_name: dict[str, AdapterDescriptor] = {}
    for item in discovered:
        by_name.setdefault(item.name, item)
    return tuple(by_name[name] for name in sorted(by_name))
