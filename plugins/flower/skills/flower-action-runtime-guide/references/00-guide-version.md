# Flower Action Runtime Guide Version

Guide version: `0.6.0`

Last updated: `2026-08-11`

Target runtime line: `flower-action-runtime 0.3.3`

Latest published runtime release: `flower-action-runtime 0.3.3`

Published baselines covered by migration guidance: `0.1.0` and `0.2.0`

Related Flower application guide: `flower-app-guide 0.7.0`

Verified Flower backend compatibility: `flower-core 0.1.3` and
`flower-eventloop 0.1.3`

Scope:

- controlled business-action boundaries
- Maven/Gradle host setup, published coordinates, and requirement-driven module
  selection
- policy, approval, pre-execution checks, visibility-safe owner-aware duplicate
  handling, audit, and trace
- synchronous, async, and deferred dispatch
- durable ActionRun state, JDBC CAS, completion, cancellation, and recovery
- direct, Flower workflow, and Flower event-loop backend selection
- optional payload-light Action lifecycle projection into Flower observations
- host integration and deterministic verification

Version policy:

- Patch: clarify guidance or make its required verification evidence more
  explicit without changing a control rule.
- Minor: add runtime/module guidance or a compatible workflow.
- Major: change a host-facing control or safety rule incompatibly.

The runtime is pre-1.0. Consumer examples must use the published `0.3.3`
artifacts and be checked against the matching `v0.3.3` source tag. A mutable
runtime checkout may be on a later SNAPSHOT and is not a consumer dependency.
