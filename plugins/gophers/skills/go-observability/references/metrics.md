# Metrics — Prometheus Client Patterns

Prometheus client metrics are the always-on numbers your alerts and SLO dashboards consume. They are cheap to scrape and aggregate, but expensive to mis-label.

## The Four Metric Types

| Type | What it answers | Example |
|---|---|---|
| **Counter** | "How often?" Monotonically increasing rate. | `http_requests_total`, `orders_failed_total` |
| **Gauge** | "How many right now?" Up/down snapshot. | `db_connections_inuse`, `queue_depth` |
| **Histogram** | "How long, with quantiles?" Bucketed durations. | `http_request_duration_seconds` |
| **Summary** | Like Histogram but client-side quantiles. **Avoid for SLOs** — cannot aggregate across replicas. | (rarely correct) |

## PromQL-as-Comments Convention

Declare the query the metric is meant to support, directly above the metric. Future readers (and AI agents) can grep for the metric and find the dashboard query.

```go
// Error rate over 5 minutes:
//   sum(rate(orders_failed_total[5m])) / sum(rate(orders_created_total[5m]))
var ordersFailed = prometheus.NewCounter(
    prometheus.CounterOpts{
        Name: "orders_failed_total",
        Help: "Total order creations that failed (any reason).",
    },
)
```

## Naming Conventions

- Suffix: `_total` for counters, `_seconds` for time, `_bytes` for size.
- Snake_case, lowercase, namespace prefix for the service: `orders_created_total`, not `OrdersCreatedTotal`.
- Help text is a complete sentence ending with a period.

## Counter

```go
var (
    httpRequests = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_requests_total",
            Help: "Total HTTP requests handled.",
        },
        []string{"method", "route", "code"},
    )
)

httpRequests.WithLabelValues(r.Method, routePattern, statusClass(status)).Inc()
```

Where `routePattern` is `/users/{id}`, never the raw URL `/users/42`.

## Gauge

```go
var dbConnsInUse = prometheus.NewGauge(
    prometheus.GaugeOpts{Name: "db_connections_in_use", Help: "Open DB connections currently in use."},
)

dbConnsInUse.Set(float64(db.Stats().InUse))
```

For pull-style stats, scrape via a collector that calls `db.Stats()` rather than caching.

## Histogram

```go
// histogram_quantile(0.99, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))
var httpLatency = prometheus.NewHistogramVec(
    prometheus.HistogramOpts{
        Name:    "http_request_duration_seconds",
        Help:    "HTTP request duration in seconds.",
        Buckets: prometheus.DefBuckets, // tune from real latencies
    },
    []string{"method", "route"},
)

start := time.Now()
defer func() {
    httpLatency.WithLabelValues(r.Method, routePattern).Observe(time.Since(start).Seconds())
}()
```

### Choosing buckets

`prometheus.DefBuckets` (5ms..10s) is fine for HTTP latencies. For DB queries, narrow toward 1ms..1s. For long jobs, widen to seconds..minutes. Re-tune after 1 week of production data.

## Cardinality Rules

Prometheus stores one time-series per unique label combination. 1000 routes × 10 methods × 5 status classes = 50 000 series — fine. Adding `user_id` (1M users) explodes to 50 billion series — instant out-of-memory.

| Label | Bounded? | Use? |
|---|---|---|
| `method` (GET/POST/...) | Yes (~8) | Yes |
| `route` (templated `/users/{id}`) | Yes (~100s) | Yes |
| `code` (status class `2xx`) | Yes (5) | Yes |
| `user_id` | No | Never |
| `url` (raw) | No | Never — collapse to route pattern |
| `error_message` | No | Never — bucket by `error_class` |

## Multi-Window SLO Burn Rate

```
# Burn rate alert: page if error budget is consumed 14x faster than allowed.
(
  sum(rate(http_requests_total{code=~"5.."}[1h])) / sum(rate(http_requests_total[1h]))
) > (14 * 0.001)
and
(
  sum(rate(http_requests_total{code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
) > (14 * 0.001)
```

The double window prevents flapping on transient spikes.

## Registering with the HTTP Server

```go
import "github.com/prometheus/client_golang/prometheus/promhttp"

mux.Handle("/metrics", promhttp.Handler())
```

Use `promauto` to register-on-declare if you prefer one less line per metric, but keep the side effect visible in code review.
