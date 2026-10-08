---
name: tahr-secure-app
description: Perform an evidence-backed, pentester-style security review of an application from source, configuration, specifications, tests, and optionally an explicitly authorized local or staging runtime. Use for comprehensive app security audits, pentest readiness, pre-release reviews, dangerous-flaw discovery, or coordinating the Tahr specialist skills; also use when a prior scanner or LLM review created confidence that needs independent verification.
---

# Tahr Secure App

Review the application as an attacker would: map what is reachable, form target-specific hypotheses, try to disprove each candidate, require exploit-class proof, and account for what was not tested.

## Set the review mode

Choose one mode and state it before reviewing:

- `deep`: inspect every admitted first-party file and close every high-risk gap. Use by default for “secure this app.”
- `focused`: review a named feature or boundary deeply and list excluded areas.
- `retest`: verify an accepted fix with `$tahr-verify-security-fix`.

Treat source and local artifact inspection as read-only review. Run runtime probes only against a local, disposable, or explicitly authorized test target. Do not infer permission to test production, third parties, other tenants, or real accounts. Use low-impact canaries, disposable objects, bounded concurrency, and reversible actions. Never persist raw passwords, tokens, cookies, private keys, personal data, or cloud credentials.

## Create the evidence ledger

Read [references/evidence-contract.md](references/evidence-contract.md) before classifying any issue. Use [assets/review-report.template.json](assets/review-report.template.json) when a durable JSON artifact is useful. Write artifacts only where the user requests or in a clearly named local review directory; do not modify application code during a review.

Keep three lanes separate throughout the work:

1. `findings`: claims that meet the applicable proof status.
2. `candidates`: concrete leads whose required proof is incomplete.
3. `coverage`: reviewed, partial, blocked, skipped, and not-applicable scope.

Never promote a scanner hit, dangerous function name, package advisory, route name, response status, reflection, timing change, accepted upload, or prior report statement by itself.

## Map before judging

Inventory the application before searching for bugs:

- first-party files, frameworks, manifests, lockfiles, infrastructure, deployment and CI configuration;
- HTTP routes, GraphQL resolvers, RPC/gRPC handlers, WebSockets/SSE, webhooks, uploads, callbacks, serverless functions, CLI entrypoints, queues, jobs, and externally influenced schedulers;
- actors, roles, service principals, tenants, organizations, groups, ownership fields, sessions, and recovery flows;
- assets, data stores, secrets, billing or entitlement state, admin/debug functions, AI models, RAG sources, tools, and external integrations;
- browser routes, lazy chunks, source maps, API clients, mobile deep links, and undocumented or legacy API versions.

Follow thin controllers into middleware, policies, services, repositories, serializers, templates, and asynchronous consumers. Mark each admitted item `reviewed`, `partial`, `blocked`, `skipped-with-reason`, or `not-applicable`. Low apparent risk is a reason to review briefly, not to disappear the file from coverage.

Use `$tahr-map-attack-surface` when the reachable surface or identity coverage is unclear.

## Build attacker hypotheses

Create target-specific hypotheses in four forms:

- `actor -> action -> resource -> owner/tenant boundary -> expected decision`;
- `untrusted source -> transformations -> dangerous sink -> expected control`;
- `workflow state -> attempted transition/replay/race -> invariant -> authoritative readback`;
- `deployment input/default -> privileged capability or sensitive asset -> compensating control`.

Prioritize unauthenticated paths, cross-user or cross-tenant boundaries, state-changing functions, sensitive exports, callbacks and outbound fetches, file processing, server-side rendering, privileged fields, legacy versions, recovery paths, background workers, and AI tool use.

## Route to specialist skills

Read [references/review-routing.md](references/review-routing.md) and invoke only the applicable specialist skills. A comprehensive review normally includes:

- `$tahr-test-authentication` for login, recovery, MFA, OAuth/OIDC, tokens, cookies, and session lifecycle;
- `$tahr-test-access-control` for a complete actor-resource-action model,
  path-specific authorization traces, proof-gated findings, and safe validation;
- `$tahr-trace-dangerous-inputs` for injection, browser sinks, outbound requests, parsers, files, and uploads;
- `$tahr-test-business-workflows` for state, pricing, quota, invitation, approval, replay, and race abuse;
- `$tahr-audit-secrets-config` for secrets, cryptography, dependencies, infrastructure, and deployment defaults;
- `$tahr-test-ai-agents` or `$tahr-audit-android` when those technologies exist;
- `$tahr-threat-model-app` when a full-system threat model and validation plan
  are requested for the entire existing application.

## Investigate and challenge

For every candidate:

1. Cite the exact route, file, line or symbol, actor, input, object, or configuration involved.
2. Trace reachability across files and processes; distinguish dead, test, generated, dependency, and production code.
3. Name the expected control and inspect its actual placement and applicability.
4. Search for the strongest contradiction: middleware, policy, tenant filter, validator, encoder, allowlist, safe parser, parameter binding, environment guard, or framework behavior.
5. Record the contradiction verdict as `not-contradicted`, `contradicted`, `partially-contradicted`, or `insufficient-evidence`.
6. Define the exact claim and proof needed before attempting runtime validation.
7. Establish a normal baseline and an expected-denial or benign negative control.
8. Use the smallest safe proof. Record request/state/browser/callback/readback evidence without raw secrets.
9. Search one bounded set of sibling routes, helpers, models, and variants after a strong seed; give each variant its own evidence.

Operational failure is a limitation, not target-side proof. Stale authentication, missing roles, WAF or rate limiting, callback outage, tool error, or target instability must not become either a finding or a false-positive conclusion.

## Close coverage and chain impact

Before concluding:

- resolve every high-risk candidate as accepted, rejected with exact control evidence, out of scope, or deferred with a specific blocker;
- list unreviewed files, endpoints, identities, tenants, workflows, sinks, environments, and runtime-only claims;
- distinguish “tested with no issue observed” from “not tested”;
- link only independently proven primitives into attack chains, and require evidence for every hop;
- avoid “secure” or “no vulnerabilities” language when material gaps remain.

A clean result means only: no verified findings were produced within the stated, completed scope. It is not a guarantee about omitted or blocked scope.

## Deliver the review

Lead with dangerous, reachable issues. For each finding include the exact claim, affected location, preconditions, required proof, positive and negative evidence, contradiction result, impact, confidence, limitations, remediation target, and a repo-native regression test. Keep severity separate from confidence.

Summarize candidates and coverage gaps after findings. Redact sensitive substrings while preserving type, source, length, scope, expiry where relevant, and a non-secret fingerprint.

Validate a JSON review artifact with:

```bash
python3 <skill-directory>/scripts/validate_review.py path/to/tahr-review.json
```

Use `--strict` only when claiming a deep review has no unresolved high-risk scope.
