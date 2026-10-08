---
name: tahr-trace-dangerous-inputs
description: Trace attacker-controlled input through parsing, validation, normalization, storage, and dangerous server or browser sinks, then safely validate exploitability with class-specific proof gates. Use for injection review, source-to-sink analysis, XSS, SQL/NoSQL injection, command or template injection, SSRF, XXE, path traversal, unsafe deserialization, file upload/processing, webhook, CORS/postMessage, or client-side trust-boundary testing.
---

# Trace Dangerous Inputs

Find complete attacker-controlled data paths. Do not report a dangerous API call, suspicious regex match, reflection, or error without proving reachability and impact.

## Set a safe review mode

1. Identify repository roots, runtime targets, specifications, traffic, authentication context, and authorized scope.
2. Default to static tracing when live testing is not explicitly authorized.
3. Keep runtime probes low volume, non-destructive, and tied to exact discovered operations. Do not test login credential fields, customer objects, real payment/order flows, or unrelated infrastructure.
4. Require a disposable fixture before uploads, persistent content, webhook registration, or other mutations. Define readback and cleanup first.
5. Use harmless unique markers, controlled callbacks, safe owned canaries, and low-impact commands only. Never delete data, establish persistence, dump broad files/databases, scan internal networks, or alter cloud resources.

## Build the source-to-sink map

Read [source-sink-matrix.md](references/source-sink-matrix.md). For every candidate path, record:

- entrypoint and exact source: path, query, body, nested field, header, cookie, form, multipart metadata, GraphQL variable, message, file, stored value, or browser source;
- parsing and canonicalization order, including decoding, type coercion, content-type selection, duplicate parameters, archive/document parsing, and redirects;
- validation, allowlisting, authorization, normalization, encoding, parameterization, and sanitization controls;
- transformations and trust-boundary hops across services, queues, jobs, databases, caches, templates, browsers, and third parties;
- final sink, execution context, and output/render/fetch/readback path.

Trace second-order behavior: input stored now may later reach a query, template, browser render, document processor, shell, webhook, or background job.

## Prioritize real sinks

Prioritize operations evidenced by code, schemas, JavaScript, or traffic:

- query builders and raw SQL/NoSQL/search expressions;
- shell/process APIs, dynamic evaluation, deserializers, and template engines;
- URL fetchers, redirects, webhooks, integrations, image/document renderers, and import/export jobs;
- XML parsers, file/path/archive operations, upload pipelines, and served-content behavior;
- HTML/DOM/navigation/eval-like browser sinks, postMessage handlers, and cross-origin data access.

Do not send a payload to the application root merely because a field name looks interesting. Preserve the actual method, body, parser, auth/role/tenant context, and provenance.

## Validate progressively

For an authorized runtime target:

1. Establish a clean baseline and the operation's real success semantics.
2. Send a unique inert marker to prove the source reaches the expected context.
3. Change one field, encoding, parser, or carrier at a time using a context-specific safe probe.
4. Distinguish filter/WAF behavior from application execution.
5. Follow the result to the final proof surface: database-derived value, command output, callback, safe file canary, browser runtime effect, persisted readback, internal-service response, or served upload behavior.
6. Repeat with a negative control and preserve exact request/action and response/proof artifacts.

If runtime proof is unavailable, report the full reachable code path and missing precondition as a candidate or code-level risk. Do not claim confirmed exploitability.

## Apply class-specific proof gates

Read [exploitability-proof-gates.md](references/exploitability-proof-gates.md). Enforce the appropriate gate before confirming a finding. In particular:

- require database-derived extraction for SQL injection;
- require browser/runtime JavaScript execution for XSS;
- require exact-sink callback, internal response, metadata, or file/protocol proof for SSRF;
- require command output or controlled callback for command/RCE claims;
- separate upload acceptance from browser, server, or document-processing exploitation.

Keep timing, errors, reflection, status/size differences, accepted files, listener presence, permissive headers, scanner labels, and source-only hypotheses in a candidate ledger until the gate passes.

## Review the control at the right layer

For each path, determine whether the defense is structurally correct:

- use parameterized APIs instead of blacklist filtering;
- validate canonicalized data at the authoritative server boundary;
- allowlist URL schemes/hosts and revalidate every redirect and resolved address;
- disable unnecessary parser features and unsafe polymorphic deserialization;
- isolate file storage and processing, generate server-side names, and serve inertly;
- use context-specific output encoding and safe DOM APIs;
- enforce origin and message schema checks before acting on cross-window data.

Search for variants of the same unsafe pattern across the repository after proving one path.

## Report proof and coverage

For every confirmed issue, provide source-to-sink path, exact entrypoint, control failure, safe proof, impact, affected variants, remediation location, and reproduction steps. Redact secrets and PII while retaining field names, types, lengths, fingerprints, hashes, and proof signals.

List untraced sources, unexecuted sinks, parser variants, background jobs, browser-only paths, unavailable callbacks, missing disposable fixtures, and other coverage gaps. Do not convert incomplete tracing into a clean result.
