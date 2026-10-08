---
name: tahr-audit-secrets-config
description: Audit application-owned secrets, cryptography, dependency reachability, infrastructure-as-code, containers, CI/CD, cloud permissions, and runtime security configuration with evidence and false-positive controls. Use for repository hardening, deployment review, leaked-key triage, dependency/CVE review, exposed debug or admin surface checks, or pre-release configuration audits.
---

# Tahr Audit Secrets and Config

Find configuration and supply-chain weaknesses that become real attacker capabilities. Do not turn a keyword, permissive development setting, or package advisory into a vulnerability without proving production relevance and reachability.

## Establish scope and safety

Inspect source, committed configuration, lockfiles, build files, IaC, containers, CI/CD, and documentation read-only by default. Inspect git history only when the user includes it. Do not search unrelated home directories, credential stores, or `.git` working metadata.

Never validate a discovered credential against a live provider unless the user explicitly authorizes that exact action and the account is disposable. Never print, copy, commit, or persist a raw secret. Record type, file and line, source, scope, length, a short redacted preview, and a SHA-256 fingerprint.

Read [references/config-audit-matrix.md](references/config-audit-matrix.md) for the audit families. Read [references/exploitability-research.md](references/exploitability-research.md) before using advisory or CVE information.

## Inventory every configuration plane

Enumerate:

- application config and environment loading, including defaults and fallbacks;
- secret-manager, KMS, key-vault, certificate, and signing-key integrations;
- manifests and lockfiles for production, development, plugins, images, actions, and build tools;
- Dockerfiles, compose files, Kubernetes, Helm, Terraform, Pulumi, CloudFormation, Ansible, systemd, IIS, reverse proxies, and serverless definitions;
- CI workflows, release jobs, artifact publishing, package registries, caches, and deployment scripts;
- browser/mobile public configuration, source maps, runtime config endpoints, health, metrics, debug, admin, docs, and actuator surfaces;
- logging, telemetry, backups, data exports, error handling, and crash artifacts.

Mark generated, vendored, example, fixture, test-only, local-only, and production-relevant paths. Missing deployment material is a coverage gap, not proof of secure deployment.

## Review secret exposure

Search provider-specific formats and contextual assignments for cloud keys, OAuth clients, signing/session/webhook secrets, database and queue URLs, private keys, developer tokens, payment keys, AI provider keys, backup credentials, and privileged API keys.

For each hit:

1. Determine whether it is application-owned committed content, committed history, generated output, a placeholder, documentation, test fixture, environment reference, secret-manager lookup, public browser key, or local checkout metadata.
2. Exclude `.git/config`, remote URLs, hooks, logs, and scanner checkout credentials from application findings. A secret genuinely committed in repository history remains in scope.
3. Determine the exposure path: shipped client bundle, public artifact, image layer, CI log, repository audience, runtime endpoint, backup, or developer-only file.
4. Determine likely privilege, environment, restrictions, rotation status, and blast radius without using the raw value.
5. Inspect whether the application fails closed when the secret is absent or falls back to a default, empty, or hardcoded value.
6. Classify the result as `verified`, `static-confirmed`, `candidate`, or `rejected` with exact reasons.

Do not report environment-variable references or vault lookups as hardcoded secrets. Treat public client identifiers and publishable keys according to provider design; require missing restrictions or privileged use before claiming impact.

## Review production controls

Trace configuration from source default through environment override to deployed consumer. Look for:

- debug/test modes, stack traces, verbose errors, install/setup routes, sample accounts, default credentials, and unrestricted metrics or admin endpoints;
- fail-open authentication, authorization, origin, webhook-signature, feature-flag, or network-policy behavior when configuration is missing or malformed;
- wildcard or reflected credentialed CORS, unsafe cookie/session flags, proxy trust, generated-link host trust, weak TLS, missing transport enforcement, and cache-key confusion;
- overly broad IAM, public storage, unauthenticated services, exposed databases, unrestricted egress, cloud metadata access, and security-group/network-policy gaps;
- privileged containers, root users, dangerous capabilities, host namespaces, writable mounts, Docker socket exposure, unpinned images, and secrets embedded in layers;
- untrusted pull-request code reaching privileged CI secrets, mutable third-party actions, artifact poisoning, unsafe interpolation, and excessive workflow permissions;
- sensitive logging, personal data in URLs, backups without access controls, client-side secret storage, and long retention;
- weak password hashing, encryption, randomness, key/nonce/IV reuse, insecure verification, or custom cryptography tied to a real security property.

Read the code or deployment path that consumes each setting. A permissive example file or a development-only branch is not a production finding unless it can affect a shipped environment.

## Establish dependency reachability

For every dependency lead:

1. Prove the exact resolved version from a lockfile, image digest, installed artifact, or reproducible build evidence.
2. Identify the affected function, class, feature, plugin, image component, action, or transitive path.
3. Prove first-party use and a reachable entrypoint, job, parser, upload, request, build, or deployment path.
4. State the attacker-controlled input or prerequisite.
5. Inspect wrappers, disabled features, sandboxing, network controls, version backports, and vendor fixes.
6. Separate `version-candidate`, `reachable-candidate`, `attempted`, and `proven` states.

Do not report a CVE because a package name appears. If runtime reachability cannot be established, produce a precise upgrade/hygiene note or validation target rather than an exploitable finding.

## Challenge and report

For every accepted claim, name the exact failed control and seek the strongest contradiction. Distinguish severity from confidence. Link configuration primitives into an attack chain only when every hop is independently proven.

Report:

- evidence-backed findings with redacted proof, production relevance, affected capability, remediation target, and regression or policy test;
- candidates needing runtime, cloud, build, or owner confirmation;
- rejected hits with placeholder/test/dev/framework control evidence;
- coverage by configuration plane, including missing deployment artifacts and unreviewed environments.

Do not say an application or deployment is secure when production configuration, runtime identity, cloud state, or dependency reachability was unavailable.
