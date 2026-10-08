# Engineering Escalation Framework

Escalations should reduce engineering rediscovery.

## Escalate when

- code/configuration change is likely required;
- the root cause needs privileged production access;
- impact is multi-customer, severe, security-related, or data-integrity-related;
- a reproducible defect or strong regression signal exists;
- support cannot progress with available evidence.

## Required escalation content

### Title
Symptom + affected component + scope.

### Customer impact
Who is affected, how, and since when. Do not extrapolate beyond evidence.

### Reproduction
Minimal steps, payload shape, account/resource conditions, and reproducibility.

### Technical evidence
Strongest evidence first, each with source and timestamp.

### Timeline
Last known good, first known bad, deploy/config/incident events, customer reports.

### Root-cause assessment
Classification, confidence, supporting/contradicting evidence.

### Work already performed
Queries, comparisons, attempted validation, ruled-out hypotheses.

### Requested engineering action
Be specific: inspect code path X, compare version A/B, validate DB constraint, review dependency timeout, etc.

### References
Ticket, trace, dashboard, issue, incident, or code links only when actually available.

## Anti-patterns

Avoid:
- "Customer says it doesn't work, please check."
- dumping raw logs without interpretation;
- claiming severity or multi-customer scope without evidence;
- hiding failed hypotheses;
- sending engineering a customer-facing narrative instead of technical evidence.
