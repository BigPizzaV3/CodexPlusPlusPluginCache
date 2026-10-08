---
name: go-security-hardening
description: "Use for generic Go exploit prevention: authz, SSRF, files, commands, crypto, secrets, and supply chain. Do not use for PCI scope."
license: Apache-2.0
compatibility: "Go 1.24 or newer; security-sensitive APIs and dependency advisories require current verification."
---

# Go security hardening

Trace data and authority from an attacker-controlled input to a protected effect. Do not report a vulnerability without a reachable mechanism.

## Define the trust boundary

Identify principals, assets, entrypoints, authorization decisions, privileged operations, secrets, persistence, outbound destinations, and audit evidence. Validate syntax and size at parsing; enforce authorization at the resource/action boundary.

## High-risk Go paths

- Build SQL with parameters; identifiers require allowlists or trusted construction.
- Treat URLs, redirects, DNS, proxies, and resolved IPs as SSRF decisions; prevent access to forbidden networks across redirects and rebinding.
- Constrain filesystem paths after canonicalization and open through an intended root; consider symlink and race behavior.
- Avoid shell interpretation. If process execution is necessary, pass fixed executables and structured arguments with a bounded context.
- Bound decoders, archive expansion, regex work, decompression, multipart data, and recursive structures.
- Use maintained cryptographic protocols and `crypto/rand`; separate keys from ciphertext and rotate through explicit versions.
- Keep secrets and sensitive payloads out of errors, logs, metrics, traces, URLs, and idempotency keys.

## Supply chain and artifacts

Minimize dependencies, verify modules and generated inputs, pin CI actions by immutable revisions, scan release archives, and prohibit unreviewed executable resources from published skills. A checksum proves identity, not trustworthiness.

For dependency or release-pipeline changes, read [references/dependency-integrity.md](references/dependency-integrity.md). Distinguish module authentication, cache verification, vulnerability reachability, source trust, build-input completeness, and artifact provenance; none substitutes for the others.

Read [references/threat-paths.md](references/threat-paths.md) for concrete review paths.

When an HTTP backend derives identity, scheme, host, or client certificate from proxy metadata, read [references/trusted-proxy-identity.md](references/trusted-proxy-identity.md). Treat forwarded fields as assertions whose authority comes from an authenticated, non-bypassable proxy path—not from the header name.

When designing or rotating encryption at rest, read [references/envelope-encryption-lifecycle.md](references/envelope-encryption-lifecycle.md). Separate KEK rewrap, DEK replacement, and algorithm migration; they repair different risks and require different evidence before old keys retire.

When Go launches another program, read [references/process-execution-boundary.md](references/process-execution-boundary.md). Fix executable identity, avoid unintended shell interpretation, minimize inherited environment and descriptors, bound I/O, and own cancellation, reaping, and any descendant process set explicitly. `CommandContext` and `WaitDelay` are lifecycle mechanisms, not a sandbox or proof that grandchildren stopped.

## Output contract

For each finding, state attacker control, required preconditions, protected effect, impact, and smallest correction. Separate exploitability from defense-in-depth.
