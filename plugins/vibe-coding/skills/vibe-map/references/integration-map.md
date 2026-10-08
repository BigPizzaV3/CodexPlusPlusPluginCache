# Integration Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/integration_map.md` as the evidence map for external providers, internal service boundaries, credentials/config, webhooks, SDK clients, network failure semantics, and contract ownership.

## Inspect

API clients, SDK wrappers, env/config files, secrets references, webhooks, callback routes, background jobs, provider-specific adapters, generated clients, mocks/fakes, tests, rate limit code, retry policies, observability, docs, and deployment manifests.

## Map content

### Evidence and IDs

- Write or update `docs/integration_map.md` when possible. If writing is unavailable, print the complete markdown content in chat.
- Use stable IDs and preserve existing IDs: integration `INT-*`, provider `PROV-*`, credential/config `CRED-*`, webhook `WH-*`, external contract `EXT-*`, adapter `ADAPT-*`.
- Anchor all entries to current code/config/tests/docs. Never expose secret values; record only variable names, config keys, and ownership.

### Coverage

Cover provider purpose, owner adapter, request/response contracts, auth/credentials, environments, webhooks, retries, timeouts, rate limits, idempotency, error mapping, sandbox/test mode, mocks/fakes, privacy/security boundaries, observability, rollout/rollback, and provider capability assumptions.

### Entry details

For each integration, capture provider, business capability, owner files/symbols, credentials/env, direct callers, callbacks/webhooks, failure modes, retry/idempotency semantics, test strategy, and operational runbook links if present.

## Markdown structure

Use summary, integration index, credentials/config table, provider contracts, webhook matrix, failure/retry semantics, mocks/test modes, security/privacy boundaries, observability, unknowns, assumptions.
