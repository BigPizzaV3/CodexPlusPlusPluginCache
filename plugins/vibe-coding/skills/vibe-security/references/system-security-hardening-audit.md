# System Security Hardening Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit reachable abuse paths across identity, credential attacks, authorization, sessions, egress/parsers, host/container runtime, secrets, dependencies, and detection.

## Domain invariants

- Threat claims identify asset, trust boundary, attacker capability, reachable entry point, authoritative control, concrete impact, and safe validation; hypothetical checklist items are not findings.
- Credential abuse defenses combine account-, network-, device/session-, and risk-aware controls with bounded distributed state, progressive delay/challenge/lockout, generic responses, and anti-DoS recovery.
- Authentication, authorization, tenant, object, and privilege decisions are enforced server-side at every authoritative operation, including jobs, exports, admin, and indirect object references.
- Session/token issuance, rotation, revocation, fixation protection, expiry, device/account recovery, MFA/re-auth, and logout invalidate the intended scope without leaking account existence.
- Outbound fetch, DNS resolution/rebinding, redirects, proxying, URL/IP normalization, parser/decompression limits, and file/content handling constrain SSRF and resource-exhaustion paths.
- Host/container/process identity, capabilities, filesystem, seccomp/sandbox, network, metadata service, kernel/runtime patching, and secret mounts follow least privilege and fail closed.
- Secrets and keys have inventory, owner, scope, storage, rotation/overlap, revocation, audit, and compromise recovery; no secret enters logs, prompts, artifacts, images, or source.
- Dependencies/builds use trusted registries/sources, locked identities, reviewable updates, provenance/signing where established, and actionable vulnerability policy.
- Security events preserve actor/target/outcome/correlation without sensitive payloads and feed owned detection, rate-limit visibility, incident containment, and recovery runbooks.

## Audit method

1. Build a narrow threat model for the selected asset/path and trace entry → parsing/identity → authorization → state/side effect → response/log/detection.
2. Inspect every enforcement replica/store and race/failure mode for brute-force counters, lockout, token revocation, tenant checks, and privilege changes.
3. Trace URL/DNS/redirect/content parsing and host/container egress to the actual network boundary; test normalization and resource limits safely.
4. Map secret/dependency/artifact provenance and rotation/revocation behavior through CI, runtime, backups, telemetry, and incident recovery.
5. Validate only with non-destructive fixtures, owned test accounts, synthetic tokens/data, and bounded rates; do not perform uncontrolled scanning or credential attacks.

## Priority model

- **P0:** remote code execution, auth bypass, privilege escalation, secret theft, tenant escape, destructive abuse, or critical denial of service.
- **P1:** a reachable hardening, brute-force, isolation, supply-chain, or detection defect with clear security impact.
- **P2:** a lower-risk but concrete defense-in-depth, auditability, or recovery issue.
