# Observability Anti-Patterns

A library of the failure modes that quietly corrupt dashboards or hide outages.

## 1. Summary for Latency

```go
// Bad — quantiles are computed per-instance and cannot be combined.
prometheus.NewSummary(prometheus.SummaryOpts{
    Name:       "http_request_duration_seconds",
    Objectives: map[float64]float64{0.99: 0.001},
})
```

A 10-replica service produces 10 independent P99 streams. There is no PromQL to aggregate them. Heat-mapping is impossible.

```go
// Good — Histogram is aggregatable, exemplar-capable, queryable.
prometheus.NewHistogram(prometheus.HistogramOpts{
    Name:    "http_request_duration_seconds",
    Buckets: prometheus.DefBuckets,
})
```

## 2. Unbounded Label

```go
// Bad — user_id is unbounded; series count = number of users.
httpRequests.WithLabelValues(r.Method, r.URL.Path, userID).Inc()
```

Prometheus disk and RAM grow linearly with cardinality. A single bad metric can take down monitoring.

```go
// Good — labels are method + route pattern + status class. All bounded.
httpRequests.WithLabelValues(r.Method, routePattern, statusClass(status)).Inc()
```

## 3. Span Without Status on Error Path

```go
// Bad — span ends green even though the call failed.
ctx, span := tracer.Start(ctx, "OrderService.Create")
defer span.End()
if err := repo.Insert(ctx, order); err != nil {
    return err
}
```

In the trace UI, this span looks healthy. Failure alerts fire from metrics, but the trace shows no problem — wasted on-call time.

```go
// Good — error is recorded and status flipped.
if err := repo.Insert(ctx, order); err != nil {
    span.RecordError(err)
    span.SetStatus(codes.Error, "insert failed")
    return fmt.Errorf("creating order: %w", err)
}
```

## 4. No Context Propagation

```go
// Bad — the DB call starts a new root trace, severing the chain.
rows, err := db.Query("SELECT ...")
```

The HTTP request trace has only the handler span. You cannot see which query was slow.

```go
// Good — the DB span is a child of the handler span.
rows, err := db.QueryContext(ctx, "SELECT ...")
```

Apply the rule to every I/O: HTTP client, gRPC client, message queue producer.

## 5. Metric Registered Inside a Handler

```go
// Bad — re-registers on every request, panics on the second call.
func handle(w http.ResponseWriter, r *http.Request) {
    counter := prometheus.NewCounter(prometheus.CounterOpts{Name: "thing_total"})
    prometheus.MustRegister(counter)
    counter.Inc()
}
```

```go
// Good — registered once at package level.
var thingCounter = promauto.NewCounter(prometheus.CounterOpts{Name: "thing_total"})

func handle(w http.ResponseWriter, r *http.Request) {
    thingCounter.Inc()
}
```

## 6. Logging Every Span Boundary

Spans already record their own timing. Emitting `slog.Info("entering CreateOrder")` and `slog.Info("exiting CreateOrder")` doubles log volume and adds nothing.

Log at the **request boundary** (HTTP handler completing, job finishing). Trust the trace for everything in between. See the **go-error-handling** skill for the "log or return" rule.

## 7. Exemplar for an Unsampled Trace

```go
// Bad — stores a trace_id that the backend will never have.
eo.ObserveWithExemplar(v, prometheus.Labels{"trace_id": sc.TraceID().String()})
```

```go
// Good — guard on both validity and sampling.
if sc.IsValid() && sc.IsSampled() {
    eo.ObserveWithExemplar(v, prometheus.Labels{"trace_id": sc.TraceID().String()})
} else {
    obs.Observe(v)
}
```

## 8. 200-Bucket Histogram

Buckets are not free. Each label combination × each bucket = one time-series. A 200-bucket histogram with 100 route patterns is 20 000 series for one metric.

Start with `prometheus.DefBuckets` (11 buckets). After one week of real data, recompute buckets centered on your actual P50–P99.

## 9. Always-On 100% Sampling

`sdktrace.AlwaysSample()` is fine for dev. In production it shifts cost to the tracing backend and pollutes searches with successful, uninteresting traces. Use `ParentBased(TraceIDRatioBased(0.1))` or tail-sampling in a Collector.

## 10. Treating Logs as a Metric

```go
// Bad — counting log lines in Loki is slow and approximate.
slog.Info("order created", "user", userID)
```

If you need to alert on order rate, declare a Counter. Logs are events, not measurements.
