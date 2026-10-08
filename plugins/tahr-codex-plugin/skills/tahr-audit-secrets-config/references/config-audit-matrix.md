# Configuration Audit Matrix

Use the applicable rows and record evidence or a skip reason for each admitted plane.

| Plane | High-signal questions | Required evidence before a finding |
|---|---|---|
| Secret loading | Are production secrets literals, defaults, client-shipped, logged, or exposed in artifacts? Does missing config fail closed? | Real application-owned value class, exposure path, affected privilege, redacted location |
| Authentication/session | Are signing keys weak or shared? Are secure cookie, expiry, rotation, issuer, audience, and revocation controls enforced? | Consuming code/config and concrete weakened boundary |
| Authorization/tenant | Can missing policy, role, tenant, or scope config enable a fail-open path? | Reachable decision path and expected control |
| CORS/proxy/host | Can an attacker origin use credentials? Are forwarded host/scheme/client IP values trusted broadly? | Production-relevant route, credential state, and browser/server consequence |
| Debug/admin/observability | Are debug, docs, metrics, actuator, tracing, profiling, install, or admin surfaces exposed? | Reachability plus sensitive data/action, not route name alone |
| TLS/network/egress | Is cleartext accepted? Are internal services, metadata, databases, or control planes reachable? | Deployed policy or safe authorized runtime evidence |
| Containers/orchestration | Root, privileged mode, host namespaces, capabilities, socket, writable mounts, weak policies? | Workload path plus concrete escape/host/data capability or defense-in-depth label |
| Cloud IAM/storage | Public resources, wildcard permissions, confused-deputy trust, weak resource policies? | Exact principal/resource/action/condition and exposure path |
| CI/CD | Can untrusted input or PR code access secrets, runners, artifacts, releases, or deployments? | Trigger-to-privilege path and trust-boundary evidence |
| Logs/backups/errors | Can unauthorized actors reach sensitive logs, backups, stack traces, or exports? | Data class, access path, actor, protection state |
| Crypto | Is a weak primitive, static key/IV, predictable RNG, or custom validation protecting a real security property? | Concrete use, asset, attacker influence, and missing compensating control |
| Dependencies/images/actions | Is an affected version actually resolved and its vulnerable feature reachable? | Exact version, first-party use, entrypoint, prerequisite, mitigations checked |
| Client/mobile config | Are privileged provider keys, internal endpoints, debug flags, or secrets shipped to the client? | Shipped artifact evidence and actual privilege/restriction analysis |

## False-positive traps

- placeholders, examples, fixtures, intentionally public identifiers, and redacted strings;
- `process.env`, `getenv`, vault/KMS/key-vault/secret-manager lookups without a literal fallback;
- development-only servers or configs excluded from production builds;
- package presence without the affected feature, import, or reachable entrypoint;
- weak hashes used only as non-security checksums;
- headers or TLS controls enforced at a reverse proxy that is actually part of the deployment;
- `.git` working metadata and authenticated clone URLs that are not committed application content.

For every rejection, cite the exact trap and evidence. Do not silently suppress a precise hit.
