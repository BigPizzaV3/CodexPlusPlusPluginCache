# API and schema evolution

Identify the schema owner, actual protocol/encoding, generated client versions and supported rollout window. Compare old/new producers and consumers in both directions. A schema diff shows a change, not proof that it breaks a supported consumer.

- For HTTP/OpenAPI, distinguish request acceptance from response guarantees. Trace requiredness, nullability, defaults, unknown fields, enum expansion, pagination and error/status behavior into real generated clients. A looser response type can break a client requiring a field.
- For GraphQL, inspect resolver behavior, the direction of input/output nullability changes, removed fields, persisted operations and client enum handling. Schema validity alone does not prove an existing operation still executes or preserves authorization.
- For Protobuf, distinguish binary wire compatibility, ProtoJSON, generated code and application meaning. Field numbers are identities; reserve deleted numbers/names where appropriate. New enum values can break exhaustive client code even when wire-safe. Wider numeric fields need rollout constraints before writers emit values old readers cannot represent.
- For events, select the actual registry compatibility mode and retained/replayed consumers. Check historical payloads and mixed consumers. Database migration belongs to the database skill; this boundary owns the exposed contract and its consumers.

Use repository-native generators and contract tests with fixed inputs. Do not invent SDK versions or universal compatibility policies. Select a compatibility window, adapter or staged rollout when supported consumers require it.

Consult version-matched [OpenAPI](https://spec.openapis.org/oas/latest.html), [GraphQL](https://spec.graphql.org/) and [Protobuf](https://protobuf.dev/programming-guides/proto3/#updating) documentation only for protocols in the target.
