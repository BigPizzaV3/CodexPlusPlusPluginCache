# gRPC Status Codes and Rich Errors

The status code is the only piece of error information that travels reliably across language boundaries. The message is a string; clients write retry logic against the code.

## The Code Cheat Sheet

| Code | Meaning | Retry? |
|---|---|---|
| `OK` | Success | — |
| `Canceled` | Caller canceled | No (caller's choice) |
| `Unknown` | Default for raw `error`; means "we don't know what happened" | No |
| `InvalidArgument` | Malformed request (validation) | No |
| `DeadlineExceeded` | Timeout | Caller's policy |
| `NotFound` | Entity does not exist | No |
| `AlreadyExists` | Create conflict | No |
| `PermissionDenied` | Authenticated, lacks permission | No |
| `ResourceExhausted` | Rate-limited or quota exceeded | Backoff + retry |
| `FailedPrecondition` | System not in required state (e.g., empty bucket) | No |
| `Aborted` | Concurrency conflict (e.g., optimistic lock) | Yes |
| `OutOfRange` | Range error (seek past end) | No |
| `Unimplemented` | Method missing on this server | No |
| `Internal` | Server bug or invariant violation | No |
| `Unavailable` | Dependency down, transient | Yes (with backoff) |
| `DataLoss` | Unrecoverable data corruption | No |
| `Unauthenticated` | Missing/invalid credentials | No (refresh first) |

## Mapping Domain Errors

Centralize the mapping. One function from domain error → gRPC error:

```go
func toGRPC(err error) error {
    if err == nil { return nil }

    switch {
    case errors.Is(err, ErrNotFound):
        return status.Errorf(codes.NotFound, "%v", err)
    case errors.Is(err, ErrAlreadyExists):
        return status.Errorf(codes.AlreadyExists, "%v", err)
    case errors.Is(err, ErrForbidden):
        return status.Errorf(codes.PermissionDenied, "%v", err)
    case errors.Is(err, ErrRateLimited):
        return status.Errorf(codes.ResourceExhausted, "%v", err)
    }

    var ve *ValidationError
    if errors.As(err, &ve) {
        st, _ := status.New(codes.InvalidArgument, "validation failed").
            WithDetails(&errdetails.BadRequest{
                FieldViolations: ve.Violations(),
            })
        return st.Err()
    }

    return status.Errorf(codes.Internal, "%v", err)
}
```

Every RPC ends with `return toGRPC(err)` and the body is otherwise plain Go.

## Rich Details with `errdetails`

`google.golang.org/genproto/googleapis/rpc/errdetails` defines well-known detail messages: `BadRequest`, `QuotaFailure`, `RetryInfo`, `LocalizedMessage`, `PreconditionFailure`. They are extracted client-side via `status.FromError(err).Details()`.

```go
st, _ := status.New(codes.InvalidArgument, "validation failed").WithDetails(
    &errdetails.BadRequest{
        FieldViolations: []*errdetails.BadRequest_FieldViolation{
            {Field: "email", Description: "is required"},
            {Field: "age",   Description: "must be ≥ 18"},
        },
    },
    &errdetails.LocalizedMessage{Locale: "en-US", Message: "Please fix the fields below."},
)
return nil, st.Err()
```

Use details for structured information clients can act on. Stack traces belong in logs, not in details.

## Client-Side Inspection

```go
resp, err := client.GetUser(ctx, req)
if err != nil {
    st, _ := status.FromError(err)
    switch st.Code() {
    case codes.NotFound:
        return nil, ErrNotFound
    case codes.Unavailable:
        return nil, errRetryable
    default:
        for _, d := range st.Details() {
            if br, ok := d.(*errdetails.BadRequest); ok {
                return nil, validationFromBR(br)
            }
        }
        return nil, fmt.Errorf("rpc: %w", err)
    }
}
```

## What Not To Do

- **Do not pack stack traces into the status message.** It leaks internals and bloats wire size. Log the trace server-side; return a short cause.
- **Do not return `codes.Internal` from every failure.** Retry policies key off the code; "everything is Internal" disables automatic retries on `Unavailable`.
- **Do not lose the wrapped error.** Keep `fmt.Errorf("...: %w", err)` for server logs, and convert only at the RPC boundary.
- **Do not invent new codes.** Stick to the 16 in `codes`. Custom semantics live in `errdetails`.
