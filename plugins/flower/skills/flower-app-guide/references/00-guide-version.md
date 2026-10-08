# Flower App Guide Version

Guide version: `0.7.0`

Last updated: `2026-08-11`

Target Flower version: `0.1.3`

Related Flower Studio release: `0.1.1`

Status: application-development guidance for AI coding agents that write host
application code using Flower.

Current safety requirements:

- Treat a `FLOWER-CHECK-PARSE` diagnostic as incomplete analysis, not a clean
  result. Use strict parsing in CI when source must fail closed; parser
  diagnostics cannot be suppressed or accepted into a baseline.
- Never call a Worker's manual tick method from that same Worker's tick thread.
  Nested ticks can duplicate sibling Flow and checkpoint effects and are
  rejected by Flower `0.1.3`.
- Durable expiry requires a previously persisted deadline criterion; directly
  setting an expired status in a test does not prove deadline behavior.
- Refusing blocking Worker-tick work must include a complete non-blocking
  replacement and deterministic verification plan. Durable replacements
  persist the external-operation lifecycle and do not redispatch after restart
  merely because a volatile future was lost.
- Every suppression in a changed workflow, including pre-existing
  suppressions, must be audited; event/signal waits require actual
  duplicate-delivery coverage rather than repeated ticks alone, and each
  supported wait state requires its own recovery evidence.
- Every recovery scenario independently proves all supplied execution identity
  fields, including deadline/timeout and cancellation paths; assertions from
  one recovery test do not cover another.
- Treat EventStep transition effects as at-least-once-capable integration.
  Preserve durable intent and a stable operation id across the checkpoint and
  external-effect crash windows.

Scope:

- Modeling application workflows as Flow/Step code.
- Maven/Gradle host setup, published coordinates, and requirement-driven module
  selection.
- Event, timeout, and durable wait patterns.
- Spring/Kafka/domain integration boundaries.
- Optional Spring Boot runtime inspection through Engine dumps, the built-in
  console, and observability integration.
- Optional offline datasets, experiments, evaluators, and JSONL result or
  feedback storage through `flower-evaluation`.
- Optional read-only source inspection through `flower-flow-graph`, with static
  source facts kept separate from runtime state and editable drafts.
- Optional local read-only Trace, graph, evaluation, and monitoring inspection
  through the standalone Flower Studio application.
- Worker-lane selection and non-blocking tick rules.
- Step Guard usage for pre-step checks, holds, redirects, and fail-fast conditions.
- Deterministic testing expectations.
- `flower-check` adoption in host applications.

Version policy:

- Patch: clarify wording or fix examples without changing policy.
- Minor: add guidance for a module, installer, or workflow.
- Major: change an application-development rule in an incompatible way.
