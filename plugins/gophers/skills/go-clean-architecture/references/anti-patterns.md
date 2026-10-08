# Clean Architecture Anti-Patterns

The architecture works only as long as the dependency rule holds. These are the ways it gets broken in practice.

## 1. `*gin.Context` in a Usecase Signature

```go
// Bad
func (u *userUsecase) Create(c *gin.Context, in domain.CreateUserInput) (*domain.User, error) { ... }
```

Now the usecase imports `gin`. Switching frameworks means rewriting every usecase. Worse, the usecase can read query params, write responses, redirect — none of which are business logic.

```go
// Good — pass plain context.
func (u *userUsecase) Create(ctx context.Context, in domain.CreateUserInput) (*domain.User, error) { ... }
```

## 2. Repository Returns Driver Types

```go
// Bad — usecase imports database/sql to handle the rows.
func (r *postgresUserRepo) List(ctx context.Context) (*sql.Rows, error) { ... }
```

The usecase must now iterate, scan, and close — duplicating SQL semantics. The repository's job is to hide the driver.

```go
// Good — return domain entities.
func (r *postgresUserRepo) List(ctx context.Context) ([]*domain.User, error) { ... }
```

## 3. Exported Concrete Usecase

```go
// Bad — caller can construct without going through the constructor.
type UserUsecase struct { repo domain.UserRepository }
func NewUserUsecase(repo domain.UserRepository) *UserUsecase { return &UserUsecase{repo: repo} }
```

Direct struct instantiation bypasses the seam. Delivery code starts depending on `*UserUsecase` instead of `domain.UserService`, which means the next refactor breaks the import graph everywhere.

```go
// Good — unexported struct, interface return.
type userUsecase struct { repo domain.UserRepository }
func NewUserUsecase(repo domain.UserRepository) domain.UserService { return &userUsecase{repo: repo} }
```

## 4. Delivery Imports Repository Directly

```go
// Bad — handler talks to the DB.
type UserHandler struct{ repo *postgresUserRepo }
```

The usecase has been skipped. Business rules now live in the handler. Two transports (HTTP + gRPC) duplicate the rules.

```go
// Good — depend on the service interface.
type UserHandler struct{ svc domain.UserService }
```

## 5. Domain Entity Used as JSON Response

```go
// Bad
type User struct {
    ID    string `json:"id"`
    Email string `json:"email"`
    Pwd   string `json:"-"` // ← password leaks if tag forgotten
}
```

JSON tags in the domain mean the wire format is dictated by domain field names. Renaming `Pwd` to `PasswordHash` becomes a breaking API change. Worse, a new sensitive field added without `json:"-"` leaks immediately.

```go
// Good — separate response DTO in delivery.
type userResponse struct {
    ID    string `json:"id"`
    Email string `json:"email"`
}
func toUserResponse(u *domain.User) userResponse { return userResponse{ID: u.ID, Email: u.Email} }
```

## 6. Domain Importing GORM (or any ORM) Error Types

```go
// Bad
import "gorm.io/gorm"

func (u *userUsecase) Get(ctx context.Context, id string) (*domain.User, error) {
    user, err := u.repo.Get(ctx, id)
    if errors.Is(err, gorm.ErrRecordNotFound) {  // ← domain coupling to GORM
        return nil, domain.ErrNotFound
    }
    return user, err
}
```

The usecase now requires GORM to compile. Mapping from driver errors to domain errors belongs **inside the repository**, not in the usecase.

```go
// Good — repository translates.
func (r *gormUserRepo) Get(ctx context.Context, id string) (*domain.User, error) {
    var u domain.User
    if err := r.db.WithContext(ctx).First(&u, "id = ?", id).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, domain.ErrNotFound
        }
        return nil, fmt.Errorf("get user %s: %w", id, err)
    }
    return &u, nil
}
```

## 7. Scattered Wiring via `init()`

```go
// Bad — every package has its own init().
func init() {
    db = sql.Open(...)
    repo := repository.NewUserRepo(db)
    svc = usecase.NewUserUsecase(repo)
}
```

Order is implicit (Go runs `init()` in package import order). Adding a new dependency surprises a developer at runtime when initialization fails halfway. Tests can't substitute components.

```go
// Good — all wiring in main.go, top to bottom.
func main() {
    cfg := config.Load()
    db := mustOpen(cfg.DBURL)
    userRepo := repository.NewUserRepository(db)
    userSvc  := usecase.NewUserUsecase(userRepo)
    userH    := delivery.NewUserHandler(userSvc)
    runServer(cfg, userH)
}
```

## 8. Anemic Domain Used Only as DB Row

```go
// Bad
package domain
type User struct {
    ID    string `db:"id" json:"id"`
    Email string `db:"email" json:"email"`
}
```

The domain entity is now a struct with `db` tags (from sqlx) and `json` tags (from the API). It's a DB row, not a domain object. Add an HTTP-only field (`AvatarURL: r.AvatarURL`) and you pollute the storage schema.

Separate the three concerns: domain entity, DB row (in repository), API DTO (in delivery).

## 9. Usecase Reading Request Headers

```go
// Bad
func (u *orderUsecase) Place(c *gin.Context, in domain.PlaceOrderInput) (*domain.Order, error) {
    tenant := c.GetHeader("X-Tenant-ID")
    ...
}
```

Authentication and tenant resolution belong in middleware (delivery). The usecase reads `domain.CurrentUser(ctx)`:

```go
// Good
func (u *orderUsecase) Place(ctx context.Context, in domain.PlaceOrderInput) (*domain.Order, error) {
    user, ok := domain.CurrentUser(ctx)
    if !ok { return nil, domain.ErrForbidden }
    ...
}
```

## 10. Tests Spinning Up the Full Stack

```go
// Bad — usecase test boots a real Postgres in a container.
func TestPlaceOrder(t *testing.T) {
    pg := testcontainers.StartPostgres(t)
    ...
}
```

The whole point of the layered architecture is that usecase tests run *without* a database. Use an in-memory repository.

Integration tests are valuable too — but they belong in `tests/integration/`, not in `internal/usecase/*_test.go`. Don't make every unit test pay for Docker startup.
