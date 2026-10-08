# .proto Layout and Code Generation

## Directory Layout

```
proto/
  user/
    v1/
      user.proto        # package user.v1; service UserService; messages
      events.proto      # package user.v1; events emitted by UserService
  order/
    v1/
      order.proto
gen/
  go/
    user/v1/...         # generated Go (gitignored or committed)
    order/v1/...
buf.yaml
buf.gen.yaml
```

Versioned subdirectories (`v1`, `v2`) are the standard way to evolve gRPC APIs without breaking clients pinned to the old version. The Go import path encodes the version: `github.com/acme/proto/gen/go/user/v1`.

## A Minimal user.proto

```proto
syntax = "proto3";

package user.v1;
option go_package = "github.com/acme/proto/gen/go/user/v1;userv1";

import "google/protobuf/timestamp.proto";

service UserService {
  rpc GetUser    (GetUserRequest)    returns (GetUserResponse);
  rpc CreateUser (CreateUserRequest) returns (CreateUserResponse);
  rpc ListUsers  (ListUsersRequest)  returns (stream User);
}

message User {
  string id    = 1;
  string email = 2;
  google.protobuf.Timestamp created_at = 3;
}

message GetUserRequest  { string id = 1; }
message GetUserResponse { User user = 1; }

message CreateUserRequest {
  string email = 1;
  string name  = 2;
}
message CreateUserResponse { User user = 1; }

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
}
```

Rules:

- `go_package` includes the import path AND an alias (`;userv1`) to avoid collisions.
- Every RPC has a dedicated Request/Response message. Even if it currently has one field, you will thank yourself later.
- Field numbers are stable for the life of the field. Never renumber; never reuse a retired tag.

## Generation with buf

`buf.yaml`:

```yaml
version: v2
modules:
  - path: proto
lint:
  use: [STANDARD]
breaking:
  use: [FILE]
```

`buf.gen.yaml`:

```yaml
version: v2
plugins:
  - remote: buf.build/protocolbuffers/go
    out: gen/go
    opt: paths=source_relative
  - remote: buf.build/grpc/go
    out: gen/go
    opt: paths=source_relative,require_unimplemented_servers=true
```

Then:

```bash
buf generate
buf lint
buf breaking --against ".git#branch=main"
```

`require_unimplemented_servers=true` is important: adding an RPC to the proto will cause a compile error in every server that hasn't implemented it, instead of a 12 Unimplemented at runtime.

## Generation with protoc

```bash
protoc \
  -I proto \
  --go_out=gen/go --go_opt=paths=source_relative \
  --go-grpc_out=gen/go --go-grpc_opt=paths=source_relative,require_unimplemented_servers=true \
  proto/user/v1/user.proto
```

Pin `protoc-gen-go` and `protoc-gen-go-grpc` in `tools.go` and `go.mod` so all developers regenerate identical output.

## Evolution Rules (protobuf)

- Adding a new field with a new tag — safe.
- Removing a field — mark `reserved` so the tag cannot be reused.
- Renaming a field — safe (wire uses tag, not name); breaks JSON consumers.
- Changing a field type — almost always unsafe; introduce a new field with a new tag instead.
- Bumping the version (`v1` → `v2`) — full freedom; clients migrate when ready.

## Generated Code is Read-Only

Never hand-edit files under `gen/`. If you need to extend a message, write helper methods in a separate Go file in your own package:

```go
// internal/user/conversions.go
package user

import userv1 "github.com/acme/proto/gen/go/user/v1"

func fromProto(p *userv1.User) *User { /* ... */ }
func toProto(u *User) *userv1.User   { /* ... */ }
```

## Committing Generated Code

Two camps:

- **Commit it.** Downstream consumers `go get` your repo without running codegen. Recommended for libraries.
- **Don't commit it.** CI regenerates on every build. Recommended for internal services where consumers are part of the same monorepo.

Pick one and document it. Mixing the two — sometimes committed, sometimes regenerated — produces phantom diffs.
