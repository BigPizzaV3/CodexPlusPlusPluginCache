---
name: go-observability
description: "Use when instrumenting Go services with metrics and distributed traces, or wiring exemplars and request-id propagation. Covers Prometheus patterns (Counter/Gauge/Histogram, low-cardinality labels), OpenTelemetry tracing (TracerProvider, span attributes, errors, context propagation), and metric ↔ trace correlation so a P99 spike jumps to the offending trace. Logging: see go-logging."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Requires Go 1.21+ (for log/slog context variants used in correlation snippets). Prometheus client_golang and OpenTelemetry Go SDK."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Observability — Metrics, Traces, and Correlation

Production Go services need at least two always-on signals to be debuggable: **metrics** (aggregated measurements for alerting and SLOs) and **traces** (per-request flow showing where time went). The third deliverable is **correlation**: a P99 metric spike must lead, in one click, to the trace that caused it.

> **Logging is not in this skill.** Structured logging with `log/slog`, log levels, and zap/logrus/zerolog migration belong to the **go-logging** skill. This skill only references logs in the context of correlating them with traces.

## Core Rules

1. **A feature is not done until it is observable.** New code MUST export at least: one Counter for operations, one Counter for errors, one Histogram for latency.
2. **Histograms, not Summaries, for latency.** Summaries cannot be aggregated across instances; Histograms support `histogram_quantile()` server-side.
3. **Label cardinality is bounded.** Never put unbounded values (user IDs, full URLs, request IDs) in Prometheus labels. Use route patterns, status classes, method.
4. **Context flows everywhere.** A function that does I/O takes `ctx context.Context` as its first argument. No context = no trace propagation = no correlation.
5. **Record errors on the span.** When a span ends in failure, call `span.RecordError(err)` and `span.SetStatus(codes.Error, ...)`. A green span hides a real failure.
6. **Correlate or it didn't happen.** Inject `trace_id` into logs, attach exemplars to histograms. Otherwise the three signals are three different products.

## Signal Decision

Pick the signal that matches the question. Do not log what should be a metric.

| Question | Signal | Tool |
|---|---|---|
| How often does X happen? Error rate? Rate-per-second? | Metric (Counter) | Prometheus |
| What is the P99 latency of endpoint /orders? | Metric (Histogram) | Prometheus + `histogram_quantile` |
| Where did this one slow request spend its time? | Trace | OpenTelemetry |
| Why does latency spike at 14:32? | Metric → exemplar → trace | Prometheus + OTel + exemplars |
| What concrete error message did this request hit? | Log (see go-logging) | `log/slog` |

> Read [references/metrics.md](references/metrics.md) for Counter/Gauge/Histogram patterns, naming, and PromQL-as-comments.
> Read [references/tracing.md](references/tracing.md) for TracerProvider setup, span attributes, and `otelhttp` middleware.

## Metrics — the 60-Second Setup

```go
import "github.com/prometheus/client_golang/prometheus"

// rate(http_requests_total{code=~"5.."}[5m]) / rate(http_requests_total[5m])
var httpRequests = prometheus.NewCounterVec(
    prometheus.CounterOpts{
        Name: "http_requests_total",
        Help: "Total HTTP requests by method, route, status class.",
    },
    []string{"method", "route", "code"}, // ALL bounded
)

// histogram_quantile(0.99, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))
var httpLatency = prometheus.NewHistogramVec(
    prometheus.HistogramOpts{
        Name:    "http_request_duration_seconds",
        Help:    "HTTP request latency in seconds.",
        Buckets: prometheus.DefBuckets,
    },
    []string{"method", "route"},
)
```

The comment above each metric is the PromQL it is designed to answer. This makes the metric discoverable and grep-able from a dashboard.

## Traces — the 60-Second Setup

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/codes"
)

func (s *OrderService) Create(ctx context.Context, in CreateOrderInput) (*Order, error) {
    ctx, span := otel.Tracer("order-service").Start(ctx, "OrderService.Create")
    defer span.End()
    span.SetAttributes(attribute.String("order.user_id", in.UserID))

    order, err := s.repo.Insert(ctx, in)
    if err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, "insert failed")
        return nil, fmt.Errorf("creating order: %w", err)
    }
    return order, nil
}
```

Every service method, every DB query, every external HTTP call gets a span. Context **must** flow into `s.repo.Insert(ctx, ...)` so the DB span is a child of the service span.

## Correlation

### Metrics → Traces with Exemplars

An exemplar attaches a single trace_id to a histogram observation. In Grafana, click the dot on a P99 spike and you land on the trace.

```go
obs := httpLatency.WithLabelValues(r.Method, routePattern)
sc := trace.SpanContextFromContext(ctx)
if eo, ok := obs.(prometheus.ExemplarObserver); ok && sc.IsValid() {
    eo.ObserveWithExemplar(elapsed.Seconds(),
        prometheus.Labels{"trace_id": sc.TraceID().String()})
} else {
    obs.Observe(elapsed.Seconds())
}
```

### Logs → Traces

Use the `otelslog` bridge (see go-logging skill) so every `slog.InfoContext(ctx, ...)` call automatically emits `trace_id` and `span_id`. You can then grep logs by trace_id when starting from a trace, or jump from a log line to the trace.

> Read [references/correlation.md](references/correlation.md) for exemplar wiring details, request-id propagation, and the end-to-end "metric spike → trace → log" workflow.

## Context Propagation

```go
// Bad — breaks trace propagation; the DB call starts a new root trace.
result, err := db.Query("SELECT ...")

// Good — the DB span is a child of the HTTP request span.
result, err := db.QueryContext(ctx, "SELECT ...")
```

Every I/O boundary takes ctx: HTTP client, database, gRPC client, message queue. Use `otelhttp.NewTransport` to instrument outbound HTTP and `otelhttp.NewHandler` for inbound.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| `Summary` for latency | Cannot aggregate across replicas; no quantile flexibility | `Histogram` + `histogram_quantile()` |
| `userID` as a Prometheus label | Unbounded cardinality → Prometheus OOM | Hash to a bucketed `user_tier` or drop |
| Logging the same error you return | Duplicate lines, no single source of truth | Return wrapped, log once at the boundary |
| No `RecordError` on failed spans | Trace shows green, alert fires red | Always pair error returns with `span.RecordError` + `SetStatus` |
| Trace without context propagation | Each layer starts a new root trace | First argument of every I/O method is `ctx context.Context` |
| Global metric defined inside a handler | Re-registers on every call → panic | Declare metrics at package level, register once |
| Histogram with 200 buckets | High storage cost, slow queries | Start with `DefBuckets`, tune from real data |

## Verification Checklist

Before marking the change done:

- [ ] Each new code path emits at least one counter (operations) and one histogram (latency)
- [ ] All metric labels are bounded (method, route pattern, status class — not IDs)
- [ ] Each PromQL query the metric is meant to answer appears as a comment above the metric declaration
- [ ] Every I/O method takes `ctx` first; downstream calls pass it through
- [ ] Every service method, DB call, and outbound HTTP call has a span
- [ ] Failure paths call `span.RecordError(err)` and `span.SetStatus(codes.Error, ...)`
- [ ] At least one histogram uses `ObserveWithExemplar` for trace correlation
- [ ] Logs and traces are correlated (see go-logging skill: `otelslog` bridge)

## References

- [references/metrics.md](references/metrics.md) — Counter/Gauge/Histogram, naming, cardinality, PromQL examples
- [references/tracing.md](references/tracing.md) — TracerProvider, spans, attributes, `otelhttp`, sampling
- [references/correlation.md](references/correlation.md) — Exemplars, trace_id in logs, end-to-end workflow
- [references/anti-patterns.md](references/anti-patterns.md) — Detailed walkthrough of each anti-pattern with code
