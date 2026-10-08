---
name: tahr-threat-model-app
description: Build a full, implementation-backed threat model of an entire existing application, covering actors, assets, trust boundaries, entrypoints, hop-level data flows, abuse cases, connected attack paths, security invariants, control gaps, risk responses, and executable validation handoffs. Use for comprehensive system threat modeling, security architecture assessment, pentest preparation, or correlating a complete application repository with configuration, IaC, API schemas, diagrams, and deployment documentation. Do not use for a feature-only, diff-only, or design-only review.
---

# Tahr Threat Model App

Model the entire existing application as an attacker would. Use source and
configuration for observed implementation, documents for intended behavior,
and runtime evidence only when the exact target and test are authorized.
Produce a decision and validation plan, not a code-smell list and not a
verified-vulnerability report.

## Load the operating contract

Before modeling:

1. Read [full-review-workflow.md](references/full-review-workflow.md) for the
   end-to-end sequence and completion gates.
2. Read [threat-model-ledgers.md](references/threat-model-ledgers.md) for the
   canonical record relationships and exact enums.
3. Read
   [threat-evidence-and-quality-gates.md](references/threat-evidence-and-quality-gates.md)
   before accepting threats, risk ratings, or a complete status.
4. Read [specialist-handoffs.md](references/specialist-handoffs.md) before
   assigning validation work to another Tahr skill.
5. Use [worked-example.md](references/worked-example.md) only when the expected
   evidence-to-test trace is unclear.

Use [threat-model.template.json](assets/threat-model.template.json) as the
starting structure and [threat-model.schema.json](assets/threat-model.schema.json)
as the output contract. Do not invent a different report structure.

## Establish full-application scope

Record the repository path and revision, packages, services, clients,
deployment environments, supplied specifications and documents, excluded
third-party internals, runtime authorization, previous model, and unanswered
questions. Keep `mode` equal to `full`.

Cover every admitted first-party application component. If time, access, or
missing evidence prevents full coverage, preserve the complete inventory,
disposition each gap, and set `model_status` to
`incomplete_high_risk_coverage`. Never silently narrow a full review.

Keep these concepts separate:

- `model_status`: whether the declared full scope has been dispositioned;
- `assurance_status`: whether conclusions are source-observed or also
  runtime-validated;
- `risk`: plausible impact and likelihood of a modeled threat;
- `confidence`: strength and completeness of supporting evidence;
- `execution_status`: whether a validation test is only planned or has an
  authorized result.

A source-observed model may be `complete` while validation tests remain
`planned`, provided runtime validation was not part of the declared scope and
all implementation evidence was dispositioned. Express the limitation through
`assurance_status`; do not misuse coverage status to imply a test ran.

Default to read-only analysis. Do not test production, third parties, real
tenants, or real accounts without explicit authorization. Redact credentials,
tokens, keys, personal data, and customer data from every artifact.

## Inventory before judging

Build a coverage baseline from all first-party files and supplied evidence.
Inspect source, manifests and lockfiles, configuration, CI/CD, IaC, containers,
API and GraphQL schemas, database models, tests, diagrams, role matrices,
workflows, integration notes, and deployment documents. Map:

- human, service, worker, administrator, support, peer, tenant, and third-party
  actors;
- critical business, identity, authorization, financial, operational, privacy,
  audit, and secret assets;
- clients, APIs, services, workers, queues, data stores, caches, renderers,
  control planes, AI systems, and external integrations;
- public, internal, administrative, legacy, debug, webhook, job, CLI,
  upload/download, import/export, socket, serverless, and mobile entrypoints;
- authentication, session, authorization, owner/tenant policy, validation,
  serialization, secrets, logging, rate, quota, and recovery controls;
- deployment, network, process, tenant, role, provider, browser, device, and
  asynchronous trust boundaries.

Group routes and files into capabilities and business workflows. Retain exact
locations as evidence, but do not turn the report into a route-by-route review.
Account for each high-signal item in `coverage`.

Freeze a deterministic repository manifest before review. Bind its embedded
content hash to the immutable revision and reconcile its admitted paths, packages,
environments, documents, and exclusions with metadata. Populate
`coverage.inventory.expected_subject_ids` from that inventory before changing
any coverage item from `pending`; never shrink the expected set to make a
review pass.

Create the manifest in the selected threat-model output directory:

```bash
python3 <skill-directory>/scripts/build_repository_manifest.py \
  path/to/application --include . \
  --output path/to/output/repository-manifest.json
```

Add repeated `--include` and `--exclude` arguments when scope is more precise.
Pass `--revision` for an immutable VCS/release revision; when omitted, the
script derives `snapshot-sha256:<digest>` from the admitted bytes. Copy its
embedded revision and content hash (also printed by the script) into metadata,
`coverage.inventory.manifest`, and manifest evidence. Use explicit empty arrays
for documents or exclusions when there are none; do not omit those scope fields.

When the reachable surface is non-trivial and `$tahr-map-attack-surface` is
available, send it the frozen revision and scope before deriving threats, then
reconcile its inventory into this model rather than treating its output as a
second source of truth. If that companion skill is unavailable, perform the
same stable inventory locally using this section; do not block or narrow the
review.

## Build an evidence-backed graph

Record material facts as claim-level evidence. Use exactly `observed`,
`intended`, `inferred`, or `unknown`; never combine classes in one field.

For every sensitive or state-changing flow, model each hop from the initiating
actor to the final response, durable state, or side effect. At each hop record:

- source, destination, protocol, input, and affected assets;
- actor, user, service, owner, tenant, role, and policy context;
- trust boundary crossed;
- validation, serialization, authentication, authorization, and logging
  controls;
- queues, workers, callbacks, redirects, repositories, providers, tools,
  browsers, and other continuation points.

Do not stop at a controller when another component performs the security
decision. Include data creation, replication, retention, deletion, backup,
residency, and third-party handling where material.

## Derive material threats

For each critical asset and flow:

1. State the security invariant.
2. Define a realistic actor, goal, preconditions, boundary, abuse steps,
   affected assets, and business impact.
3. Locate observed and intended controls and their enforcement points.
4. Search for the strongest contradiction in middleware, policy, service,
   repository, serializer, validator, framework, IaC, or deployment controls.
5. Reject, narrow, or mark the threat `validation_required` according to the
   contradiction result.
6. Rank risk with an explicit rationale and keep confidence separate.
7. Assign a response, decision, owner, next action, residual risk, and
   validation test.

Use STRIDE as a completeness prompt, not as evidence or a requirement to emit
one threat per category. Use ASVS, OWASP API, GraphQL, privacy, mobile, or AI
taxonomies only to find omissions and map controls. Retain only threats that
connect to the implementation-backed graph.

Build attack paths only from connected model IDs. Mark uncertain steps
conditional; do not invent a hop merely to make a chain more severe.

Keep the canonical model proportional to the application. Reuse a control,
invariant, decision, or validation test across related threats when the
enforcement point, owner, and discriminating oracle are genuinely the same.
Keep claim statements short and reference stable IDs instead of copying the
same narrative. Do not create reciprocal records solely to make the artifact
look complete.

If no candidate survives the evidence, contradiction, and materiality gates,
leave `threats`, `attack_paths`, `decisions`, `validation_tests`, and
`questions` empty. Preserve the populated inventory, graph, implemented
invariants and controls, evidence, coverage, and independent challenge. Never
invent a low-value threat or test to avoid an empty ledger.

## Add applicable specialist analysis

When personal or regulated data is present, trace collection, linkability,
identifiability, detectability, disclosure, consent/awareness, retention,
deletion, residency, and third-party processing.

When LLMs, agents, RAG, embeddings, MCP, prompts, memory, providers, or tools
are present, trace prompt injection, retrieval and memory isolation, tool
authorization, confused-deputy paths, output trust, provider disclosure,
supply-chain changes, evaluation bypass, and wallet/quota abuse.

When a lane is not applicable, record `applicable: false` with evidence. Do not
invent threats merely to populate a taxonomy.

## Create executable validation handoffs

Create a validation test for every material uncertain, missing, or potentially
bypassable control. Include the target Tahr skill, authorization required,
safe environment, fixtures, preconditions, normal baseline, exact action,
expected control, `attacker_case.attacker_success_signal` and
`expected_denial_signal`, `control_case.control_success_signal` and
`control_failure_signal`, evidence, cleanup, destructive risk, confidence, and
current execution status.

Treat each test as `planned` until authorized evidence proves otherwise. Never
convert a proposed test into a finding. Route the test to the specialist named
in [specialist-handoffs.md](references/specialist-handoffs.md).

## Challenge before publishing

Run a separate adversarial quality pass after producing the draft and before
publishing it. Use an independent subagent when available; otherwise use a
fresh, explicitly separate review pass. Give the reviewer the draft model and
source evidence, not the desired conclusions.

Require the reviewer to challenge missing assets, actors, boundaries, flow
hops, contradictory controls, unsupported impact, inflated risk, route-review
drift, unhandled documentation, incomplete coverage, weak actions, broken
references, and non-executable tests. Record findings and their dispositions in
`quality_review.challenge_findings`.
Resolve every high-severity review finding or keep the review and model failed.
The reviewer must not silently rewrite the model it is judging.

## Validate and render

For a durable model, write only to a user-selected output directory or a
clearly named `tahr-threat-model-output/` directory. Never modify application
source during the review.

Validate before presenting the model as final:

```bash
python3 <skill-directory>/scripts/validate_threat_model.py \
  path/to/threat-model.json --strict
```

Fix validation failures, rerun the independent challenge when material model
content changes, and validate again. Then render concise views:

```bash
python3 <skill-directory>/scripts/render_threat_model.py \
  path/to/threat-model.json --output-dir path/to/output --strict
```

The renderer produces `threat-model.md`, `validation-plan.json`, and
`coverage.json` from the canonical model. Do not edit derived files as though
they were independent sources of truth.

## Deliver concise-first results

Lead with:

1. model and assurance status;
2. the five most important connected attack paths or threats;
3. blocking security decisions and their owners;
4. the first five validation tests;
5. high-risk coverage gaps.

Place complete ledgers after that summary or in the canonical JSON artifact.
Avoid repeating the same threat narrative in every section.

Never conclude that the application is secure. A clean full model means only
that no additional material modeled risks were identified within the stated,
completed evidence scope. Preserve assumptions, limitations, accepted risks,
pending tests, and a review date so future changes can update the model rather
than starting over.
