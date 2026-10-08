# Flower Backends

The action-runtime modules share one governed pipeline. Select a backend for
orchestration behavior, not for different policy semantics.

## DefaultActionRuntime

Use `DefaultActionRuntime` as the reference backend and for applications that
do not need Flower orchestration. It supports the same registry, validation,
policy, approval, guard, dispatch, persistence, audit, and completion rules.
Start integration work here unless a Flower-specific wait or recovery need is
already clear.

## WorkflowActionRuntime

Use the workflow backend when the application benefits from expressing the
controlled stages through Flower Flow and Step structure. A required approval
may return a pending result to the host instead of holding an application
thread. Resumption must re-enter the shared pipeline and repeat the required
checks.

Do not fork governance behavior into workflow-only policy code. Runtime parity
tests should prove that direct and workflow backends produce equivalent
decisions and terminal results for the same proposal.

## EventLoopActionRuntime

Use the current event-loop backend when approval waits and approval deadlines
should be represented as non-blocking EventFlows and reconstructed from a
queryable `RunStore`. `InMemoryRunStore` may be sufficient for same-JVM
local/test use; restart-sensitive, multi-instance, or production recovery
requires a shared durable store. The backend does not turn general
async/deferred execution or every external callback into an EventFlow. Those
completion paths still use the core Run lifecycle and host
callback/reconciliation adapters.

Event-loop callbacks and steps must remain short. Submit actual action work to
a host-managed executor so the event-loop thread never performs blocking domain
work.

The event-loop state is orchestration state. `ActionRun` remains the action
lifecycle truth, including the terminal winner in completion/cancellation
races.

## When To Load flower-app-guide

Also load `flower-app-guide` whenever the host authors or changes Flower
Flows, Steps, Step Guards, Workers, worker lanes, event/signal/timeout waits,
checkpoint/resume behavior, Spring wiring, or `flower-testkit` tests. Follow
its non-blocking tick rules while keeping the action control boundary defined
by this skill.
