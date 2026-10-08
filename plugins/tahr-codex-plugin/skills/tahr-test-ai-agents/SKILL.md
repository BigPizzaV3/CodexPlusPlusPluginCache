---
name: tahr-test-ai-agents
description: Test security boundaries in applications that use LLM chat, RAG or vector retrieval, memory, file or URL ingestion, model-rendered output, tool/function calling, MCP, or autonomous agents. Use for source-backed AI feature reviews, authorized local or staging runtime tests, prompt-injection assessments, cross-tenant retrieval checks, agent/tool abuse reviews, and AI resource-control testing.
---

# Tahr Test AI Agents

Review the application as an attacker crossing data, instruction, identity, rendering, and tool boundaries. Treat payload catalogs as aids; make the proof discipline the center of the assessment.

## Establish the boundary

1. Confirm the repository, feature, identities, and runtime target placed in scope.
2. Default to source-only analysis when authorization for active runtime testing is unclear.
3. Identify protected accounts, production data, third-party integrations, and actions that must remain read-only.
4. Do not modify application code, configuration, or deployed state unless the user separately requests remediation.
5. Use disposable tenants, documents, objects, tools, callback collectors, and marker values for active tests.

Never delete data, transfer value, send real messages, publish content, rotate credentials, change privileges, exhaust a customer budget, or exfiltrate real private data. Bound concurrency, output length, request counts, and cost.

## Build the real attack surface

Read [methodology.md](references/methodology.md) before selecting tests.

Trace model and embedding SDK calls to their actual HTTP, WebSocket, queue, or background-job entry points. Include supporting routes for uploads, knowledge bases, conversations, memory, feedback, model settings, tools, and shared views. When source is incomplete, inspect OpenAPI, client bundles, forms, runtime requests, streaming frames, and error shapes.

Confirm an endpoint only when it accepts AI-shaped input or produces generated, streaming, retrieval, embedding, model, or tool behavior. A route name containing `chat`, a generic JSON response, or a successful status code is not confirmation.

For each confirmed surface, record:

- endpoint, method, controllable field, and authenticated identity;
- tenant, conversation, memory, and retrieval context;
- model/provider and guardrail hints, marked `unknown` when unproven;
- ingestion formats and retrieval sources;
- renderer and downstream output sinks;
- available tools, resources, prompts, and autonomous steps;
- measured rate, token, output, streaming, and quota behavior;
- evidence source and confidence.

## Test conditionally

Establish a benign baseline before attack probes. Run only families whose preconditions exist:

- test direct instruction override against an application-specific control;
- test indirect injection only through content the application really ingests;
- test retrieval and memory across validated user or tenant boundaries;
- test output injection in the actual browser or downstream consumer;
- test tool and MCP agency at real resource and authorization boundaries;
- test resource controls with conservative measured probes;
- attempt chains only from previously observed signals.

Vary semantic attack concepts before cosmetic encodings. Record every attempt by endpoint, field, concept, payload hash, response class, and success criterion. For stochastic behavior, reproduce the same concept and boundary at least three times in five attempts unless the original security contract requires a stronger threshold.

When blocked, ask at most a few fresh-agent passes for concise new concept axes or plausible chains. Treat that advice as leads only. Never let an adviser, model claim, or payload classification verify a finding.

## Apply proof gates

Read [proof-gates.md](references/proof-gates.md) before promoting or scoring a result.

Maintain three separate collections:

1. **Verified findings** — the required boundary and impact proof exists.
2. **Candidates** — a concrete signal exists, but state the missing proof and safest next check.
3. **Coverage** — list tested, partially tested, skipped, inaccessible, degraded, and unsafe-to-test surfaces with reasons.

Do not promote model claims, marker-only obedience, generic policy text, stored-but-unretrieved content, API reflection, tool names, version intelligence, one lucky response, or theoretical cost.

## Handle evidence safely

Use raw secrets or private data only transiently when authorized and necessary. Persist the value class, source, tenant or role context, redacted excerpt, length, fingerprint, endpoint, payload class, and reproduction count. Do not place raw tokens, cookies, system prompts, private documents, credentials, PII, or tool output into findings, screenshots, logs, or reports.

Name findings after the demonstrated result, not the attempted technique. Calibrate severity to the proven data, action, resource, tenant, or browser boundary. End with prioritized remediation tied to the actual trust boundary and a concise residual-risk statement.
