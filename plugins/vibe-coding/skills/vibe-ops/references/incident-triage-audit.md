# Incident Triage Audit

## Operation

Investigate the selected incident and report supported findings without product or operational changes. Read [incident response boundaries](../../../references/incident-response.md). If the user explicitly requests mitigation as well, continue under that authorization using the remediation recipe after identifying a concrete target.

## Required input

The affected user operation and cohorts, incident window, available symptom/runtime evidence, known changes, investigation or intervention authority and recovery criteria. Mark unavailable telemetry and unresolved causality explicitly.

Select the target from the user’s request and current evidence. Reconstruct ordinary missing context from the owning code. If a missing target, authority or environment changes correctness or safety, name that specific gap and leave the dependent action blocked; continue independent work. Do not invent requirements from existing tests.

## Domain invariants

- Incident claims distinguish user impact, observed failure and inferred cause using attributable and time-aligned evidence.
- A mitigation’s effect and a root-cause correction are separate claims; neither is established by temporal correlation alone.
- The intervention targets the authoritative failure owner and preserves directly affected compatibility, retry and durable-state contracts.
- Recovery is demonstrated by fresh affected-user behavior and required convergence, with valid traffic and functioning telemetry.
- Unfinished data repair and unobserved recurrence windows remain explicit even when immediate symptoms or alerts subside.

## Goal and scope

Establish what user operation is failing, where the first demonstrated divergence occurs and which explanations fit the evidence. Keep the investigation bounded by the incident's services, tenants, time window and dependencies. Do not broaden a single degraded operation into a repository-wide cleanup.

## Inspect

- User-visible errors, affected cohorts, onset, baseline behavior and current status.
- Deployments, configuration/flag changes, migrations, provider events and workload changes around the same period.
- Request traces, logs, error ratios, latency distributions, queue age/depth, resource saturation, retries and dependency health.
- Runtime ownership, request/job boundaries, health checks, timeout/retry configuration and relevant runbooks.

## Triage method

1. Define the incident symptom in product terms and a measurable success condition. Record the source and freshness of each observation.
2. Build a small timeline separating event time, ingestion time and observation time. Account for clock skew, sampling and missing intervals before asserting order.
3. Trace an affected request or job to its first supported failure. Compare a healthy control cohort, earlier version or unaffected path when available.
4. Keep competing hypotheses with evidence for, evidence against and a cheap discriminating check. A deployment near the onset is a candidate cause, not proof.
5. Identify the likely owner and a bounded mitigation or repair direction. Separate a reversible way to reduce impact from an established root-cause fix.

## Issue classes and priority

Prioritize ongoing data loss, unauthorized effects and failure of critical user operations, then expanding backlog, saturation, cascading retries and partial availability. Investigate stale configuration, dependency failures, schema incompatibility, leaked resources, missed work and invalid health signals where the timeline supports them. A noisy log line or a quiet alert alone does not establish the incident's severity or recovery.

## Evidence quality

For a code defect cite `path:line`, the reachable state and its operational evidence. For an external/runtime hypothesis name the specific observation and missing check. Do not invent metrics, read unavailable production systems or expose credentials/personal payloads in diagnostic output. Avoid destructive probes and keep read-only queries bounded.

## Evidence requirements

Report impact, verified timeline, supported cause or ranked hypotheses, owner, immediate repair/mitigation direction and recovery criteria. Clearly distinguish known facts from unresolved causality. If there is no demonstrated code defect, say what evidence would resolve the next decision instead of fabricating a patch.

## Priority model

Use the repository’s severity scale if defined. Otherwise classify by demonstrated reachability and impact, not the presence of a keyword:

- **P0:** critical or immediate ongoing critical outage, data loss or unauthorized effects.
- **P1:** Material partial failure, backlog or recurrence.
- **P2:** A lower-impact but evidenced diagnostic or recovery-control defect.

A potentially severe category without a supported reachable path remains an unverified concern, not a P0 finding.

## Finding rules

Accept a finding only when the evidence establishes the reachable trigger, authoritative owner, violated invariant, affected consumer/state and concrete impact. Separate source facts, observed runtime behavior and inference. Reject generic best practices, stylistic preferences, hypothetical scale failures and already-solved issues. Give one owner-layer remediation direction. Merge symptoms sharing the same owner and correction; split findings when owner, rollout, rollback or validation boundaries differ.

## Completion criteria

Finish when the selected path and applicable invariants have been examined, findings pass the evidence gate and material unknowns are named. No supported defect is a valid outcome. Do not expand scope or fabricate work to fill priority levels.

## Output contract

Respond in the user’s language. Return findings ordered by impact. Each finding contains: priority and concrete title; affected surface/actor/state; exact evidence anchors and nearest symbol; authoritative owner; violated invariant; expected versus observed behavior; reachable impact; one remediation direction; acceptance criteria; verification route; relevant rollout/rollback constraints and explicit exclusions. Use concise connected fields or prose, not empty template sections. If no finding qualifies, state that and bound the conclusion to the inspected scope. Report unresolved evidence separately. Do not create external tasks or edit code for an audit-only request.
