# Distributed Tracing — OpenTelemetry Go

A trace is a tree of spans, each describing one unit of work (an HTTP handler, a DB query, an external call). The trace lets you answer "where did time go?" for a single request — something metrics cannot do.

## TracerProvider Setup

Set up the provider once at process start, register a global, install a shutdown hook.

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    "go.opentelemetry.io/otel/sdk/resource"
    semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

func InitTracer(ctx context.Context, serviceName string) (func(context.Context) error, error) {
    exp, err := otlptracegrpc.New(ctx)
    if err != nil {
        return nil, fmt.Errorf("creating otlp exporter: %w", err)
    }

    res, _ := resource.New(ctx,
        resource.WithAttributes(semconv.ServiceName(serviceName)),
    )

    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exp),
        sdktrace.WithResource(res),
        sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.TraceIDRatioBased(0.1))),
    )
    otel.SetTracerProvider(tp)
    return tp.Shutdown, nil
}
```

Wire the shutdown into your signal handler so in-flight spans flush before the process exits.

## Creating Spans

```go
var tracer = otel.Tracer("orders") // package-level

func (s *Service) Create(ctx context.Context, in CreateOrderInput) (*Order, error) {
    ctx, span := tracer.Start(ctx, "OrderService.Create",
        trace.WithAttributes(
            attribute.String("order.user_id", in.UserID),
            attribute.Int("order.item_count", len(in.Items)),
        ),
    )
    defer span.End()

    order, err := s.repo.Insert(ctx, in)
    if err != nil {
        span.RecordError(err)
        span.SetStatus(codes.Error, "insert failed")
        return nil, fmt.Errorf("creating order: %w", err)
    }
    span.SetAttributes(attribute.String("order.id", order.ID))
    return order, nil
}
```

Rules:

- Span name = `Type.Method` or `verb resource` (`GET /users`, not `getUserById_v2`).
- Attributes describe **inputs**, not internals. `order.id` after creation is fine.
- On every error return, call `RecordError` and `SetStatus`. A span without a status is treated as OK.

## otelhttp — Auto-Instrumented HTTP

Inbound:

```go
mux.Handle("/orders", otelhttp.NewHandler(http.HandlerFunc(handleOrders), "POST /orders"))
```

Outbound:

```go
client := http.Client{
    Transport: otelhttp.NewTransport(http.DefaultTransport),
    Timeout:   5 * time.Second,
}
```

Now every outbound request becomes a child span of the request that issued it — no extra code per call site.

## Sampling

Always-on tracing is too expensive at scale. Use `ParentBased(TraceIDRatioBased(0.1))` to keep 10% of traces while honoring parent decisions (so a sampled inbound request is always traced end-to-end).

Tail-based sampling (keep all error traces, sample successes) is a Collector-side concern, not SDK-side.

## Context Propagation Between Services

OpenTelemetry uses W3C `traceparent` headers. With `otelhttp`, propagation is automatic. For other protocols:

```go
import "go.opentelemetry.io/otel/propagation"

otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
    propagation.TraceContext{},
    propagation.Baggage{},
))
```

For gRPC, use `otelgrpc.NewClientHandler()` and `otelgrpc.NewServerHandler()` interceptors.

## Span Granularity — How Deep?

| Operation | Span? |
|---|---|
| HTTP handler | Yes |
| Service-layer method | Yes |
| DB query (`QueryContext`) | Yes (auto via `otelsql`) |
| External HTTP call | Yes (auto via `otelhttp`) |
| Inner pure function | No |
| Loop iteration | No |

Each span has overhead (~1 KB memory plus export bytes). Aim for one span per logical unit, not per Go function call.

## Errors and Status

```go
if err != nil {
    span.RecordError(err, trace.WithAttributes(
        attribute.String("error.kind", "validation"),
    ))
    span.SetStatus(codes.Error, "input validation failed")
    return nil, err
}
```

`RecordError` adds an event; `SetStatus` flips the span to red in the UI. Both matter — only `SetStatus` makes the trace appear as failed in trace lists.
