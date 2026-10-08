---
name: flower-app-guide
description: Use when creating, building, modifying, reviewing, or testing application code that uses Flower, including new Maven or Gradle project setup, Maven Central dependency and module selection, Flow and Step design, Step Guards, non-blocking Worker ticks, worker-lane selection, event/signal/timeout waits, Spring Boot Engine or Worker wiring, runtime console/dump observability, standalone Flower Studio trace/graph/evaluation inspection, Kafka/Bloom/domain event integration, durable checkpoint/resume, flower-testkit tests, and flower-check adoption in a host app.
---

# Flower App Guide

## Overview

Use this skill when implementing application workflows with Flower. The goal is
to help an AI coding agent produce explicit, testable Flow/Step application code
instead of scattered callbacks, hidden polling loops, sleeps, or ad-hoc status
switches.

This skill is for applications that use Flower. It is not primarily for
modifying the Flower framework source itself.

Use `flower-agent-guide` for AgentRun, Tool-loop, transcript, or Agent model
gateway semantics. Use `flower-ai-harness-guide` for one AI task's validation,
refine, fallback, provider, or recovery semantics. Load this app guide as well
when either task changes host Flower wiring or Flow/Step code.

## Start Here

Always read:

- `references/00-guide-version.md`
- `references/01-app-quick-rules.md`
- `references/90-verification.md`

Then read the area-specific reference that matches the application work.

## Reference Routing

- Creating a Maven or Gradle host, choosing Flower modules, adding or upgrading
  dependencies, configuring the Spring Boot starter, selecting offline
  evaluation support, or installing
  `flower-check`: read `references/05-build-and-module-selection.md`.
- Designing a Flow, Step classes, Step ids, StepResult transitions, or app workflow module: read `references/10-flow-step-authoring.md`.
- Waiting for Kafka/domain events, callbacks, signals, timeouts, or Bloom events: read `references/20-events-and-waits.md`.
- Durable application flows, checkpoints, resume, idempotency, or `ExecutionContext`: read `references/30-durable-app-flows.md`.
- Tests for Flow behavior, manual ticks, fake clocks, event publishing, or recovery tests: read `references/40-testing-with-testkit.md`.
- Event-driven app workloads such as LLM/tool/external/human waits that fit `flower-eventloop`: read `references/50-eventloop-for-apps.md`.
- Adding `flower-check` to an application build or fixing checker findings: read `references/60-flower-check-adoption.md`.
- Visualizing the static Flow structure of a source project, producing a
  machine-readable Flow inventory, or checking structural changes with
  `flower-flow-graph`: read `references/65-flow-graph-tooling.md`.
- Using Step Guards for pre-step checks, holds, redirects, or fail-fast conditions: read `references/70-step-guards.md`.
- Inspecting Engine, Worker, Flow, or Step execution in a Spring Boot host,
  exposing a protected dump endpoint or built-in console, or selecting
  observability integration: read
  `references/80-spring-boot-observability.md`.
- Connecting a Flower application to the standalone Flower Studio, exporting
  correlated observation or evaluation JSONL, or inspecting local Traces,
  execution graphs, evaluations, and monitoring: read
  `references/85-flower-studio-integration.md`.

## Workflow

1. Inspect the host build, Java and Spring baseline, execution model, database,
   and test setup. For a new project or dependency change, select the smallest
   requirement-backed module set from
   `references/05-build-and-module-selection.md`.
2. Identify the application workflow being modeled and the domain state that is
   the source of truth.
3. Choose whether the ordinary tick-driven Flower model or the event-loop model
   fits the workload.
4. Model business phases as explicit Steps with stable string step ids.
5. Choose Flower worker lanes by execution character, not by feature name.
6. Keep each Step small: start work, observe domain state/events/time, and
   return an explicit `StepResult`.
7. Keep blocking IO, LLM calls, tool calls, and long work outside the Flower
   worker tick. Steps should submit work and observe results, not wait inside
   the lane thread. If a request asks for blocking work in a tick, the
   user-facing response must explicitly state that the synchronous wait
   occupies the lane, stalls unrelated Flows, and creates backpressure; do not
   leave that consequence implicit or only in referenced guidance. Refuse that
   mechanism and still provide the complete safe replacement: dispatch once,
   observe persisted state or an event on later ticks, include an explicit
   deadline/cancellation path, and preserve deterministic tests. For a durable
   or restartable Flow, never keep completion truth only in a `Future`,
   `CompletionStage`, or Step field, and never re-dispatch merely because that
   volatile handle disappeared. Persist the operation id, lifecycle state,
   result/failure, and deadline as applicable; completion code persists the
   result before it signals the Flow, and recovery observes the same operation.
8. Give every long-lived external or domain wait an explicit cancellation,
   deadline/timeout, max-bound, or other terminal path appropriate to its
   semantics. When a durable wait is time-bounded, persist its deadline before
   entering the wait. A truly indefinite monitor needs a narrowly reasoned
   suppression that explains its ownership and liveness model; never justify a
   suppression merely by calling a wait "intentional" or "unbounded."
9. Audit every Flower Check suppression in the workflow being changed,
   including pre-existing suppressions. A clean checker report does not prove
   suppressed code is safe. Remove or redesign a suppression unless the source
   explains why the checker-recognized Flower-native alternative is
   incompatible or unsuitable for the selected persistence, semantics, or
   operational model and deterministic tests cover the selected terminal
   control, duplicate delivery, and restart where supported. Map that evidence
   to each suppression independently: coverage for a later or similar wait
   never satisfies an earlier suppressed wait, and extending a workflow must
   not delete existing suppression-specific recovery coverage.
10. Add deterministic tests with manual ticks or `flower-testkit`. Recovery
    tests must assert every execution identity value the application supplied:
    `tenantId`, `userId`, `sessionId`, `runId`, `traceId`, and
    `correlationId`, not only a subset. Apply this independently to every
    recovery scenario and supported wait state, including success,
    deadline/timeout, cancellation, and duplicate-delivery paths; assertions
    in one recovery test never cover another. Assert identity at the first
    observable post-recovery point; with `FlowTestHarness`, this is immediately
    after the first deterministic tick following `recover(...)` or
    `recoverAll(...)`. Assert it again at terminal state when a snapshot
    remains available. For event- or signal-driven waits, deliver the same
    notification more than once and prove business side effects and terminal
    state remain correct. Drive manual ticks only from the test or host control
    thread; never re-enter the same Worker from a Step, Guard, listener, or
    callback already running on that Worker's tick thread.
11. Run the verification command from `references/90-verification.md` that
   matches the host application.

## Flower Source And Docs

When the public Flower repository is available, inspect its README, examples,
and module docs for exact API names before writing code. Application code should
follow the public API and examples first.

```text
https://github.com/flowerjvm/flower
flower/README.md
flower/docs/
```
