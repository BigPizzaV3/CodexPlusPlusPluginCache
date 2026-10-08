---
name: tahr-verify-security-fix
description: Retest a security fix in the exact vulnerable context, decide whether the exploit path is closed, and validate secure remediation and regression coverage without breaking legitimate behavior. Use after a vulnerability patch, remediation commit, PR fix, dependency or configuration change, failed security retest, or when developers need proof that a fix is complete rather than a superficial code change.
---

# Tahr Verify Security Fix

Verify the failed security control and the attacker outcome, not merely the
presence of a patch. Preserve the original finding, proof, context, and scope so
a different identity, tenant, route, payload, deployment, or render path cannot
produce a false pass.

## Establish retest authority and safety

1. Record the original finding ID, exact claim, required proof, original
   positive evidence, affected revision, fix revision, and supplied patch.
2. Record the original actor/role, owner/tenant/object, endpoint or workflow,
   method/content type, payload class, state, configuration, render/trigger
   context, and final impact.
3. Default to source and test inspection. Exercise only an explicitly
   authorized local or staging target. Do not infer permission for production,
   third-party, destructive, credential-changing, billing, or broad data tests.
4. Use disposable accounts and fixtures. Preserve protected identities and
   extract only the minimum proof sample.
5. Redact passwords, cookies, bearer/session tokens, API keys, private keys,
   reset codes, personal data, and customer data. Retain only type, location,
   and hash/fingerprint when necessary.

Read [exact-context-retest-verdicts.md](references/exact-context-retest-verdicts.md)
and create separate candidate, proof, and coverage records before testing.

## Inspect the remediation

Trace the original source-to-sink or missing-control path through current code.
Identify:

- the exact failed control and where the patch now enforces it;
- existing project policy, ownership/tenant scope, validator, sanitizer,
  encoder, parameter binding, allowlist, network guard, or safe API reused;
- adjacent route, resolver, service, repository, serializer, worker, webhook,
  content type, method, redirect, or render path that may bypass the fix;
- public behavior, auth semantics, tenant rules, response shape, data
  invariants, and framework lifecycle that must remain compatible.

Search for a concrete contradiction to the fix claim. A new helper, regex, test,
or guard name is not proof that the effective path uses it.

## Retest in the exact context

1. Reproduce the original benign baseline.
2. Replay the original exploit or closest safe equivalent using the original
   actor, ownership/tenant relation, route, content type, state, and trigger.
3. Confirm the expected denial, encoding, validation, scoped result, blocked
   network/file action, safe query, or non-execution result.
4. Read back durable state or observe the final sink. Do not stop at the first
   accepting or rejecting layer.
5. Run a positive control proving the legitimate owner, tenant, role, input, or
   workflow still succeeds.
6. Run class-relevant alternate encodings, methods, content types, object IDs,
   roles, tenant relationships, render contexts, redirects, or concurrency
   variants within the safe budget.
7. Test sibling paths that share the changed control.

Use fresh, identity-matched sessions and prove object/tenant ownership for
authorization retests. A `200`, body-size change, reflection, upload acceptance,
tool success flag, timeout, stale session, or WAF response is not a retest
verdict by itself.

## Assign an exact verdict

Assign one verdict from the reference contract:

- `FIX_VERIFIED`;
- `FIX_PARTIAL`;
- `NOT_FIXED`;
- `REGRESSION_INTRODUCED`;
- `INCONCLUSIVE`.

Support it with finding-local positive evidence, negative evidence, controls
tested, contradiction result, exact-context match, variants, limitations, and
final basis. Tooling or environment failure alone requires `INCONCLUSIVE`, not
a pass or failure.

## Remediate securely when authorized

If the user asks only for verification, report the defect and do not edit. If
the user also asks to fix it, read
[remediation-and-regression-gates.md](references/remediation-and-regression-gates.md)
and:

1. Localize only real repository files, symbols, routes, controls, and tests.
2. Repair the failed control at the smallest correct shared layer.
3. Reuse established project security primitives before creating parallel
   logic.
4. Avoid blacklist/regex-only fixes when parameterized, encoded, scoped,
   schema-validated, or allowlisted APIs exist.
5. Preserve public behavior except for the intentional rejection of the
   vulnerable action.
6. Add a regression test that fails on the vulnerable behavior and a positive
   control for legitimate behavior.
7. Run focused tests first, then feasible lint, type, build, integration, and
   broader tests.
8. Review the final diff for adjacent bypasses, superficial controls, generated
   edits, unrelated churn, secret leakage, and compatibility breaks.

Do not mark the fix ready because a test was added; confirm the test reaches
the original sink or protected action and fails without the effective control.

## Account for coverage and conclude

Account for the original path, every material alternate path, sibling consumer,
security-relevant variant, required negative control, legitimate positive
control, and test command. Give unresolved high-risk rows an exact blocker and
owner.

Do not issue `FIX_VERIFIED`, “ready,” or a clean conclusion while an original
proof element is missing, the exact context was not reproduced, a high-risk
bypass path is unreviewed, required tests did not run, or a material regression
remains. Use `FIX_PARTIAL`, `REGRESSION_INTRODUCED`, or `INCONCLUSIVE` and state
the next evidence needed.
