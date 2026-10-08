# Tahr Evidence Contract

Use this contract for every Tahr review. Separate severity (impact) from confidence (evidence strength).

## Statuses

- `verified`: Authorized runtime or preserved runtime evidence satisfies the exact exploit claim end to end.
- `potential`: A vulnerability-specific positive signal exists, but named proof is blocked or incomplete. State the missing proof and limitation.
- `static-confirmed`: Current first-party source or configuration conclusively contains a weakness, but runtime exploitability is not claimed.
- `needs-runtime`: Source supports a concrete validation target but not a finding.
- `rejected`: Current evidence contradicts the candidate. Keep it in the candidate audit trail, not findings.
- `unresolved`: Available evidence cannot decide the claim. Never present it as clean coverage.

Do not use `potential` for tool failures alone. Do not use `rejected` because testing was blocked.

## Finding-local evidence

Record all applicable fields:

- exact claim under test and vulnerability class;
- file/line/symbol and route/method/parameter or component;
- actor, target object, owner/tenant, workflow state, and preconditions;
- attacker-controlled source, transformations, sink, and expected control;
- controls and framework behavior checked;
- contradiction verdict and exact evidence;
- required proof for the class;
- positive evidence, negative control, and expected-denial evidence;
- limitations and alternate explanations;
- concrete attacker outcome and affected asset;
- remediation target and regression-test shape.

Evidence belongs to the finding it supports. A tool success flag, another finding, or an attack-chain hypothesis cannot strengthen a weak claim.

## Evidence hierarchy

Prefer, in order:

1. durable unauthorized state change with authoritative readback;
2. protected data/action observed under the wrong identity or boundary;
3. browser execution, server callback, device output, or command/query result tied to the exact input;
4. repeatable differential behavior with a valid baseline and negative control;
5. direct, reachable source-to-sink or missing-control evidence;
6. scanner, matcher, inventory, version, or documentation lead.

Levels 5-6 do not prove runtime exploitability. Documentation states intent, not implementation.

## Common hard proof gates

- Authorization: prove caller, target, owner/tenant, expected denial, and unauthorized impact. For mutations, capture before state, action, readback, and cleanup.
- Authentication: prove an identity or session boundary failure, not token presence or a 2xx response. Revalidate the exact session first.
- XSS: require browser JavaScript execution or a payload-caused browser side effect. Reflection or stored markup is a candidate.
- SQL/NoSQL injection: require safe database-derived output or equivalent query-impact proof. Error, timing, or WAF behavior is a candidate.
- SSRF/webhook: require the exact fetch sink plus controlled callback, internal-service response, metadata, redirect-chain, or file/protocol proof. Fetching a public URL only proves fetch capability.
- Upload: acceptance is not impact. Require unsafe processing, protected read, browser execution, or server execution tied to the uploaded object.
- Command/template/deserialization: require executed behavior, deterministic output, callback, safe state change, or an equally specific runtime effect.
- Business logic/race: require a valid baseline plus an invariant violation confirmed by authoritative readback.
- Secret: require a real application-owned credential or key, exposure/reachability context, and affected privilege. Never reproduce the raw value.
- Dependency: require exact version evidence, first-party usage, reachable vulnerable behavior, attacker precondition, and compensating-control review.
- AI: prove a real policy, data, tenant, output, tool, or resource boundary. Harmless phrase changes and a single stochastic success are insufficient.
- Android: separate static configuration, external/runtime reachability, and demonstrated mobile or backend impact.

## Negative controls and contradiction

Use a benign request or legitimate identity to prove the feature works. Use an invalid, foreign, unauthenticated, or safely altered case to establish expected denial. Compare semantic content and durable state, not status code alone.

Attempt to disprove every claim. Cite the exact control and why it does or does not apply on this path. “Authentication exists” or “the framework escapes by default” is not an adequate contradiction without route/symbol evidence.

## Sensitive evidence

Use raw secrets only transiently when explicit authorized validation requires it. Persist only the secret class, location, affected scope, length, expiry/claims when safe, redacted preview, and SHA-256 fingerprint. Keep requests syntactically useful after redaction.
