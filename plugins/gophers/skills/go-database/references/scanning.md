# Scanning and NULL Handling

Mapping rows to Go structs is where most data-corruption bugs live. The patterns differ slightly across `database/sql`, `sqlx`, and `pgx`, but the principles are the same.

## database/sql

```go
var u User
err := db.QueryRowContext(ctx,
    "SELECT id, email, bio FROM users WHERE id = $1", id,
).Scan(&u.ID, &u.Email, &u.Bio)
```

The order of `Scan` arguments must match the order of `SELECT` columns. Renaming or reordering the SQL silently breaks the mapping — the compiler cannot help.

For multi-row, allocate the slice and loop:

```go
rows, err := db.QueryContext(ctx, "SELECT id, email FROM users")
if err != nil { return err }
defer rows.Close()

var out []User
for rows.Next() {
    var u User
    if err := rows.Scan(&u.ID, &u.Email); err != nil { return err }
    out = append(out, u)
}
return rows.Err()
```

## sqlx

Use `db` struct tags; sqlx maps SELECT columns to fields by tag:

```go
type User struct {
    ID    string  `db:"id"`
    Email string  `db:"email"`
    Bio   *string `db:"bio"`     // nullable → pointer
}

var u User
err := db.GetContext(ctx, &u,
    "SELECT id, email, bio FROM users WHERE id = $1", id)

var users []User
err := db.SelectContext(ctx, &users,
    "SELECT id, email, bio FROM users WHERE active = true")
```

`Get` expects exactly one row (returns `sql.ErrNoRows` for none, error for many). `Select` expects zero or more.

### Named parameters with structs

```go
type filter struct {
    Since   time.Time `db:"since"`
    MinAge  int       `db:"min_age"`
}

rows, err := db.NamedQueryContext(ctx,
    "SELECT id FROM users WHERE created_at > :since AND age >= :min_age",
    filter{Since: t, MinAge: 18})
```

## pgx (native)

```go
rows, _ := pool.Query(ctx,
    "SELECT id, email, bio FROM users WHERE active = $1", true)

users, err := pgx.CollectRows(rows, pgx.RowToStructByName[User])
```

`RowToStructByName` matches columns to struct fields by name (case-insensitive). For single-row:

```go
row := pool.QueryRow(ctx,
    "SELECT id, email FROM users WHERE id = $1", id)
u, err := pgx.RowTo[User](row) // tag-based mapping
```

pgx supports tag `db:"..."` like sqlx; configure with `pgx.RowToStructByNameLax` for partial column sets.

## NULL Columns

Three options, pick consistently.

### Option 1: pointer fields

```go
type User struct {
    Bio *string `db:"bio"`
}
```

Pros: cleanly distinguishes "no value" (`nil`) from "empty string" (`""`); works with `encoding/json` (omits when `nil` + `omitempty`).

Cons: extra heap allocation per value.

### Option 2: sql.Null* wrappers

```go
type User struct {
    Bio sql.NullString `db:"bio"`
}

if u.Bio.Valid {
    fmt.Println(u.Bio.String)
}
```

Pros: explicit at every access; no nil panics.

Cons: awful JSON shape (`{"String":"...","Valid":true}`); needs custom marshaling.

### Option 3: zero-value with NOT NULL DEFAULT in schema

Make the column NOT NULL with a sensible default ("" or 0). Scan into plain types.

Pros: simplest Go code.

Cons: cannot distinguish "user did not provide" from "user provided empty".

**Recommendation.** Pointer fields for JSON-serialized API responses. `sql.Null*` for internal repository structs that never marshal to JSON. NOT NULL DEFAULT for columns where "empty" really is a meaningful value.

## time.Time

Postgres `timestamp with time zone` → `time.Time` works out of the box. For `timestamp without time zone`, the driver returns the time as UTC by default but the semantic is location-dependent; prefer `timestamp with time zone` everywhere.

For optional timestamps, `*time.Time` or `sql.NullTime`.

## JSON / JSONB Columns

```go
type Settings struct {
    Theme string `json:"theme"`
    Lang  string `json:"lang"`
}

type User struct {
    ID       string   `db:"id"`
    Settings Settings `db:"settings"`
}

// Implement Scanner/Valuer
func (s *Settings) Scan(src any) error {
    switch v := src.(type) {
    case []byte:
        return json.Unmarshal(v, s)
    case string:
        return json.Unmarshal([]byte(v), s)
    case nil:
        *s = Settings{}
        return nil
    default:
        return fmt.Errorf("scan settings: unsupported type %T", src)
    }
}

func (s Settings) Value() (driver.Value, error) {
    return json.Marshal(s)
}
```

For pgx, the helper `pgtype` provides ready-made JSON codecs.

## Arrays (Postgres)

```go
import "github.com/lib/pq"

var tags []string
err := db.QueryRowContext(ctx,
    "SELECT tags FROM posts WHERE id = $1", id,
).Scan(pq.Array(&tags))
```

pgx handles arrays natively without wrappers.

## UUIDs

```go
import "github.com/google/uuid"

type User struct {
    ID uuid.UUID `db:"id"`
}
```

`uuid.UUID` implements `Scanner` and `Valuer`. Works directly with database/sql, sqlx, and pgx.

## Common Mistakes

| Mistake | Effect |
|---|---|
| Scanning into a plain `string` for a NULL column | Runtime error: "converting NULL to string is unsupported" |
| Mismatched column order in `Scan` | Silently wrong data |
| Wide `SELECT *` mapped to a struct | Adding a column breaks scanning |
| `Get` for queries that may return many rows | Picks the first; loses data silently |
| Forgetting Scanner/Valuer on a custom type | Driver returns `[]byte` you must hand-parse |
