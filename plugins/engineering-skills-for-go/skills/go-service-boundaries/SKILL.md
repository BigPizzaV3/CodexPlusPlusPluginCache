---
name: go-service-boundaries
description: "Use for Go HTTP/gRPC/GraphQL/OpenAPI resources, bodies, streams, and shutdown. Do not use for retry policy."
license: Apache-2.0
compatibility: "Go 1.24 or newer; protocol and library behavior must be verified against deployed versions."
---

# Go service boundaries

Treat every service adapter as a trust, resource, and compatibility boundary. Keep domain behavior independent of transport encoding while preserving protocol-specific semantics.

## Define the boundary

Record authentication and authorization ownership, request and response size limits, deadline source, streaming behavior, concurrency admission, error mapping, versioning, and shutdown policy. Validate untrusted input once before constructing a domain command.

## HTTP

Use explicit `http.Server`, client, and transport ownership. Bound headers and finite bodies. Reuse clients and close response bodies. Propagate `r.Context()`. Choose total, phase, or idle timeouts from endpoint semantics; a global write timeout can break streaming. Treat redirects and proxy headers as new trust decisions.

For JSON APIs, bound the body before decoding, accept exactly the documented media and content encodings, decode one complete value into a private typed DTO, and apply no domain effect after any decode or validation error. Unknown-field tolerance is a versioning choice; duplicate critical names are an interoperability and security ambiguity that `encoding/json` v1 does not reject by default. Read [references/http-json-message-boundaries.md](references/http-json-message-boundaries.md) for the strict boundary procedure.

Treat a transport configuration as immutable after concurrent use begins. When TLS identity, trust roots, proxy, dial policy, or another connection-affecting setting changes, construct a private replacement and publish it with every policy decision that must share its version. Each admitted operation captures one generation. Stop new admission to the old generation, let its in-flight operations keep their captured client, close its idle connections, and release it only when its owned streams and bodies are done. A pointer swap without old-generation retirement prevents mixed configuration but still leaks connection state.

## gRPC

Preserve status codes, cancellation, metadata trust, message limits, and stream lifecycle. Reuse connections. Put authentication, tracing, and recovery in ordered interceptors, but keep domain decisions out of them. A retry policy must respect method idempotency and the caller's deadline.

## GraphQL and OpenAPI

Keep resolvers and generated handlers thin. Bound query complexity and pagination. Batch only within request lifetime and authorization scope. Treat schema nullability, enums, field removal, and generated client expectations as public contracts. Generated OpenAPI is evidence only when it matches runtime behavior.

## Shutdown and ambiguity

Stop admission, drain accepted work within the platform budget, terminate application-owned streams, then close dependencies. A missing response after a request may mean an unknown remote outcome; do not convert transport uncertainty into a known business failure.

Read [references/protocol-matrix.md](references/protocol-matrix.md) for protocol-specific failure, versioned client cutover, and test cases.

## Output contract

Change the smallest owning adapter. Report exact protocol, resource, trust, or compatibility failures, including the triggering request and observable result.
