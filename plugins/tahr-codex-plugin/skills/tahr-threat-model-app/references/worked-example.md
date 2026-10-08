# Worked Example: Multi-Tenant Export

The canonical worked example is
[`assets/threat-model.template.json`](../assets/threat-model.template.json).
It models a fictional application in which an authenticated tenant user starts
an asynchronous export. The API accepts the job, a worker loads tenant data,
and the result is stored for download.

The example is intentionally small enough to follow, but it demonstrates the
relationships required for a full application model. It is not evidence about
a real product and it is not a verified vulnerability report.

## Read the trace in this order

1. **Evidence** records point to fictional source, configuration, policy, and
   a SHA-256-bound repository manifest at one revision. Every material claim
   cites at least one evidence record, and the manifest scope exactly matches
   metadata.
2. **Entities and boundaries** name the tenant user, API, worker, data store,
   export asset, entrypoint, and trust zones. A boundary always connects two
   named zones.
3. **Flow** traces the export across multiple hops. Each hop preserves the
   principal and tenant context, names the security decision, and identifies
   the control expected at that enforcement point.
4. **Invariant** states that one tenant must never select or receive another
   tenant's export data.
5. **Control and threat** distinguish an observed authentication control from
   incomplete tenant binding. The threat names a realistic actor, concrete
   preconditions, contradiction searches, business impact, risk, confidence,
   response, owner, and residual risk.
6. **Attack path** connects existing flow hops and boundaries. It does not add
   an invented bridge merely to increase severity.
7. **Decision** compares concrete implementation options and names the owner
   who must choose or approve the target state.
8. **Validation test** converts the uncertain control into a safe specialist
   handoff with disposable tenants, baseline behavior, attack and denial
   signals, expected enforcement and failure signals, evidence, cleanup, and
   authorization limits.
9. **Coverage and quality review** freeze expected subjects before review,
   account for every modeled entity and relationship, and show that a `QF-`
   challenge finding was recorded, resolved, and left no unresolved publication
   blocker.

## Interpret the statuses correctly

The sample is `complete` and `source_observed`, while its test is `planned`.
Those values are compatible because runtime execution is not part of the
declared review scope. `complete` describes coverage of the declared source
scope; `source_observed` limits assurance; `planned` states honestly that the
test did not run.

The tenant-isolation threat can remain high risk in a complete model. Model
completeness is not risk acceptance, remediation, exploit confirmation, or a
claim that the application is secure. The response, decision, owner, residual
risk, and test keep the risk actionable.

## Adapt the example

Copy the template, then replace every fictional value with application-backed
evidence. Preserve the schema and stable identifier prefixes. In particular:

- bind metadata and the hashed inventory manifest to the exact repository and
  deployment revision;
- expand the inventory and coverage to every admitted first-party component;
- model every material synchronous and asynchronous hop;
- cite the strongest supporting and contradicting controls;
- keep risk, confidence, assurance, coverage, and execution status separate;
- add privacy and AI analysis only when evidence makes those lanes applicable;
- run an independent challenge before setting the quality review to `pass`.

Validate and render the adapted model:

```bash
python3 scripts/validate_threat_model.py path/to/threat-model.json --strict
python3 scripts/render_threat_model.py path/to/threat-model.json \
  --output-dir path/to/output --strict
```

If strict validation fails, fix the canonical JSON rather than editing the
derived Markdown or handoff files.
