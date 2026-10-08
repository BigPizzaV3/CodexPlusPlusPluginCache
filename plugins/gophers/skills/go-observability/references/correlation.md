# Signal Correlation

A trace, a metric, and a log line about the same event are useless if you cannot move between them in one click. Correlation is the glue.

## Exemplars — Metrics to Traces

An exemplar is a single (value, trace_id, timestamp) triple attached to a histogram bucket. In Grafana, an exemplar appears as a dot on a heatmap; clicking opens the trace.

```go
import (
    "github.com/prometheus/client_golang/prometheus"
    "go.opentelemetry.io/otel/trace"
)

func observeWithExemplar(ctx context.Context, h *prometheus.HistogramVec, v float64, lbls ...string) {
    obs := h.WithLabelValues(lbls...)
    sc := trace.SpanContextFromContext(ctx)
    if eo, ok := obs.(prometheus.ExemplarObserver); ok && sc.IsValid() && sc.IsSampled() {
        eo.ObserveWithExemplar(v, prometheus.Labels{
            "trace_id": sc.TraceID().String(),
        })
        return
    }
    obs.Observe(v)
}
```

Two guards matter:

1. `sc.IsValid()` — there must be a span in context.
2. `sc.IsSampled()` — never store an exemplar for a dropped trace; the link would be dead.

### Enabling Exemplars in the Scrape

The Prometheus client emits exemplars only when the `/metrics` endpoint advertises them. Use the new exposition format:

```go
import "github.com/prometheus/client_golang/prometheus/promhttp"

mux.Handle("/metrics", promhttp.HandlerFor(
    prometheus.DefaultGatherer,
    promhttp.HandlerOpts{EnableOpenMetrics: true},
))
```

And the Prometheus server must be configured with `--enable-feature=exemplar-storage`.

## Trace ID in Logs

The bridge from `log/slog` to OpenTelemetry lives in `go.opentelemetry.io/contrib/bridges/otelslog`. With it, every `slog.InfoContext(ctx, ...)` call automatically includes `trace_id` and `span_id`.

```go
import "go.opentelemetry.io/contrib/bridges/otelslog"

slog.SetDefault(slog.New(otelslog.NewHandler("orders")))
slog.InfoContext(ctx, "order created", "order_id", order.ID)
// → {"msg":"order created","order_id":"...","trace_id":"...","span_id":"..."}
```

See the **go-logging** skill for the full slog setup. This skill only specifies the correlation bridge.

## Request ID Propagation

A request ID survives sampling decisions: even if the trace is dropped, you can still grep logs by the same ID across services. Generate at the edge, propagate via header:

```go
const headerRequestID = "X-Request-Id"

func WithRequestID(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        rid := r.Header.Get(headerRequestID)
        if rid == "" {
            rid = uuid.NewString()
        }
        ctx := context.WithValue(r.Context(), requestIDKey{}, rid)

        // Add to span so trace UI shows it.
        if span := trace.SpanFromContext(ctx); span.IsRecording() {
            span.SetAttributes(attribute.String("request.id", rid))
        }
        w.Header().Set(headerRequestID, rid)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

## The End-to-End Workflow

1. **Alert fires** on `histogram_quantile(0.99, ...) > 500ms`.
2. **Grafana exemplar** on the heatmap dot reveals a `trace_id`.
3. **Click → trace view**: which span took 480ms? The DB call.
4. **Span attributes** show `db.statement` and `request.id`.
5. **Grep logs** by `request.id` (or `trace_id`) for the structured log line with the error message.

If any step is missing, the next on-call engineer reverts to guessing. The point of this skill is to make all five clicks work.

## What Not to Correlate

- **Do not put the full log line in a span event.** Spans go to a tracing backend with different retention and cost. Keep span events small.
- **Do not put trace IDs in metric labels.** Trace IDs are unbounded — they belong in exemplars, not labels.
- **Do not log every span.** The trace already records the span. Log only at the request/job boundary (the same rule as go-error-handling).
