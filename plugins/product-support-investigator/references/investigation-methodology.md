# Investigation Methodology

## Goal

Turn a customer-reported symptom into an evidence-backed technical assessment without overclaiming.

## Evidence ladder

Prefer, when applicable:
1. Exact request/transaction evidence
2. Distributed trace
3. Application log tied to the same request
4. Error event/stack trace
5. Dependency/database call tied to the same trace
6. Metrics showing pattern/impact
7. Deployment/configuration/feature-flag history
8. Code change / known bug
9. Historical incidents or support cases
10. Documentation
11. Human assumption

This is guidance, not an absolute ranking.

## Search strategy

Search narrowly first:
1. exact request/correlation ID
2. exact transaction/resource ID
3. exact timestamp ± 2–5 minutes
4. exact error or exception
5. endpoint + account
6. version + endpoint
7. broader time range / similar cases

After each search, record:
- what changed in the investigation;
- what hypothesis gained or lost support;
- what the next discriminating check is.

Avoid repeated searches that do not change the evidence state.

## Hypothesis discipline

For every leading hypothesis list:
- supporting evidence;
- contradictory evidence;
- missing validation;
- falsification test.

Example:

Hypothesis: deployment regression  
Support: failures begin 90 seconds after release; matching stack trace references changed code.  
Against: one similar failure occurred before release.  
Missing: comparison across versions.  
Falsification: if old-version instances fail at the same rate, deployment causation weakens.

## Confidence rubric

High: strong independent evidence with limited contradiction.
Medium: meaningful support with an important validation gap.
Low: weak, sparse, or conflicting evidence.
Explain the confidence label; do not invent numerical precision.

## Correlation checklist

Correlate using:
- request/correlation ID;
- exact or near-identical timestamps;
- same account/resource;
- same endpoint/action;
- same exception/error fingerprint;
- same application version;
- same deployment/config event;
- same dependency or region;
- repeated pattern across customers.

Do not call a temporal relationship causal without additional support.

## Sparse-evidence mode

If only a symptom is known:
- preserve the symptom verbatim;
- identify the smallest useful next evidence request;
- avoid demanding a full diagnostic dump;
- prefer request ID + timestamp + endpoint/action + environment;
- explain what each missing field would help distinguish.

## Conflict handling

If sources disagree:
1. expose the disagreement;
2. identify likely reasons such as ingestion delay, timezone mismatch, sampling, clock skew, retries, or stale metadata;
3. prefer the source closest to the actual transaction;
4. lower confidence until reconciled.

## Stop conditions

Stop investigating when:
- root cause is adequately confirmed;
- the next action requires a different owner/access level;
- remaining searches are repetitive and non-discriminating;
- the user requested a bounded analysis;
- evidence is insufficient and the exact next evidence is known.

Return the current evidence state rather than filling gaps with guesses.
