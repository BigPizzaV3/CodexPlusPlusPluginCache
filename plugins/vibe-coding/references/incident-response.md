# Incident evidence and recovery

Start with symptom, affected environment, observation window and permitted actions. Separate event time, ingestion time, deployment time and clock/timezone differences. Preserve sanitized evidence and known gaps.

Trace an affected request/job through runtime, dependency and authoritative state. Compare a working cohort or previous version where available. Maintain competing hypotheses and the next discriminating observation; temporal coincidence with a release is not proof of causation.

Choose bounded, reversible containment that preserves evidence and data. Check rollback compatibility with current schemas, messages and state. A production restart, rollback, traffic switch, data repair or message to responders requires authorization for that action; investigation alone authorizes none of these mutations.

Distinguish symptom relief, restored service and verified cause. Close against the user-visible failure, relevant error/latency/backlog signal and a regression check. Quiet alerts can mean missing telemetry. Record unresolved hypotheses without inventing one root cause.
