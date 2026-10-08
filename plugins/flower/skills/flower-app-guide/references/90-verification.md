# Application Verification Commands

Run the narrowest host-application check that covers the changed behavior.

## Maven Host App

```powershell
mvn test
mvn verify
```

If the application is multi-module, run the module containing the workflow and
its dependencies first, then broaden if needed:

```powershell
mvn -pl <app-module> -am test
mvn -pl <app-module> -am verify
```

## Gradle Host App

```powershell
.\gradlew test
.\gradlew check
```

For one module:

```powershell
.\gradlew :<module>:test
.\gradlew :<module>:check
```

## What To Verify

- Flow starts from the intended domain event or command.
- Step ids and transitions match the business phases.
- `goTo(...)` paths tolerate the current Step's `onExit` lifecycle before the
  target Step starts.
- Guards, when used, are quick pre-step checks and do not hide long work or
  business side effects.
- Waiting Steps use events, domain state, or deadlines without blocking.
- Durable expiry waits persist the deadline criterion before waiting and test
  just-before/at-deadline behavior; directly setting an expired status is not
  accepted as deadline evidence.
- Worker lanes are chosen by execution character, not by feature name.
- Manual Worker ticks are driven from outside the Worker tick callback; Steps,
  Guards, listeners, and callbacks do not re-enter the same Worker.
- Periodic or monitoring behavior is modeled as Flows with internal waits by
  default. Any external scheduler that owns workflow progression has explicit
  developer/owner approval and a documented reason.
- Blocking work is behind async APIs, bounded executors, or external runtimes.
- Durable or restartable external work persists operation intent, lifecycle,
  and result/failure outside Step fields. Recovery observes the same operation
  and does not re-dispatch merely because an in-memory future was lost; a
  dispatch-once test keeps the provider/business dispatch count at one.
- Event callbacks do not directly complete flows or mutate domain state unless
  that is the application's explicit event-handler responsibility outside
  Flower.
- Durable Flows can recover from a checkpoint when persistence is enabled.
- Durable EventSteps recreate checkpointable waits in `onRecover(...)` and
  finite waits include an explicit deadline path.
- EventStep effects use durable intent, stable operation ids, idempotent
  dispatch, and reconciliation where the checkpoint/effect crash windows
  matter; exactly-once execution is not claimed.
- Embedded SQLite deployments apply the required Flower schemas and configure
  a local database path, WAL mode, and busy timeout in the host application.
- Durable or restartable workflows can recover from domain state when Flower
  persistence is not yet used.
- Every recovery scenario independently proves every supplied
  `ExecutionContext` value: tenant, user, session, run, trace, and correlation
  identity. Check each recovered wait and success, deadline/timeout,
  cancellation, and duplicate-delivery path; identity evidence from one test
  does not cover another.
- Workflows with application checks pass the host application's chosen
  validation, authorization, confirmation, idempotency, and result-observation
  checks.
- A host that combines Flower `0.1.3` with Agent `0.2.0` or AI Harness `0.1.3`
  resolves one Flower version, records the dependency tree, and tests the
  selected integration path. Host verification is not described as upstream
  release verification.
- Event- or signal-driven waits are tested with duplicate delivery, not only
  repeated ticks, and side effects remain single and terminal state correct.
- `flower-check` reports no `FLOWER-CHECK-PARSE` diagnostic; strict parsing is
  enabled in CI when incomplete AST analysis must fail closed. Parser
  diagnostics are not suppressed or baselined.
- `flower-check` passes, and a source search confirms every suppression or
  ignore directive in the changed workflow satisfies the appropriate terminal
  control, concrete native-alternative rationale, duplicate-delivery, and
  recovery requirements in `references/60-flower-check-adoption.md`. A clean
  checker report alone is not sufficient. Each suppression maps to its own
  tests; recovery or duplicate-delivery evidence for another wait is not a
  substitute, and pre-existing coverage remains present.
- A refusal's user-facing response explicitly says that the synchronous wait
  occupies the lane, stalls unrelated Flows, and creates backpressure. It also
  includes dispatch-once, later observation, explicit deadline/cancellation,
  persisted operation state for restartable work, and deterministic-test
  alternatives rather than only declining the requested code.
