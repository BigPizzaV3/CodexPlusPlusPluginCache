# Flower Studio Integration

Use Flower Studio when a developer needs a local, read-only view of correlated
Flower execution, static Flow structure, evaluation results, and monitoring.
Studio is a standalone application, not a host Maven or Gradle dependency.

## Choose The Smallest Inspection Surface

- Use the built-in Flower Console for the current Engine, Worker, Flow, and
  Step state of one running Spring Boot application.
- Use Flower Flow Graph for static source structure without runtime history.
- Use Flower Studio for correlated Flow, Agent, Harness, and Action history,
  evaluation results, monitoring, and optional static/runtime graph overlays.

## Obtain And Run Studio

Flower Studio `0.1.1` requires JDK 17 or newer. Use the official GitHub Release
only after the user requests or approves downloading and executing the binary:

```text
https://github.com/flowerjvm/flower-studio/releases/tag/v0.1.1
flower-studio-0.1.1.jar
flower-studio-0.1.1.jar.sha256
```

Verify the SHA-256 file before executing the JAR. Do not add Studio to the host
build or substitute an unreviewed binary.

Run project mode against the application root:

```powershell
java -jar .\flower-studio-0.1.1.jar `
  --project-root=D:\Code\my-flower-application
```

Open `http://127.0.0.1:8077`.

Project mode discovers conventional observation and evaluation files, watches
them for changes, and uses its bundled Flower Flow Graph `0.1.1` analyzer to
refresh static Java Flow structure. It does not inject into the application,
scan its ports, or control its Engine.

## Prepare Application Evidence

Studio does not create runtime observations or execute evaluations. The host,
test, CLI, CI job, or scheduler must publish them.

Project mode looks for:

```text
flower-observations.jsonl
flower-evaluations.jsonl
flower-evaluation-feedback.jsonl
```

Prefer `build/flower-studio/flower-observations.jsonl` for local host output.
Put the blocking JSONL sink behind a bounded asynchronous handoff and sanitize
authorization data, API keys, personal information, prompts, model responses,
failure text, and Tool payloads before publication.

Use one common `FlowerObservationSink` for Flower Core and the optional Flower
Agent, AI Harness, and Action Runtime observation adapters. Preserve one outer
`traceId` and meaningful `runId` and `parentRunId` relationships so Studio can
project the combined hierarchy.

Evaluation execution and authenticated human-feedback collection remain in
the host or an external job. Studio only reads published, sanitized records.

## Evidence Boundaries

- Static graph routes describe possible source paths, not proof of execution.
- Runtime observations describe the route recorded for one run.
- A missing or version-mismatched static definition must remain visible as
  uncertainty; never attach current source to an old Trace as exact evidence
  without a compatible definition identity.
- Studio monitoring covers only retained local records, not all-time metrics.

## Security And Operating Boundary

- Keep the default loopback binding or an explicitly trusted private
  environment. Studio `0.1.1` has no public-service authentication or
  organization authorization.
- Do not expose it directly to the Internet.
- Keep Studio read-only. Do not add start, retry, resume, signal, approval,
  Action execution, evaluation execution, or feedback mutation paths.
- Treat artifact downloads as disabled unless the configured artifact root is
  intentional and contained.
- Use production metrics, tracing, collectors, storage, and retention for
  large or operationally critical deployments.

## Focused Verification

After startup, verify the health endpoint and inspect diagnostics:

```powershell
$health = Invoke-RestMethod http://127.0.0.1:8077/api/health
$health.status
```

`UP` means the configured inputs loaded without a health-degrading condition.
`DEGRADED` may correctly identify missing or malformed local input; inspect the
returned diagnostics instead of assuming the process failed. Confirm that the
Trace, Graph, Evaluations, and Monitoring views show only the expected
sanitized project data.

