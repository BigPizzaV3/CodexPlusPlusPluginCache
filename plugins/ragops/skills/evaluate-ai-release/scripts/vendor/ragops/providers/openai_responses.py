from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from ragops.adapters.http import AdapterError, post_json


class ProviderError(RuntimeError):
    """Raised when a provider response cannot satisfy the adapter contract."""


@dataclass(frozen=True)
class ProviderResult:
    text: str
    response_id: str
    model: str
    usage: dict[str, int]


class OpenAIResponsesAdapter:
    """Dependency-free adapter for the OpenAI Responses API.

    The model is explicit so evaluations do not silently move to a new alias.
    """

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str = "https://api.openai.com/v1",
        transport: Callable[..., dict[str, Any]] = post_json,
    ) -> None:
        if not api_key.strip():
            raise ValueError("api_key is required")
        if not model.strip():
            raise ValueError("model is required")
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.transport = transport

    def generate(self, *, input_text: str, instructions: str = "") -> ProviderResult:
        payload: dict[str, Any] = {"model": self.model, "input": input_text}
        if instructions:
            payload["instructions"] = instructions
        try:
            response = self.transport(
                f"{self.base_url}/responses",
                payload,
                headers={"authorization": f"Bearer {self.api_key}"},
            )
            text = _output_text(response)
            usage_data = response.get("usage", {})
            usage = {
                "input_tokens": int(usage_data.get("input_tokens", 0)),
                "output_tokens": int(usage_data.get("output_tokens", 0)),
                "total_tokens": int(usage_data.get("total_tokens", 0)),
            }
            return ProviderResult(
                text=text,
                response_id=str(response["id"]),
                model=str(response.get("model", self.model)),
                usage=usage,
            )
        except (AdapterError, KeyError, TypeError, ValueError) as exc:
            raise ProviderError(f"Invalid OpenAI Responses API result: {exc}") from exc


def _output_text(response: dict[str, Any]) -> str:
    direct = response.get("output_text")
    if isinstance(direct, str) and direct:
        return direct
    parts: list[str] = []
    for item in response.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                parts.append(content["text"])
    if not parts:
        raise ValueError("response contains no output text")
    return "".join(parts)
