# gRPC Anti-Patterns

## 1. Returning Raw `error` from an RPC

```go
// Bad — wire code is Unknown.
return nil, fmt.Errorf("user not found")
```

```go
// Good — clients can act on NotFound.
return nil, status.Errorf(codes.NotFound, "user %q not found", id)
```

Retry policies, dashboards, and tracing all key off the code. `Unknown` is a black hole.

## 2. `context.Background()` to a Client Call

```go
// Bad — slow upstream → goroutine pile-up.
resp, err := client.GetUser(context.Background(), req)
```

```go
// Good — always a deadline.
ctx, cancel := context.WithTimeout(parentCtx, 2*time.Second)
defer cancel()
resp, err := client.GetUser(ctx, req)
```

The right deadline is "what the caller can wait for", not "what the server might need".

## 3. New ClientConn per Request

```go
// Bad — TLS handshake every call; socket exhaustion.
func handle(id string) (*pb.User, error) {
    conn, _ := grpc.NewClient(target, ...)
    defer conn.Close()
    return pb.NewUserServiceClient(conn).GetUser(ctx, &pb.GetUserRequest{Id: id})
}
```

```go
// Good — one conn at startup, shared.
var userClient pb.UserServiceClient
func init() {
    conn, _ := grpc.NewClient(target, ...)
    userClient = pb.NewUserServiceClient(conn)
}
```

A single `ClientConn` multiplexes thousands of in-flight RPCs over one HTTP/2 connection.

## 4. Bare Scalar as RPC Argument

```proto
// Bad — cannot add fields, breaks all callers.
rpc GetUser (string) returns (User);
```

```proto
// Good — wrapper messages can evolve.
rpc GetUser (GetUserRequest) returns (GetUserResponse);
```

Even `rpc Ping (Empty) returns (Empty)` should use messages so you can add fields later without a major version.

## 5. Reflection Enabled in Production

```go
import "google.golang.org/grpc/reflection"
reflection.Register(srv) // fine in dev, dangerous in prod
```

Reflection lets `grpcurl` enumerate every method without prior knowledge. Behind a public endpoint, it's free attack reconnaissance. Gate with a build tag.

```go
//go:build dev
package main
func init() { reflection.Register(srv) }
```

## 6. Same Code for All Errors

```go
// Bad — Internal disables retries; clients hammer broken servers.
return nil, status.Errorf(codes.Internal, "%v", err)
```

```go
// Good — distinct codes drive distinct client behavior.
switch {
case errors.Is(err, ErrUnavailable):
    return nil, status.Errorf(codes.Unavailable, "%v", err) // retried
case errors.Is(err, ErrValidation):
    return nil, status.Errorf(codes.InvalidArgument, "%v", err) // not retried
default:
    return nil, status.Errorf(codes.Internal, "%v", err)
}
```

## 7. No Health Service

Without `grpc_health_v1.HealthServer` registered, Kubernetes cannot run a readiness probe — and a rolling deployment will route traffic to a process before it is ready.

```go
healthpb.RegisterHealthServer(srv, health.NewServer())
```

Then your probe is:

```yaml
readinessProbe:
  grpc:
    port: 50051
```

## 8. Goroutine Leak in Stream Handler

```go
// Bad — runs forever after client disconnects.
for msg := range events {
    if err := stream.Send(msg); err != nil { return err }
}
```

```go
// Good — exit when ctx canceled.
for {
    select {
    case <-stream.Context().Done():
        return stream.Context().Err()
    case msg, ok := <-events:
        if !ok { return nil }
        if err := stream.Send(msg); err != nil { return err }
    }
}
```

## 9. Hand-Editing Generated Code

The next `buf generate` overwrites your changes silently. Wrap generated types in helpers inside your own package — don't fork the stubs.

## 10. Mixing Service Config Retries with Custom Loops

The service config `retryPolicy` already retries on the listed codes. Adding an outer `for i := 0; i < 3; i++` triples the actual attempts, multiplies the load on a degraded dependency, and makes deadline math confusing.

Pick one mechanism (service config is the right one) and stick with it.
