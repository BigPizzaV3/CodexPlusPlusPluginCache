# Reference integration and evaluation boundary

Stable Plugin `0.7.8` is published from a source distribution that
includes local, synthetic-only reference integration assets. The installed
Plugin contains this contract summary; it does not embed or start the
executable projects.

## Source-distribution assets

- `ycloud-sandbox-server/`: provider-shaped full-first-wave Facade with 17 API
  operations plus Authentication and the common Webhook Receiver (19 rows).
- `reference-integrations/express/`: Express 5.2.1 / Node reference application.
- `reference-integrations/spring-boot/`: Spring Boot 4.1.1 / Java 17 reference
  application.
- `quickstarts/{java,node,go,php}/`: explicit-loopback raw HTTP Quickstarts.
- `evaluation/v1/`: seven shared journeys, fixtures, support matrix and
  source-bound receipt contract.
- `evaluation/runner/`: deterministic task/repository/receipt gate.
- `evaluation/ttpri/`: synthetic-only timing schema and aggregation dry-run.

The Java and Node projects execute the same seven journey IDs (`auth`,
`message`, `media`, `template`, `webhook`, `failure`, `reconcile`) and link the
same 19 first-wave rows. Their receipts are allowlisted, source-bound caller
claims with a non-cryptographic trust boundary. They do not prove live provider
execution.

## SDK inventory boundary

The source distribution pins a dated inventory of the official Java, Node, Go
and PHP SDK repositories at `v1.16.2`. Each documented 87 operations; 86 IDs
exactly overlap the pinned 95-operation snapshot and 16 overlap the 17
first-wave operations. `whatsapp_template-analytics` is the sole first-wave gap
and must use the explicitly bounded raw HTTP seam instead of a guessed SDK
method.

This is a dated compatibility observation, not an evergreen SDK guarantee. A
future implementation must re-check the official SDK version before changing
the seam.

## Evaluation and Beta boundary

The 40-task Node/Java set covers positive, negative and boundary prompts for
authentication, messages, templates, media, Webhooks, failure diagnostics,
retry/reconciliation and secret safety. Its no-argument oracle response fixture
only proves evaluator wiring. Caller-supplied candidate results, repository
evidence and current-revision Node/Java receipts are reported separately.

TTPRI fixtures are labeled synthetic and keep Agent execution, human wait and
external approval separate. They do not satisfy a recent-real-case baseline or
a five-independent-developer Beta. CI success is not production readiness and
does not authorize a real provider call.

## Use rules

- Require explicit loopback `YCLOUD_BASE_URL`; never fall back to a live host.
- Keep fixed synthetic credentials and data inside local tests only.
- Preserve accepted versus final state and ambiguous mutation outcomes.
- Never copy a synthetic receipt or TTPRI result into a real Beta claim.
- If the executable source-distribution paths are unavailable, describe them as
  optional repository assets; do not claim they were run from the installed
  Plugin.
