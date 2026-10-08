# Threat Evidence and Quality Gates

## Contents

- [Evidence gate](#evidence-gate)
- [Contradiction gate](#contradiction-gate)
- [Material-threat gate](#material-threat-gate)
- [Attack-path gate](#attack-path-gate)
- [Risk and response gate](#risk-and-response-gate)
- [Validation safety gate](#validation-safety-gate)
- [Privacy and AI gates](#privacy-and-ai-gates)
- [Coverage gate](#coverage-gate)
- [Independent challenge gate](#independent-challenge-gate)
- [Publication gate](#publication-gate)

## Evidence gate

- Treat current source, configuration, IaC, and explicitly authorized runtime
  observations as evidence of implementation.
- Treat specifications, diagrams, policies, role matrices, requirements, and
  workflow documents as evidence of intent.
- Treat framework behavior as observed only when its version, configuration,
  invocation, and applicability are established.
- Separate each observed, intended, inferred, or unknown claim. Never use a
  catalog match, route name, missing local check, or document statement as
  sufficient proof of a control gap.
- Cite precise, redacted evidence for every concrete customer-visible claim.

## Contradiction gate

Before retaining a missing or bypassable control:

1. Trace the full synchronous and asynchronous path.
2. Inspect global and local middleware, policies, domain services,
   repositories, serializers, validators, framework hooks, provider controls,
   network controls, and IaC.
3. Distinguish declaration from invocation and invocation from effective
   enforcement for this actor, asset, and path.
4. Record the locations searched and the strongest supporting and
   contradicting evidence.
5. Reject or narrow a contradicted threat. Use `validation_required` when an
   important control remains unknown.

Operational failure, inaccessible files, stale credentials, or missing test
accounts are limitations, not evidence that the application is vulnerable or
secure.

## Material-threat gate

Retain a threat only when it connects:

- a realistic actor and goal;
- an affected asset or security property;
- implementation-backed flows and boundaries;
- concrete preconditions and abuse steps;
- visible, intended, assumed, missing, or unknown controls;
- plausible business impact;
- a security decision and validation test.

Omit or demote generic code smells and taxonomy items that cannot make those
connections. Merge repeated endpoint observations into a systemic threat when
the actor, control, and impact are equivalent.

If no candidate survives, publish empty threat, attack-path, decision,
validation-test, and question ledgers. A clean model is supported by its
populated manifest, graph, implemented invariants and controls, coverage, and
independent challenge—not by an invented low-value threat.

## Attack-path gate

Build paths from existing IDs. Preserve the initial actor, preconditions,
entrypoint, each boundary crossing, required threat/control gap, intermediate
asset or privilege, and final impact. Mark an uncertain step `conditional` and
name the test that would resolve it. Never invent a bridge between unrelated
risks.

## Risk and response gate

Rank with explicit reasoning about exposure, privilege, complexity, user
interaction, asset sensitivity, tenant/role reach, confidentiality, integrity,
availability, privacy, financial and operational impact, control strength,
and evidence coverage.

Keep risk separate from confidence and assurance. Do not use `critical` merely
because a control was not supplied; require a credible high-impact path and
state the missing preconditions. For every critical or high threat, assign a
response, owner, next action, residual risk, and validation test. Record risk
acceptance as a decision with rationale and review date.

## Validation safety gate

Specify tests without executing them unless the exact local or staging target
and objective are authorized. Require disposable identities and data, bounded
non-destructive actions, a normal baseline, expected denial/non-execution,
attacker-success and control-success signals, authoritative state readback,
minimal evidence collection, and cleanup.

Never test production, third parties, other customers, real accounts, or
unbounded resource exhaustion by implication. Never preserve raw secrets or
customer data in the plan or evidence.

## Privacy and AI gates

Enable privacy analysis only when personal, sensitive, behavioral, location,
identity, financial, health, or regulated data is evidenced. Trace collection,
linkability, identifiability, detectability, disclosure, awareness/consent,
retention, deletion, residency, access, and third-party processing.

Enable AI analysis only when models, prompts, RAG, embeddings, memory, agents,
tools, MCP, evaluation gates, or model providers are evidenced. Trace direct
and indirect prompt injection, retrieval/memory/tool authorization, context and
provider disclosure, unsafe side effects, output trust, policy/evaluation
bypass, supply-chain changes, and wallet/quota abuse.

Otherwise record `applicable: false` and the evidence supporting that decision.

## Coverage gate

Account for the full application inventory. Distinguish `reviewed_no_issue`
from `pending`, `out_of_scope`, and `deferred_with_specific_reason`. Require a
specific reason and confidence impact for every deferral or out-of-scope
disposition.

Require an observed repository-manifest evidence record with a SHA-256 content
hash at the modeled revision. Its scope fields must exactly match metadata.
Freeze all modeled entities, boundaries, flows, invariants, controls, and
decisions as expected subjects before review, and require at least one coverage
row for each. Never remove a subject from both sets to conceal unread work.

Force `incomplete_high_risk_coverage` when any high-risk entrypoint family,
identity, asset, boundary, flow, integration, worker, admin surface,
deployment zone, control owner, or runtime-only claim remains pending or
deferred. A critical/high out-of-scope subject also forces incomplete status,
even when it names a declared exclusion; lower-risk exclusions limit assurance.

## Independent challenge gate

Run the challenger after the draft and before publication. Require it to look
for missing assets and boundaries, incomplete flow hops, overlooked controls,
unsupported impact, inflated risk, documentation/source drift, route-review
output, generic recommendations, broken references, duplicate threats,
coverage gaps, and tests without reliable oracles.

Record each challenge in `quality_review.challenge_findings` with a `QF-` ID,
severity, related model IDs, owner, status, and evidence-backed disposition.
Any unresolved high-severity finding makes the quality review fail. The
challenger must not silently rewrite the model.

Core gates must be `passed`. `not_applicable` is permitted only for a privacy
or AI lane proven absent, an empty threat/path ledger at the attack-path or
risk-ranking gate, or the validation-safety gate when no validation tests
exist. The material-threat gate still passes after the challenger confirms
that no candidate survived; it is never skipped.

## Publication gate

Reject publication when:

- the evidence, inventory, graph, invariant, control, coverage, or quality
  sections are empty or unreconciled; threat/decision/test/question ledgers may
  be empty only when no material candidate survived;
- IDs are duplicated, malformed, or reference missing records;
- claims lack evidence or assumption labels;
- material threats lack actors, assets, flows, boundaries, impact, decisions,
  responses, or tests;
- tests omit authorization, baseline, both signals, safety, evidence, or
  cleanup;
- high-risk coverage remains pending, deferred, or out of scope while the model
  claims `complete`;
- high-severity quality findings remain unresolved;
- output contains apparent secrets, private keys, tokens, or customer data;
- language implies exploit confirmation without authorized proof.

Run `scripts/validate_threat_model.py --strict`. Publish only after it passes
and the independent quality review status is `pass`.
