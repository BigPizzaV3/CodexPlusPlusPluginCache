# API Error Investigation Playbook

Use for HTTP failures, unexpected API responses, timeouts, malformed responses, and API regressions.

## 1. Capture request identity

Extract:
- method and endpoint;
- environment/base URL;
- timestamp and timezone;
- request/correlation ID;
- account/customer;
- resource/object ID;
- status code;
- response body/error code;
- relevant request headers and payload fields, excluding secrets.

Never request credentials, bearer tokens, API secrets, or private keys.

## 2. Interpret by status family

### 400 / 422
Check schema, validation, required fields, data types, enum values, content type, version changes, and payload differences.

### 401
Check token presence/expiry, issuer/audience, clock skew, token refresh, API-key validity, and environment mismatch.

### 403
Check scopes/roles, account permissions, feature entitlement, object ownership, IP/network policy, and tenant boundary.

### 404
Check resource ID, endpoint/version, environment, deletion state, tenant/account, eventual consistency, and routing.

### 409
Check duplicate/idempotent requests, state transition conflicts, concurrency, stale version, and resource locks.

### 429
Check per-key/account/IP limits, burst vs sustained rate, Retry-After, client retry behavior, and recent policy changes.

### 500
Look for same-request application exception, code regression, unhandled edge case, DB/dependency failure, bad data/state, and feature flag/config changes.

### 502 / 503 / 504
Check upstream health, gateway/proxy, dependency latency, service saturation, connection pools, DNS/network, scaling, and maintenance/deploy events.

## 3. Compare failed vs successful requests

Compare:
- endpoint and method;
- account/tenant;
- payload shape;
- headers (without exposing secrets);
- resource state;
- app/API version;
- region;
- dependency path;
- timing;
- feature flags.

A single difference may be a discriminator, not proof.

## 4. Telemetry checks when available

Use any available telemetry source (Datadog is optional):
- search exact request/correlation ID;
- inspect trace span where failure originates;
- identify first failing service/span;
- inspect error fingerprint and stack trace;
- compare dependency/DB spans;
- check latency/saturation around the event;
- check same endpoint across customers;
- check deployment/config/flag changes.

## 5. Regression test

For suspected regression:
- establish last known good;
- establish first known bad;
- compare versions;
- map code/config changes touching the failing path;
- check whether rollback/disable/old-version traffic behaves differently.

## 6. Output ownership

Classify likely ownership:
- customer/client-side;
- product/application;
- platform/infrastructure;
- third-party dependency;
- shared/multi-factor;
- unknown.

Do not assign blame without evidence.

## 7. Minimum useful next evidence

If the case is under-specified, request only the highest-value fields:
1. request/correlation ID;
2. timestamp + timezone;
3. endpoint/action;
4. environment;
5. exact response/error;
6. affected resource/account.

Then investigate before asking for more.
