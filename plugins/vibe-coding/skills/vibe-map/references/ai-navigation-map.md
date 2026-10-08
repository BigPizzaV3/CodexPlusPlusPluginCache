# AI Navigation Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/ai_map.md` as a current map of AI-assisted behavior in the repository: model calls, prompts, tool/function contracts, RAG/OCR/ML pipelines, evals, safety boundaries, costs, and observability owners.

## Inspect

Model invocation sites, SDK clients, prompt templates, system/developer/user message builders, tool/function schemas, structured-output parsers, streaming handlers, retry/cache layers, rate-limit code, queues/jobs, RAG ingestion/retrieval, vector indexes, OCR/document processing, ML model artifacts, feature stores, eval scripts, fixtures, tests, telemetry/logging, config/env validation, docs, and generated artifacts.

## Map content

### Evidence and IDs

- Write or update `docs/ai_map.md` when the environment allows it. If writing is unavailable, print the complete markdown content in chat.
- Use stable IDs and preserve existing IDs when refreshing: capability `AI-*`, model call `MC-*`, prompt/template `PT-*`, tool/function `TF-*`, retriever/index `RG-*`, OCR/doc pipeline `DOC-*`, ML model/pipeline `ML-*`, eval `EV-*`, safety boundary `SB-*`.
- Anchor every entry to current repository evidence with `path:line[-line]` plus symbol when possible.
- Distinguish source-of-truth implementation from generated docs, stale examples, environment assumptions, and inferred behavior.
- Capture unknowns only when they affect future audit, quality, safety, or implementation.

### Coverage

Cover user-visible AI features, internal/background AI jobs, model/provider configuration, input/output contracts, tool/function contracts, schema validators, streaming and async state, RAG/OCR/ML sub-pipelines, eval coverage, data/privacy boundaries, cost/rate-limit controls, logs/metrics/traces, fallbacks, and operator runbooks when discoverable.

### Entry details

For each AI capability, capture owner symbol, caller surface, input sources, model/provider/config, prompt/template owner, output schema, downstream consumers, validation/parsing, error/fallback behavior, privacy/security boundary, tests/evals, telemetry, cost/rate-limit controls, and known drift. For RAG/OCR/ML entries, include ingestion/source data, transformation steps, index/model artifact owners, freshness/versioning, and acceptance/eval signals.

## Markdown structure

Use a compact hierarchy: summary, capability inventory, model calls, prompts/templates, tools/functions, RAG/indexes, OCR/document pipelines, ML pipelines, safety/privacy boundaries, evals, telemetry/cost controls, generated artifacts, unknowns, and assumptions. Omit sections that do not exist in the repo. Do not invent models, prompts, datasets, indexes, evals, or provider behavior.
