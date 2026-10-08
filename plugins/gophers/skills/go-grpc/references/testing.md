# gRPC Testing with bufconn

`bufconn` provides an in-memory `net.Listener` that exercises the full gRPC stack — marshaling, interceptors, metadata, status codes — without binding a TCP port. Fast, deterministic, and parallel-safe.

## Harness

```go
func newTestServer(t *testing.T, svc pb.UserServiceServer) pb.UserServiceClient {
    t.Helper()
    lis := bufconn.Listen(1024 * 1024)
    srv := grpc.NewServer(grpc.ChainUnaryInterceptor(loggingUnary))
    pb.RegisterUserServiceServer(srv, svc)
    go func() { _ = srv.Serve(lis) }()
    t.Cleanup(srv.Stop)

    conn, err := grpc.NewClient("passthrough://bufnet",
        grpc.WithContextDialer(func(_ context.Context, _ string) (net.Conn, error) { return lis.Dial() }),
        grpc.WithTransportCredentials(insecure.NewCredentials()),
    )
    if err != nil { t.Fatalf("dial: %v", err) }
    t.Cleanup(func() { _ = conn.Close() })

    return pb.NewUserServiceClient(conn)
}
```

## Asserting Status Codes

Status codes are part of the API. Test them explicitly:

```go
func TestGetUser_NotFound(t *testing.T) {
    client := newTestServer(t, &userService{repo: emptyRepo{}})

    _, err := client.GetUser(context.Background(), &pb.GetUserRequest{Id: "missing"})
    if status.Code(err) != codes.NotFound {
        t.Fatalf("got code %v, want NotFound; err: %v", status.Code(err), err)
    }
}
```

Table-driven for all error mappings:

```go
cases := []struct {
    name string
    arg  string
    code codes.Code
}{
    {"empty id", "",     codes.InvalidArgument},
    {"missing",  "x",    codes.NotFound},
    {"forbidden", "yyy", codes.PermissionDenied},
}
for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
        _, err := client.GetUser(ctx, &pb.GetUserRequest{Id: tc.arg})
        if got := status.Code(err); got != tc.code {
            t.Fatalf("got %v, want %v", got, tc.code)
        }
    })
}
```

## Metadata (auth headers, request IDs)

```go
md := metadata.Pairs("authorization", "Bearer test-token")
ctx := metadata.NewOutgoingContext(context.Background(), md)
resp, err := client.GetUser(ctx, req)
```

To assert metadata server-side, capture it in an interceptor:

```go
var observed metadata.MD
captureUnary := func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, h grpc.UnaryHandler) (any, error) {
    observed, _ = metadata.FromIncomingContext(ctx)
    return h(ctx, req)
}
```

## Server Streaming

```go
stream, err := client.ListUsers(ctx, &pb.ListUsersRequest{})
if err != nil { t.Fatal(err) }

var got []*pb.User
for {
    u, err := stream.Recv()
    if errors.Is(err, io.EOF) { break }
    if err != nil { t.Fatalf("recv: %v", err) }
    got = append(got, u)
}
```

To test cancellation, use `context.WithCancel` and verify the server returns when the client calls `cancel()`.

## Client Streaming

```go
stream, err := client.UploadChunks(ctx)
for _, chunk := range chunks {
    if err := stream.Send(chunk); err != nil { t.Fatal(err) }
}
resp, err := stream.CloseAndRecv()
```

## Testing Deadlines

```go
ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
defer cancel()

_, err := client.SlowCall(ctx, req)
if status.Code(err) != codes.DeadlineExceeded {
    t.Fatalf("got %v, want DeadlineExceeded", status.Code(err))
}
```

## Don't

- Don't reach for a real TCP port (`localhost:0`) when `bufconn` will do. Real ports flake on busy CI runners.
- Don't use `WithInsecure()` — it's deprecated. Use `insecure.NewCredentials()`.
- Don't compare error strings; codes are stable, messages are not.
- Don't share a single `bufconn` across parallel tests; create one per `t`.
