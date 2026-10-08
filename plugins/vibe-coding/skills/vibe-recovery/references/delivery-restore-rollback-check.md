# Delivery Restore & Rollback Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Build the same revision from clean inputs and compare the expected reproducibility/provenance properties and artifact digest lineage.
- Deploy/promote by digest through a safe environment, trigger health failure, pause/abort, and verify rollback or forward-fix decision.
- Toggle/target/fail the changed flag/config and verify defaults, cohort isolation, telemetry, rollback, and expiry ownership.
- Restore backups into isolated infrastructure, rebuild dependencies/config, validate data/application invariants, and measure RPO/RTO.
- Exercise loss of one failure domain/control-plane dependency and verify documented DR authority, communication, and return-to-primary procedure.
