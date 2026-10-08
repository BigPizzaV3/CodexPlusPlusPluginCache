# Agentic Engineering

Use these rules when working on repositories with agents, model backends, tool systems, message graphs, structured output, retries, approvals, deferred execution, or agent tests.

## Architecture Boundaries

Preserve explicit agent architecture instead of flattening everything into generic helpers.

Keep these layers distinguishable:

- model backend
- provider transport
- request preparation
- response parsing
- structured output validation
- tool or toolset layer
- run context
- message or event types
- state or graph nodes
- retry, approval, timeout, and deferred execution boundaries

Do not hardcode a provider into shared abstractions. Provider-specific behavior belongs behind adapter or backend boundaries.

## Recommended Ecosystem

Pydantic AI is a first-class recommendation for agent frameworks when it fits the project. Pydantic Logfire is a first-class recommendation for agent observability when it fits the project.

These are recommendations, not architectural requirements. If the repo, team, or product constraints make another stack more appropriate, use it. LangGraph and LangSmith are valid alternatives when they fit better.

Relevant llms.txt links:

- Pydantic Validation: https://pydantic.dev/docs/validation/latest/llms.txt
- Pydantic AI: https://pydantic.dev/docs/ai/llms.txt
- Pydantic Logfire: https://pydantic.dev/docs/logfire/llms.txt

Before adding Logfire to a repo or relying on Logfire tooling for investigation, ask the user whether they want Logfire. If the user declines, do not add Logfire dependencies, instrumentation, config, MCP setup, or trace-based workflow.

If the user opts into Logfire:

1. Initialize Logfire for the project with the current Logfire setup flow, such as `logfire init`.
2. Set up the Logfire MCP server for Codex when trace, issue, alert, or dashboard investigation will be useful.
3. Run the Logfire MCP login flow from Codex before depending on MCP queries.
4. Use Logfire MCP for Logfire data instead of ad hoc trace scraping when it is available.

If using Logfire with HTTP clients:

```python
logfire.instrument_httpx(capture_all=True)
```

If using Logfire with a FastAPI app:

```python
logfire.instrument_fastapi(app)
```

If using Pydantic AI:

```python
logfire.instrument_pydantic_ai()
```

Only add instrumentation when Logfire is actually part of the architecture.

## Web Backend Defaults

For Python web backend tooling, prefer FastAPI by default when the repo does not already establish another framework. FastAPI fits typed request/response contracts, Pydantic validation, async endpoints, OpenAPI generation, and agent/tool backend surfaces well.

Do not introduce a different web framework unless the existing repo, deployment target, or user request clearly calls for it.

## Model And Provider Abstraction

Separate:

- request normalization
- provider capability/profile checks
- transport call
- response parsing
- structured output validation
- error mapping

Prefer capability or profile objects over scattered provider conditionals.

Do not duplicate request normalization in every provider implementation when a central preparation layer exists or should exist.

## Tool Contracts

Treat tools as typed contracts, not arbitrary callables.

Preserve:

- explicit tool names
- descriptions
- schema generation boundaries
- argument validation
- retry semantics
- approval requirements
- timeout behavior
- sequential execution flags
- context requirements

If docstrings feed tool descriptions or schema generation, keep them accurate and contract-bearing.

Prefer wrappers, filters, prefixes, decorators, or preparers around toolsets instead of duplicating registration logic.

## Run Context And State

Keep run context typed and explicit.

Rules:

- Pass dependencies through typed context objects, not hidden globals.
- Keep model-facing state separate from pure domain state.
- If the repo uses graph nodes, state machines, or step objects, extend that structure instead of replacing it with ad hoc branching.
- Prefer immutable or replace-style state evolution when the architecture supports it.
- Preserve discriminators such as `kind`, `part_kind`, `role`, or similar tagged fields in message/event models.

## Structured Outputs

Structured output is a contract.

Preserve:

- validation boundaries
- schema shape
- error reporting
- retry prompts
- output model semantics
- compatibility with existing downstream consumers

Do not replace structured outputs with loose dictionaries unless the repo already uses that shape and the contract remains explicit.

## Retry, Approval, And Deferred Flow

Retry, approval, skip, deferred execution, and validation failures are control-flow concepts. Model them explicitly.

Prefer semantic exception or result types for:

- retryable model behavior
- validation failure
- user approval required
- deferred execution
- skipped tool execution
- transport failure
- provider capability mismatch

Do not collapse these into generic `Exception`, `RuntimeError`, or boolean flags when callers need structured meaning.

Example state shapes:

```python
@dataclass(frozen=True, kw_only=True)
class ApprovalRequired:
    tool_name: str
    reason: str
    payload_preview: str


@dataclass(frozen=True, kw_only=True)
class DeferredWork:
    id: str
    reason: str
    resume_after: datetime | None = None
```

Use semantic exceptions only when that matches the repo's existing control-flow style; otherwise return typed state objects or events that the agent loop can route.

## Agent Tests

Agent tests should validate behavior at the agent boundary.

Prefer testing:

- generated outputs
- tool calls
- retry prompts
- approval or deferred paths
- captured messages
- structured output validation
- context propagation
- graph transitions when graph behavior is public

Prefer:

- project-provided test models and fakes
- deterministic tool or model substitutes
- snapshots for message sequences or structured outputs
- cassette-backed HTTP tests only when provider behavior is genuinely under test

Avoid:

- deep mocks of internal agent plumbing
- brittle assertions on helper call order
- flattening agent tests into generic unit tests that lose the behavioral contract

## Change Checklist

An agent-related edit is not complete unless it preserves or intentionally updates:

- provider abstraction boundaries
- typed tool contracts
- message or event schemas
- structured output guarantees
- retry, approval, timeout, and deferred control flow
- repo-native testing style for agents
- docs/examples if public agent behavior changed
