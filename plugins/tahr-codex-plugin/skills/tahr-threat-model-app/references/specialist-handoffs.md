# Specialist Handoffs

Use specialist Tahr skills to deepen a bounded part of the application graph.
The threat model remains the system of record for scope, evidence, threats,
decisions, tests, and coverage.

Treat every companion skill as optional. When it is not installed or callable,
keep the handoff `planned`, preserve its full contract in the model, and
continue the source review locally; never block or narrow full coverage.

## Contents

- [Handoff rules](#handoff-rules)
- [Outbound test contract](#outbound-test-contract)
- [Skill routing](#skill-routing)
- [Return and reconciliation](#return-and-reconciliation)

## Handoff rules

1. Send repository/target revision, stable model IDs, bounded surfaces, known
   evidence, unresolved claim, desired output, exclusions, and authorization.
2. Classify supplied claims only as `observed`, `intended`, `inferred`, or
   `unknown`; keep risk in `critical`, `high`, `medium`, or `low`, and confidence
   in `high`, `medium`, or `low`.
3. Every test handoff leaves the threat model as `planned`. It is a test
   hypothesis, never a result. Do not use language implying exploitation,
   confirmation, pass, failure, or remediation until a specialist returns
   evidence from the authorized target.
4. Never send raw credentials, tokens, private keys, personal data, or customer
   data. Use disposable fixtures and redacted evidence.
5. A specialist finding does not automatically become model truth. Verify its
   target, revision, reachability, actor, boundary, asset, and proof provenance.

## Outbound test contract

Provide every specialist test handoff with:

```yaml
handoff_id: HANDOFF-001
source_model_revision: MODEL-REVISION
destination_skill: tahr-test-authentication
related_ids: [THREAT-001, FLOW-001, DEC-001, TEST-001]
actor: "bounded attacker or principal"
asset: "specific protected asset"
boundary: "named trust or authorization boundary"
preconditions: []
fixtures_and_setup: []
objective: "one falsifiable test objective"
expected_control: "control that should hold"
attacker_success_signal: "evidence that the modeled abuse succeeded"
expected_denial_signal: "evidence that the modeled abuse was denied"
control_success_signal: "evidence that the expected control prevented it"
control_failure_signal: "evidence that the expected control did not hold"
evidence_to_collect: []
safe_target: "local or authorized staging target"
authorization_and_limits: "explicit scope and non-destructive bounds"
cleanup: []
destructive_risk: low
execution_status: planned
confidence: medium
```

Add endpoint/build/package identifiers and cleanup steps when relevant. Do not
substitute a generic request such as “test auth” for this contract.

## Skill routing

| Skill | Send from the threat model | Consume back into the model |
|---|---|---|
| `tahr-map-attack-surface` | Frozen revision, roots, deployment variants, known actors/zones, exclusions, and coverage questions. | Deterministic entrypoint/component/integration/store/admin inventory, trust-boundary candidates, unread items, and evidence locations. Reconcile nodes, flows, and coverage. |
| `tahr-test-authentication` | Auth flows, credential/token/session assets, assurance invariants, actors, policy variants, and test contracts. | Authentication/session observations, bounded test evidence, denial baselines, limitations, and untested paths. Update controls, threats, decisions, and tests. |
| `tahr-test-access-control` | Actor/role/tenant/resource/action matrix, ownership boundaries, identifiers, fixtures, and expected policy. | Horizontal, vertical, ownership, and tenant enforcement evidence with exact request/policy/repository locations. Update authorization edges and control rows. |
| `tahr-trace-dangerous-inputs` | Untrusted sources, parsers, transformations, boundary crossings, candidate sinks, encodings, and target assets. | Connected source-to-sink traces, sanitization/validation evidence, reachability conditions, and broken paths. Do not import disconnected sink matches as threats. |
| `tahr-test-business-workflows` | Workflow states, invariants, roles, transitions, concurrency/replay assumptions, limits, and business impact. | State-machine, ordering, replay, race, quota, and abuse evidence. Link results to the originating flow, invariant, and asset. |
| `tahr-audit-secrets-config` | Config/IaC roots, deployment environments, secret classes, trust zones, redaction rules, and known exceptions. | Secret/config exposure evidence, provenance, environment reach, and compensating controls. Store only redacted evidence and disposition deployment coverage. |
| `tahr-test-ai-agents` | AI applicability evidence, initiating identity/tenant, prompts, retrieval, tools, providers, side effects, data classes, and budgets. | Prompt/retrieval/tool authorization and exfiltration traces, provider/supply-chain boundaries, evaluation evidence, and quota-abuse results. Use only when the AI lane applies. |
| `tahr-audit-android` | Package/build/version, manifests, link handlers, network/storage flows, backend IDs, mobile assets, and authorized artifact/device. | Android component, exported-surface, deep-link, storage, IPC, and network evidence tied to the exact build. Reconcile mobile boundaries and backend continuations. |
| `tahr-verify-security-fix` | Original threat/finding evidence, invariant, affected revisions, fix revision, exploit preconditions, regression test, and expected denial. | Fix-presence, reachability, regression, and negative-control evidence plus residual gaps. Update—not erase—the original decision and coverage history. |

## Return and reconciliation

Require the specialist to return handoff ID, skill/version, exact target and
revision, scope, actions actually performed, evidence references, result for
each signal, limitations, untouched surfaces, cleanup, and recommended ledger
changes. If no action ran, record that explicitly; never infer execution from a
plan, payload, static match, or proposed command.

For each return: verify provenance; split claims into evidence records; connect
them to existing graph IDs; update the test record without rewriting history;
store a conclusive `result.outcome` only when the returned observed signals and
runtime/test-result evidence support it;
reassess risk and confidence separately; create or update the response decision;
and set coverage only to `pending`, `reviewed`, `reviewed_no_issue`,
`out_of_scope`, or `deferred_with_specific_reason`. Rerun semantic validation
and the independent challenger before changing model status to `complete`.
