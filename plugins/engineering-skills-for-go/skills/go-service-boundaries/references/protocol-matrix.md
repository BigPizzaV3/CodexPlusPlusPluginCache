# Protocol matrix

| Concern | HTTP | gRPC | GraphQL |
|---|---|---|---|
| Client correction | 4xx semantics | canonical status code | typed field/error contract |
| Cancellation | request context | RPC/stream context | request context and resolver work |
| Capacity | body, handler, connection | message, stream, RPC | complexity, depth, pagination |
| Compatibility | methods, fields, status | protobuf field numbers and methods | schema fields, nullability, enums |
| Long-lived work | streaming/hijacked connection | stream send/receive loops | subscriptions |

Exercise malformed and oversized input, cancellation during effects, partial response writes, active-stream shutdown, and mixed client/server versions where applicable.

## Versioned client cutover

Connection-affecting configuration is state with a lifetime, not a set of fields to mutate in place.

1. Build and validate a complete immutable generation containing policy plus its client, transport, credentials, and trust configuration.
2. Publish that generation through one synchronization boundary. An operation captures it once before making any coupled authorization, routing, or outbound decision.
3. Prevent new operations from acquiring the retired generation. Operations already holding it may finish under the old contract.
4. Signal retirement by closing idle connections on the old client or transport. Go documents that this does not interrupt connections currently in use; it is not proof that application-owned response bodies or streams have ended.
5. Track or otherwise bound long-lived users when final resource release matters. Rotation without retirement accumulates pools, sockets, credentials, and telemetry dimensions.

Do not mutate `TLSClientConfig`, `Proxy`, dial hooks, or pool settings on an in-use `http.Transport`. Clone or construct a replacement before use, and independently clone mutable configuration reachable from it when ownership is not exclusive.
