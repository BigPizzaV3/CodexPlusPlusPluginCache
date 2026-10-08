---
name: go-grpc
description: "Use when implementing or reviewing gRPC servers/clients in Go. Covers .proto organisation, code generation with protoc/buf, server bootstrap (interceptors, health, graceful shutdown), client patterns (reuse, deadlines, retries), status.Code error handling, streaming, TLS/mTLS, and bufconn testing. Apply when writing .proto files, adding interceptors, or auditing a service for production readiness."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Requires Go 1.21+, protoc (or buf), and google.golang.org/grpc v1.60+."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go gRPC

Treat gRPC as a transport. Keep `.proto`-generated code and business logic separated. The official Go implementation is `google.golang.org/grpc`; pair it with `protoc-gen-go` + `protoc-gen-go-grpc` (or `buf generate`).

## Core Rules

1. **One concern per layer.** `.proto` defines the contract; generated code lives in `gen/`; service implementation lives in `internal/`. Never edit generated files.
2. **Always wrap RPC arguments in Request/Response messages.** Bare scalars (`string`, `int32`) cannot be evolved without breaking callers.
3. **Return typed status codes, never raw errors.** A `fmt.Errorf` becomes `codes.Unknown` on the wire — the client cannot decide whether to retry.
4. **Every client call has a deadline.** No `context.Background()` to a remote service. Set `context.WithTimeout` per call.
5. **Reuse connections.** HTTP/2 multiplexes; creating a new `grpc.ClientConn` per request is a TLS handshake leak.
6. **Disable reflection in production.** Reflection is a developer convenience that doubles as an API enumeration tool for attackers.

## When to Use What

| Need | Use |
|---|---|
| Define service | `.proto` file in `proto/<service>/v1/` |
| Generate stubs | `buf generate` or `protoc --go_out --go-grpc_out` |
| Cross-cutting (auth, logging, recovery) | `grpc.ChainUnaryInterceptor` / `ChainStreamInterceptor` |
| Health probes (Kubernetes) | `grpc_health_v1` from `google.golang.org/grpc/health` |
| Errors with details | `status.Errorf(codes.X, ...)` + `WithDetails(errdetails.BadRequest{...})` |
| Tests | `google.golang.org/grpc/test/bufconn` |
| Service mesh / mTLS | `credentials.NewTLS` or delegate to Istio/Linkerd |

> Read [references/proto-and-codegen.md](references/proto-and-codegen.md) when organizing `.proto` packages or wiring `buf`.
> Read [references/status-and-errors.md](references/status-and-errors.md) when mapping domain errors to gRPC codes.

## Server Bootstrap

```go
import (
    "google.golang.org/grpc"
    "google.golang.org/grpc/health"
    healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

srv := grpc.NewServer(
    grpc.ChainUnaryInterceptor(recoveryUnary, loggingUnary, authUnary),
    grpc.ChainStreamInterceptor(recoveryStream, loggingStream),
)
pb.RegisterUserServiceServer(srv, &userService{...})
healthpb.RegisterHealthServer(srv, health.NewServer())

go func() { _ = srv.Serve(lis) }()

// Graceful shutdown bounded by a hard timeout.
<-shutdownSignal
stopped := make(chan struct{})
go func() { srv.GracefulStop(); close(stopped) }()
select {
case <-stopped:
case <-time.After(15 * time.Second):
    srv.Stop()
}
```

Three pieces are non-negotiable: interceptors for cross-cutting concerns, health service for Kubernetes probes, and a bounded graceful shutdown.

## Client Bootstrap

```go
conn, _ := grpc.NewClient("dns:///user-service:50051",
    grpc.WithTransportCredentials(credentials.NewTLS(tlsCfg)),
    grpc.WithDefaultServiceConfig(`{
      "loadBalancingPolicy": "round_robin",
      "methodConfig": [{
        "name": [{"service": "user.v1.UserService"}],
        "timeout": "5s",
        "retryPolicy": {
          "maxAttempts": 3, "initialBackoff": "0.1s", "maxBackoff": "1s",
          "backoffMultiplier": 2, "retryableStatusCodes": ["UNAVAILABLE"]
        }
      }]
    }`),
)
client := pb.NewUserServiceClient(conn)
ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second); defer cancel()
resp, err := client.GetUser(ctx, &pb.GetUserRequest{Id: id})
```

The service config is the right place for retries — let the library handle the loop, backoff, and `UNAVAILABLE`-only filter.

## Errors

A raw Go error returned from an RPC becomes `codes.Unknown`. The client cannot tell a 404 from a 500. Always use `status.Errorf`:

```go
if errors.Is(err, ErrNotFound) {
    return nil, status.Errorf(codes.NotFound, "user %q not found", req.Id)
}
if errors.As(err, &validationErr) {
    st, _ := status.New(codes.InvalidArgument, "validation").WithDetails(
        &errdetails.BadRequest{FieldViolations: violations(validationErr)},
    )
    return nil, st.Err()
}
return nil, status.Errorf(codes.Internal, "lookup: %v", err)
```

Quick map:

| Domain | Code |
|---|---|
| Missing/invalid field | `InvalidArgument` |
| Not found | `NotFound` |
| Already exists | `AlreadyExists` |
| Unauthenticated | `Unauthenticated` |
| Authenticated but forbidden | `PermissionDenied` |
| Rate-limited | `ResourceExhausted` |
| Dependency down, retriable | `Unavailable` |
| Bug, unexpected | `Internal` |

## Streaming

| Pattern | Use case |
|---|---|
| Server streaming | Log tailing, paginated result sets, server-sent events |
| Client streaming | File upload, batch ingest |
| Bidirectional | Chat, real-time sync |

Streams must respect `ctx.Done()`. A goroutine reading from a stream after the client disconnects is a slow leak.

```go
func (s *server) ListUsers(req *pb.ListUsersRequest, stream pb.UserService_ListUsersServer) error {
    for _, u := range s.repo.All(stream.Context()) {
        if err := stream.Send(toProto(u)); err != nil {
            return err // includes ctx canceled
        }
    }
    return nil
}
```

## Testing with bufconn

`bufconn` is an in-memory `net.Listener`. It exercises the real gRPC stack — interceptors, marshaling, metadata — without binding a TCP port. See [references/testing.md](references/testing.md) for the full harness plus table-driven status-code assertions, metadata injection, and stream testing.

## Security Notes

- TLS in production. Plaintext is only acceptable behind a confirmed-private network (and even then mTLS is preferable).
- For service-to-service auth, prefer a mesh (Istio/Linkerd) over hand-rolled token validation.
- For user auth, implement `credentials.PerRPCCredentials` to attach a token and validate inside an auth interceptor.
- Reflection: enable in dev, disable in prod via build tag or env flag.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| `return fmt.Errorf("not found")` | Wire code is `Unknown`, clients can't retry-discriminate | `status.Errorf(codes.NotFound, ...)` |
| `context.Background()` to a client call | No deadline → goroutines pile up on a slow dependency | `context.WithTimeout(parent, 5s)` |
| New `ClientConn` per request | TLS handshake every call; sockets exhaust | One `grpc.NewClient` at startup, reuse |
| Bare `string` as RPC argument | Cannot add fields without breaking callers | Always Request/Response messages |
| Reflection on in production | Lets attackers enumerate every method | Compile-out with build tag in prod |
| `codes.Internal` for all errors | Client retry config can't distinguish bugs from outages | Map domain → specific codes |
| No health service | Kubernetes can't gate traffic; rolling deploys break | Register `grpc_health_v1` |
| Ignoring `stream.Context().Done()` | Goroutines run after client disconnect | Select on `ctx.Done()` in stream loops |

## Verification Checklist

- [ ] `.proto` packages are versioned (`pkg/v1`, not `pkg`)
- [ ] All RPCs take Request and return Response messages
- [ ] Generated code is in a separate directory, never edited
- [ ] Every error return uses `status.Errorf` with a specific code
- [ ] Every client call has a deadline via `context.WithTimeout`
- [ ] Server registers `grpc_health_v1`
- [ ] `GracefulStop` is bounded by a `time.After` fallback
- [ ] Reflection is gated to non-production builds
- [ ] Tests use `bufconn` and assert `status.Code(err)`

## References

- [references/proto-and-codegen.md](references/proto-and-codegen.md) — `.proto` layout, `buf.yaml`, codegen flags
- [references/status-and-errors.md](references/status-and-errors.md) — code mapping, rich details with `errdetails`
- [references/testing.md](references/testing.md) — `bufconn`, metadata, streaming assertions
- [references/anti-patterns.md](references/anti-patterns.md) — detailed walkthrough of each anti-pattern
