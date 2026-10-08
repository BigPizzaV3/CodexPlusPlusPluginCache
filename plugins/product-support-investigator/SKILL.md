---
name: product-support-investigator
description: Investigate technical customer and product issues with an evidence-first, vendor-neutral support workflow.
---

# Product Support Investigator — Community Edition

Product Support Investigator Community is an evidence-first investigation skill for technical customer and product issues. It helps support engineers validate reported problems, organize available evidence, compare working and failing behavior, form evidence-backed hypotheses, assess impact, and produce clear escalation and customer communication.

The Community Edition is intentionally vendor-neutral. Datadog, Zendesk, Jira, GitHub, Grafana, logs, and other integrations are optional evidence sources rather than requirements.

## Investigation Principles

- First validate the reported issue before diagnosing its cause.
- Identify the user's goal and the stage where progress fails.
- Separate **Observed**, **Inferred**, and **Unknown**.
- Never invent logs, metrics, tickets, incidents, identifiers, deployments, or root causes.
- Prefer direct evidence over assumptions.
- Treat correlation, similarity, and recency as clues rather than proof of causation.
- Treat successful related operations and negative evidence as useful narrowing signals.
- Break complex problems into understandable stages or layers.
- Use available read-only tools when useful; do not require a particular vendor.
- Missing logs or integrations must not make the investigation unusable.
- Keep internal technical evidence separate from customer-safe communication.
- Investigation is read-only by default. Production changes, deployment, rollback, issue mutation, or customer contact require explicit human authorization.

## Goal, Failure Stage, and Issue Validation

Before diagnosing a cause, establish:

1. **Goal** — what the user is trying to accomplish.
2. **Failure stage** — where the expected workflow stops or diverges.
3. **Issue validation** — whether current evidence supports the reported failure.

A useful high-level path may look like:

```text
Goal -> prerequisite -> authentication -> configuration -> request -> processing -> result
```

Adapt the path to the system. For example, an API investigation may consider DNS, TLS, authentication, authorization, request validation, application behavior, dependencies, and the response. A CLI investigation may consider installation, runtime, authentication, project configuration, remote request, processing, and result retrieval.

Do not assume the user's explanation of the issue is already the root cause. If the failure cannot currently be confirmed, label it appropriately as unverified, intermittent, historical, resolved, or Unknown based on evidence.

## Layered Validation

Break the workflow into useful stages. Use evidence already available to identify which stages appear healthy, failing, or still unknown.

For a relevant stage, record when useful:

- expected behavior;
- observed behavior;
- evidence available;
- a safe check or command if one is needed;
- the result and what remains unknown.

Do not dump a long generic command list. Prefer a small number of relevant checks tied to the actual symptom and stage being investigated.

If a read-only tool can perform a check directly, use it rather than asking the user to reproduce information unnecessarily.

## Evidence Sufficiency and Clarification

Begin with the evidence already available. Do not require complete information before useful investigation can start.

Before asking the user for more information:

1. inspect the supplied evidence;
2. use available read-only sources when appropriate;
3. determine whether the missing detail materially affects the investigation;
4. ask only for the smallest useful clarification.

High-value details can include environment, exact error, expected versus actual behavior, timestamp and timezone, request/correlation/transaction ID, affected account/resource, reproduction, frequency, last known success, and recent changes.

## Evidence Model

Rank evidence approximately as follows:

1. Direct logs and stack traces
2. Metrics and distributed traces
3. Configuration and feature-flag state
4. Deployment, release, and infrastructure history
5. Previous incidents and linked records
6. Ticket comments, customer reports, and user descriptions
7. AI assumptions — always label these as inference

For important evidence, use IDs such as `E1`, `E2` and record:

`Evidence ID · Source · Observed fact · Timestamp · Significance · Reliability`

For correlations, use IDs such as `C1`, `C2` and record:

`Correlation ID · Evidence linked · Relationship · Strength`

Absence of a signal is useful only when that signal was expected and the source is sufficiently complete and reliable.

## Optional Evidence Sources

Use whatever is available: user-provided logs, screenshots, API responses, Jira, Zendesk, Intercom, GitHub, Confluence, Datadog, Grafana, Prometheus, Sentry, New Relic, Elastic, OpenTelemetry, Kubernetes, cloud platforms, Slack, incident systems, runbooks, release notes, telemetry, audit history, or code.

If a source is unavailable, state the limitation and continue.

## Successful-Path Comparison

Compare failing behavior with a related successful operation whenever possible.

Examples:

- one API endpoint fails while another succeeds;
- one customer fails while others succeed;
- one environment fails while another succeeds;
- authentication succeeds but a later operation fails;
- an older version works while a newer version fails;
- one CLI command succeeds while another command fails.

Ask which components are shared and which meaningful differences exist between the successful and failing paths. Do not blame a shared dependency without evidence explaining why the successful path was unaffected.

## Differential Investigation

When two similar workflows have different outcomes, compare their differences before applying broad troubleshooting.

```text
Successful path -> A -> B -> C -> success
Failing path    -> A -> B -> C -> D -> failure
```

The extra or changed stage may be a useful place to investigate, while still remaining open to other evidence-supported explanations.

## Onset, Changes, Compatibility, and Known Issues

When relevant, determine whether the workflow worked before and what changed near the onset of the issue.

Useful sources include deployment history, configuration changes, dependency/runtime changes, feature flags, package versions, release notes, audit history, previous tickets, and telemetry.

For persistent or version-related errors, check authoritative product documentation, compatibility guidance, release notes, known issues, and official repositories when available.

Official documentation describes expected or supported behavior; it does not by itself prove the root cause in the user's environment. Correlate it with current evidence.

Distinguish a supported workaround from a root-cause fix.

## Hypotheses

When the cause is not directly established, generate a small set of plausible hypotheses.

For each hypothesis include:

- explanation;
- supporting evidence;
- contradicting or missing evidence;
- confidence: High, Medium, or Low;
- a useful next validation step when needed.

Consider alternatives before concluding. A matching historical incident, GitHub issue, recent deployment, or similar error can generate a hypothesis but does not prove the current cause.

Do not use false numerical precision when the evidence does not justify it.

## Root Cause Assessment

Use these labels:

- **Confirmed** — direct evidence establishes cause and effect.
- **Highly Likely** — strong converging evidence with a limited validation gap.
- **Probable** — meaningful support remains, but important validation is missing.
- **Possible** — plausible but weakly supported.
- **Unknown** — available evidence cannot distinguish the cause.

Distinguish customer symptom, immediate technical failure, underlying cause, and contributing factors. Do not automatically label the first exception or error message as the root cause.

## Failure Scope and Severity

Distinguish customer/product failure, platform/service failure, integration failure, deployment/release failure, developer-tooling failure, local-environment failure, and observability/reporting failure.

Assess severity from demonstrated impact rather than the technical error alone. Consider production status, affected users/customers, business impact, data/security risk, duration/frequency, and workaround availability.

If impact is not established, mark severity as Unknown or Provisional.

## Investigation Workflow

1. Identify the user's goal.
2. Validate the reported symptom when possible.
3. Locate the failure stage.
4. Extract high-signal identifiers and context.
5. Decide whether minimal clarification is required.
6. Inspect the relevant stages/layers using existing evidence.
7. Search available evidence narrow-to-broad using identifiers, time, error, endpoint, account/resource, version, and environment.
8. Build a timeline when timing matters.
9. Compare successful and failing paths.
10. Correlate independent evidence.
11. Review onset, recent changes, compatibility, and known issues when relevant.
12. Generate and compare plausible hypotheses.
13. Assess the deepest evidence-supported cause and confidence.
14. Assess impact, scope, risk, workaround, and likely owner only when supported.
15. Recommend safe support actions and prepare escalation/customer communication when useful.

## Customer Communication

Customer-facing updates should be accurate, concise, and safe. Include what is known, what remains under investigation, impact/workaround when supported, and the next meaningful action or update criterion.

Do not expose secrets, private links, signed URLs, unnecessary personal information, internal stack traces, or sensitive architecture details.

## Engineering Escalation

Escalate when deeper code/configuration changes, restricted access, production intervention, data-integrity/security review, or specialist ownership is required.

A useful escalation includes:

- concise problem and impact;
- environment and affected scope;
- evidence collected;
- timeline/recent changes when relevant;
- hypotheses or current assessment;
- work already completed;
- workaround if known;
- likely owner;
- exact engineering ask.

## Temporary and Signed URLs

Treat pre-signed URLs, SAS tokens, signed query strings, temporary access URLs, tokens, cookies, and credentials as sensitive.

Redact them when possible and never ask the user to paste secrets into the investigation.

## Output Contract

Adapt output depth to the problem. Do not include empty sections only to satisfy a template.

For Standard investigations, use relevant sections from:

1. Executive Summary
2. Goal and Failure Stage
3. Issue Validation Status
4. Incident Classification
5. Business Impact
6. Technical Signals
7. Timeline / Last Known Success / Onset
8. Observed Facts
9. AI Inferences
10. Unknowns
11. Evidence
12. Correlations
13. Layer / Sequence Validation
14. Successful Control Paths / Differential Signals
15. Blast Radius
16. Similar Incidents / Known Issues
17. Recent Changes / Version Compatibility
18. Hypotheses
19. Root Cause Assessment
20. Risk Assessment
21. Investigation Checklist / Next Useful Check
22. Missing Evidence
23. Suggested Command or Search
24. Workaround
25. Customer Communication
26. Ownership Recommendation
27. Engineering Escalation
28. Confidence

Suggested commands must be read-only, scoped, safe, and must never request credentials or secrets.

## Tool-Independent Fallback

- Rich evidence → correlate available sources and validate deeply.
- Partial evidence → establish what is known and identify gaps.
- Minimal evidence → validate the symptom, map goal/failure stage, form basic hypotheses, and recommend relevant checks.
- No telemetry access → use symptoms, reproduction, supplied command results, code, configuration, documentation, versions, and user context without inventing evidence.

If evidence cannot distinguish causes, say: **Insufficient evidence to determine the root cause.**

## Playbook Routing

Load only relevant playbooks when the platform supports them:

- API/HTTP errors → `references/api-error-investigation.md`
- Authentication/authorization → `references/authentication-investigation.md`
- Webhooks/callbacks → `references/webhook-investigation.md`
- General investigation → `references/investigation-methodology.md`
- Engineering handoff → `references/escalation-framework.md`

## Community Boundary

Community provides a complete, vendor-neutral workflow for an individual support engineer. See `COMMUNITY.md` for its scope.

## Final Quality Gate

Before concluding, verify that the reported issue is validated or clearly marked unverified; Observed/Inferred/Unknown are separated; evidence was not invented; the goal and failure stage are clear; successful control paths and relevant recent changes were considered; hypotheses remain evidence-backed; severity matches demonstrated impact; customer-facing communication is safe; suggested actions are scoped and read-only by default; and unavailable integrations are treated as limitations rather than blockers.

If the evidence is insufficient, say: **Insufficient evidence to determine the root cause.**
