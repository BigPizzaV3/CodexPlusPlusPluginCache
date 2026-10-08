# Remediation And Regression Gates

Apply these gates only when the user authorizes implementation. Verification
alone does not authorize code changes, commits, pushes, or pull requests.

## Patchability gate

Patch only an accepted, source-grounded issue with:

- a real repository path or strong symbol/route grounding;
- an identified failed control;
- a bounded code area;
- a small behavior-preserving fix;
- a feasible test or explicit validation limitation.

Defer external-service issues, generated-source fixes that belong in a
generator, broad product-policy decisions, production-data changes, and weak
source guesses.

Group issues only when root cause, failed control, code area, trust boundary,
remediation, and regression tests match.

## Secure design gate

Choose the smallest correct enforcement layer and reuse project primitives:

- authorization: enforce owner/tenant/role/policy scope before the protected
  read or action; align list and object operations;
- query injection: use parameter binding and allowlist dynamic identifiers or
  operators;
- command injection: use argument arrays and strict command/argument allowlists;
- XSS: encode at the render boundary or use an approved sanitizer only for
  intentional HTML;
- SSRF: enforce schemes, hosts, resolved IP ranges, redirects, and egress at
  the shared fetch boundary;
- file/path: canonicalize and enforce a base directory; validate archive
  entries and actual content;
- mass assignment: allowlist writable fields and keep owner/tenant/role/status
  server-controlled;
- business logic: enforce the invariant atomically in the domain or data layer;
- secrets: remove material, use configuration/secret storage, redact logs, and
  identify manual rotation/history purge;
- dependency/config: make the smallest compatible version or setting change
  tied to the accepted issue.

Do not rely on a blacklist or regex when a structured safe API exists. Do not
move the same unsafe decision to another layer.

## Compatibility gate

Preserve unless the fix requires a documented security denial:

- routes, methods, GraphQL/RPC/CLI contracts, and response schemas;
- status-code families and error formats;
- authentication/session flows, role names, owner and tenant semantics;
- model relations, migrations, uniqueness, serialization, pagination, and
  framework lifecycle;
- logging and redaction behavior.

Document every intentional behavior change.

## Regression-test gate

Prefer the repository's nearby route, policy, service, serializer, validator,
query, integration, or domain test style. A strong test includes:

1. the malicious or unauthorized input that reached the original path;
2. the expected denial, safe query, encoding, validation, scoped result,
   blocked request, or preserved invariant;
3. a legitimate positive control;
4. final state/readback or sink observation;
5. owner/tenant/role attribution when authorization matters;
6. at least one material bypass variant;
7. no real secrets, customer data, production endpoints, or destructive
   protected-account operation.

Confirm the test fails against the vulnerable behavior when feasible. Do not
accept a mocked test that bypasses the effective policy, renderer, query,
network, file, worker, or protected action.

## Validation sequence

Run, when safe and available:

1. the focused security regression test;
2. nearby component/policy/service tests;
3. relevant integration or end-to-end tests;
4. lint, formatting check, typecheck, and build;
5. broader suite proportional to the patch risk.

Record every command, exit code, relevant result, and exact blocker for commands
not run. A missing environment or dependency is a limitation, not a pass.

## Independent diff review

Inspect the final diff for:

- a superficial or non-invoked control;
- bypass through adjacent routes, services, repositories, serializers, workers,
  methods, content types, redirects, or render contexts;
- broad refactor, formatting, dependency, lockfile, migration, or generated-file
  churn;
- behavior compatibility breaks;
- missing tests where a harness exists;
- hardcoded secrets, raw customer data, unsafe payloads, or weakened redaction;
- unrelated files or assessment artifacts.

## Ready gate

Call the remediation ready only when the failed control is repaired on the
actual path, exact-context retest passes, legitimate behavior passes, material
variants and sibling paths are accounted, required commands pass, the diff is
narrow, and residual risk is explicit.

Use `needs_patch_revision`, `blocked`, or the retest verdict
`FIX_PARTIAL|REGRESSION_INTRODUCED|INCONCLUSIVE` whenever a gate is not met.
