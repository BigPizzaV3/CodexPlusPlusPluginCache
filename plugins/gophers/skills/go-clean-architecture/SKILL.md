---
name: go-clean-architecture
description: "Use when scaffolding or refactoring a Go service into a framework-agnostic clean (hexagonal) architecture: Domain, Usecase, Repository, Delivery layers, inward dependency rule, 'framework/database is a detail'. Apply when untangling a monolith or checking whether business logic is testable without HTTP or DB."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Requires Go 1.21+. Framework-agnostic: works with Gin, Echo, Fiber, Chi, or net/http; swap freely."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Clean Architecture

A Go service organized into four concentric layers — Domain, Usecase, Repository, Delivery — where source code depends *inward only*. Done well, the HTTP framework and the database are interchangeable details; the business logic is testable without either.

This skill is framework-agnostic. Swap Gin for Fiber, Echo, Chi, or `net/http` by replacing the delivery layer — zero changes elsewhere.

## Core Rules

1. **Dependency Rule.** Source depends inward: Delivery → Usecase → Domain. Repository implements interfaces declared in Domain. Domain depends on nothing.
2. **Framework is a detail.** Gin/Fiber/Echo/Chi/net-http types live only in `internal/delivery/`. Usecases see plain Go values.
3. **Database is a detail.** SQL, sqlx, sqlc, pgx, GORM live only in `internal/repository/`. Usecases see repository interfaces.
4. **Domain owns the interfaces; layers below provide implementations.** `UserRepository` is an interface in `internal/domain`; the Postgres struct is in `internal/repository` and unexported.
5. **DTOs at the edges.** Delivery layer maps HTTP request bodies to domain inputs and domain entities to response bodies. Usecases never see `*gin.Context`, `http.Request`, or DB rows.
6. **`cmd/<binary>/main.go` is the only place that knows the whole system.** Wiring (DI) is explicit, framework-free Go code.

## When This Pays Off

| Symptom | What clean architecture buys you |
|---|---|
| HTTP handlers contain SQL | Move SQL into a repository; handlers shrink to 5 lines |
| Tests need a running DB | Mock the repository interface; usecase tests run in milliseconds |
| Swapping web frameworks is a rewrite | Replace `internal/delivery/http`; nothing else touched |
| Business rules duplicated across handlers | Single usecase function, called by HTTP, gRPC, and a CLI |
| ORM hooks fire in surprising places | Repository methods are explicit; no hidden behavior |

If the service is a 200-line cron job, this skill is overkill. If it will live 3+ years and grow features, it's the cheapest insurance you can buy.

## Project Structure

```
myapp/
  cmd/
    api/main.go             # entry point: config → DI → start server
    worker/main.go          # different entry, same Domain & Usecase
  internal/
    domain/                 # entities, value objects, repository INTERFACES, domain errors
      user.go
      order.go
      errors.go
    usecase/                # business logic; depends only on domain
      user_usecase.go
      order_usecase.go
    repository/             # implementations of domain interfaces (Postgres, in-memory, ...)
      user_postgres.go
      order_postgres.go
    delivery/               # framework-specific adapters
      http/                 # Gin/Echo/Chi/net-http handlers and routes
        user_handler.go
        order_handler.go
      grpc/                 # gRPC server adapters (if applicable)
  pkg/                      # exported, importable from outside (if you publish a library)
  migrations/               # SQL migrations
  config/
  go.mod
```

> Read [references/domain.md](references/domain.md), [references/usecase.md](references/usecase.md), [references/repository.md](references/repository.md), and [references/delivery.md](references/delivery.md) for the per-layer responsibilities.

## The Four Layers

| Layer | Package | Can import | Must not import |
|---|---|---|---|
| Domain | `internal/domain` | stdlib only | usecase, repository, delivery, frameworks |
| Usecase | `internal/usecase` | domain | repository (concrete), delivery, frameworks |
| Repository | `internal/repository` | domain, DB driver | delivery, frameworks |
| Delivery | `internal/delivery/...` | domain, usecase (via interface), framework | repository (concrete) |

A `golangci-lint` config with `depguard` enforces these rules at CI time.

## Layer Sketches

```go
// Domain — pure interfaces and entities, no I/O.
package domain
type User struct { ID, Email, Name string; CreatedAt time.Time }
type UserRepository interface {
    Get(ctx context.Context, id string) (*User, error)
    Create(ctx context.Context, u *User) error
}
type UserService interface {
    Create(ctx context.Context, in CreateUserInput) (*User, error)
}
```

```go
// Usecase — business logic, depends only on domain interfaces.
type userUsecase struct{ repo domain.UserRepository }

func NewUserUsecase(repo domain.UserRepository) domain.UserService {
    return &userUsecase{repo: repo}
}
```

```go
// Repository — concrete adapter, translates driver errors to domain errors.
type postgresUserRepo struct{ db *sql.DB }
func NewUserRepository(db *sql.DB) domain.UserRepository { return &postgresUserRepo{db: db} }
```

```go
// Delivery — HTTP framework lives only here; swap freely.
type UserHandler struct{ svc domain.UserService }
func NewUserHandler(svc domain.UserService) *UserHandler { return &UserHandler{svc: svc} }
```

> Read [references/domain.md](references/domain.md), [references/usecase.md](references/usecase.md), [references/repository.md](references/repository.md), and [references/delivery.md](references/delivery.md) for full code examples per layer.

## Wiring in `main.go`

```go
// cmd/api/main.go — the only place that knows the whole system.
db, _ := sql.Open("postgres", cfg.DBURL)
userRepo := repository.NewUserRepository(db)
userSvc  := usecase.NewUserUsecase(userRepo)
userH    := delivery.NewUserHandler(userSvc)
r := gin.New()
r.POST("/api/v1/users", userH.Create)
_ = r.Run(cfg.Addr)
```

This is the only file that imports every internal package. Adding a feature touches each layer plus one DI line here — predictable.

> Read [references/anti-patterns.md](references/anti-patterns.md) for the failure modes — leaking `*gin.Context` into usecases, importing repository from delivery, returning concrete types instead of interfaces.

## Error Flow

```
Repository                Usecase                  Delivery
sql.ErrNoRows         →   domain.ErrNotFound   →   404
unique violation      →   domain.ErrConflict   →   409
validation rule       →   domain.ErrValidation →   422
unknown               →   wrapped error        →   500 (logged)
```

Map domain errors to HTTP status codes in the delivery layer — never in the domain. The mapping changes per transport (HTTP 404 ↔ gRPC NotFound).

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| `*gin.Context` parameter in a usecase | Locks the system into Gin forever | Pass `context.Context` and plain inputs |
| Repository returns `*sql.Rows` | Usecase has to know about `database/sql` | Return domain entities only |
| Concrete `*userUsecase` exported | Direct instantiation bypasses constructor (and the dependency rule) | Return `domain.UserService` from `New...` |
| Delivery imports repository directly | Skips the usecase; logic moves to handlers | Inject `domain.UserService`, not `*postgresUserRepo` |
| Same struct for DTO and Domain entity | Adding HTTP-only fields pollutes the domain | Separate request/response structs in delivery |
| Domain importing `errors.Is(err, gorm.ErrRecordNotFound)` | Couples domain to GORM | Translate driver errors in repository to `domain.ErrXxx` |
| Wiring scattered across init() funcs | Implicit order, hard to debug | All DI in `main.go`, top-to-bottom |

## Verification Checklist

Each item maps to a command you can run; the expected outcome is in parentheses.

- [ ] `go list -deps ./internal/domain | grep -v '^\(internal/\|<modpath>\)' | grep -v '^[a-z]*$'` shows only stdlib paths (domain has no third-party deps)
- [ ] `go list -f '{{.Imports}}' ./internal/usecase/... | tr ' ' '\n' | grep -E '(gin|echo|fiber|chi|database/sql|gorm|pgx)'` is empty (usecase touches no framework/driver)
- [ ] `go list -f '{{.Imports}}' ./internal/delivery/... | tr ' ' '\n' | grep 'internal/repository'` is empty (delivery never imports repository)
- [ ] `grep -rn 'func New[A-Z]' internal/usecase | grep -v 'domain\.\|interface'` is empty (every `NewX` returns a domain interface, not a concrete type)
- [ ] `grep -rln 'internal/repository' cmd/ internal/` lists only `cmd/*/main.go` (main is the only wiring site)
- [ ] `go test ./internal/usecase/... -count=1` passes with no DB available (usecase mocks the repository interface)
- [ ] Swapping HTTP framework: `git mv internal/delivery/http internal/delivery/http_old && go build ./internal/usecase/... ./internal/repository/... ./internal/domain/...` succeeds — only delivery is dirty

## References

- [references/domain.md](references/domain.md) — entities, value objects, interface ownership, sentinel errors
- [references/usecase.md](references/usecase.md) — orchestration patterns, input DTOs, testing
- [references/repository.md](references/repository.md) — concrete adapters, error translation, transactions
- [references/delivery.md](references/delivery.md) — HTTP handlers, framework swap, error → status mapping
- [references/anti-patterns.md](references/anti-patterns.md) — leaks across layer boundaries
