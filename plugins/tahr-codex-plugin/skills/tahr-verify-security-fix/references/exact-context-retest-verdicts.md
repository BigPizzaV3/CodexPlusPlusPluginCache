# Exact-Context Retest Verdicts

## Separate the records

Maintain three record types:

- **candidate record:** suspected bypasses, alternate paths, and test ideas;
- **proof record:** exact original claim, evidence, controls, retest attempts,
  contradiction result, and verdict;
- **coverage record:** original path, variants, siblings, commands, and
  environments reviewed or unresolved.

Candidate or coverage evidence never substitutes for finding-local proof.

## Retest proof record

```json
{
  "finding_id": "FIND-001",
  "claim_under_test": "Peer user can update another user's order.",
  "required_proof": "Owner-attributed object update succeeds for a distinct peer identity.",
  "base_revision": "<vulnerable sha>",
  "fix_revision": "<fixed sha>",
  "exact_context": {
    "actor": "peer user",
    "role": "member",
    "tenant_relation": "same tenant",
    "owner_relation": "non-owner",
    "object_fixture": "owner-attributed disposable order",
    "entrypoint": "PATCH /api/orders/:id",
    "method_content_type": "PATCH application/json",
    "state": "open",
    "payload_class": "owner object ID",
    "trigger_or_render_context": null,
    "environment": "staging",
    "configuration": "<safe fingerprint>"
  },
  "context_match": "exact|materially_equivalent|mismatched",
  "control_expected": "owner scope before update",
  "control_observed": "",
  "contradiction_searched": [],
  "contradiction_result": "not_contradicted|contradicted|partially_contradicted|insufficient_evidence",
  "original_attack_result": "",
  "post_fix_attack_result": "",
  "negative_evidence": [],
  "legitimate_positive_control": [],
  "variants_tested": [],
  "durable_readback": [],
  "limitations": [],
  "verdict": "FIX_VERIFIED|FIX_PARTIAL|NOT_FIXED|REGRESSION_INTRODUCED|INCONCLUSIVE",
  "final_basis": ""
}
```

## Verdict definitions

### `FIX_VERIFIED`

Use only when:

- the exact or materially equivalent original context was reproduced;
- the original attack no longer reaches its final impact;
- the effective security control is observed on the real path;
- required negative controls pass;
- legitimate positive behavior still works;
- material encodings, methods, roles, tenant/owner relations, render contexts,
  redirects, concurrency, and sibling paths are tested or dispositioned;
- no high-risk coverage row remains unresolved;
- regression tests reach the original sink/protected action and pass.

### `FIX_PARTIAL`

Use when the original path is blocked but a material variant, sibling path,
environment, or regression requirement remains open, or the patch reduces
impact without repairing the full failed control. Name what remains vulnerable
or unproven.

### `NOT_FIXED`

Use when the original exploit or an equivalent bypass still reaches the final
impact, the new control is not invoked/effective, or the patch only changes a
cosmetic/intermediate symptom.

### `REGRESSION_INTRODUCED`

Use when the vulnerable action is blocked but legitimate behavior, API
compatibility, authorization semantics, tenant rules, data invariants,
availability, or another security property is materially broken. Also report
whether the original security issue remains.

### `INCONCLUSIVE`

Use when the exact context cannot be recreated, identity/session trust is
invalid, fixtures or target are unavailable, the revision/config is uncertain,
tooling fails, or required proof/negative controls cannot be collected. An
operational limit is not a pass or a failure.

## Class-specific final-outcome gates

- **Authorization:** use validated distinct identities and owner/tenant-attributed
  objects; prove unauthorized read/write is denied and legitimate owner succeeds.
- **XSS:** prove the original render context no longer executes JavaScript in a
  browser/runtime; reflection or storage alone is insufficient.
- **SQL/query injection:** prove untrusted values remain data through the real
  query path and regression tests exercise the vulnerable builder/operator.
- **Command injection:** prove argument separation/allowlisting on the executed
  process path and no command side effect occurs.
- **SSRF:** prove scheme/host/address/redirect controls on the real fetch sink;
  test allowed destination and blocked private/metadata destination safely.
- **File/archive/upload:** prove canonical path/content/parser controls and the
  stored, rendered, extracted, or processed outcome.
- **Business logic/race:** capture baseline, malicious action, final durable
  state, readback, expected invariant, and concurrency/boundary variants.
- **Session/account lifecycle:** use disposable accounts and fresh sessions;
  verify final login/session/action behavior without damaging protected users.
- **Dependency/configuration:** bind the retest to the deployed version/config
  and reachable behavior; a manifest or header change alone is insufficient.

## Coverage record

Give each original path, variant, sibling consumer, environment, negative
control, positive control, and test command one state:
`passed`, `failed`, `not_applicable`, or `blocked_with_specific_reason`.

Any high-risk blocked row prevents `FIX_VERIFIED`.
