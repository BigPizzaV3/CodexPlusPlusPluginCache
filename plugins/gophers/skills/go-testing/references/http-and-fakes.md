# HTTP Tests, Fakes, and Time

Most tests in a service touch HTTP at the edges and external dependencies at the bottom. This reference covers `httptest` patterns, consumer-owned fakes, and how to stub time without breaking other tests.

## httptest.Server

For testing a handler end-to-end, spin up an `httptest.Server`. It uses a real listener on a random port, so the test exercises the full `net/http` stack:

```go
func TestHandler_GetUser(t *testing.T) {
    srv := httptest.NewServer(handler)
    t.Cleanup(srv.Close)

    resp, err := http.Get(srv.URL + "/users/42")
    if err != nil { t.Fatalf("get: %v", err) }
    t.Cleanup(func() { _ = resp.Body.Close() })

    if resp.StatusCode != http.StatusOK {
        body, _ := io.ReadAll(resp.Body)
        t.Errorf("status = %d, body = %s; want 200", resp.StatusCode, body)
    }
}
```

`t.Cleanup` closes the server and the response body in LIFO order. `srv.URL` includes scheme and host, so reuse a real `http.Client` rather than building requests by hand.

## httptest.NewRecorder

When the handler is small and you do not need a real listener, `httptest.NewRecorder` is faster:

```go
func TestHandler_BadRequest(t *testing.T) {
    rec := httptest.NewRecorder()
    req := httptest.NewRequest(http.MethodPost, "/users", strings.NewReader(`{`))
    handler.ServeHTTP(rec, req)

    res := rec.Result()
    t.Cleanup(func() { _ = res.Body.Close() })

    if res.StatusCode != http.StatusBadRequest {
        t.Errorf("status = %d, want %d", res.StatusCode, http.StatusBadRequest)
    }
}
```

Use the recorder for unit tests of a single handler. Reserve `NewServer` for tests that involve middleware, routing, or a real HTTP client.

## Table-driven HTTP cases

```go
tests := []struct {
    name       string
    method     string
    body       string
    wantStatus int
    wantField  string
}{
    {"created",      "POST", `{"name":"a"}`, 201, "id"},
    {"missing-name", "POST", `{}`,           400, "error"},
    {"empty-body",   "POST", ``,             400, "error"},
}
for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
        t.Parallel()
        rec := httptest.NewRecorder()
        req := httptest.NewRequest(tt.method, "/users", strings.NewReader(tt.body))
        handler.ServeHTTP(rec, req)

        if rec.Code != tt.wantStatus {
            t.Errorf("%s %s: status = %d, want %d", tt.method, "/users", rec.Code, tt.wantStatus)
        }
        var body map[string]any
        if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
            t.Fatalf("decode: %v", err)
        }
        if _, ok := body[tt.wantField]; !ok {
            t.Errorf("response missing field %q: %v", tt.wantField, body)
        }
    })
}
```

## Consumer-owned fakes

Mock the **interface the consumer needs**, not the concrete type the producer exports. Define the interface in the consumer's package; the test provides a fake.

```go
// In the consumer package:
type UserStore interface {
    FindByID(ctx context.Context, id string) (*User, error)
}

// In the consumer's _test.go:
type fakeStore struct{ users map[string]*User }
func (f *fakeStore) FindByID(_ context.Context, id string) (*User, error) {
    u, ok := f.users[id]
    if !ok { return nil, ErrNotFound }
    return u, nil
}
```

Hand-written fakes beat generated mocks for almost every case: they are typed, they fail with useful errors, and they do not pull in a mocking framework. Save mock generators for cases where the interface is large and the test cares about call-count and call-order — and then prefer `gomock` or `mockery` with `testifylint` enabled.

## Recording calls

For fakes that need to verify *how* they were called, capture calls into a slice:

```go
type fakeMailer struct {
    mu   sync.Mutex
    sent []Mail
}
func (f *fakeMailer) Send(ctx context.Context, to, body string) error {
    f.mu.Lock(); defer f.mu.Unlock()
    f.sent = append(f.sent, Mail{To: to, Body: body})
    return nil
}
```

Then assert on `f.sent` at the end of the test. The mutex matters if the system under test is concurrent.

## Stubbing time

A common testing pain point is "code that calls `time.Now()` directly is hard to test". Two solutions:

### 1. Inject a clock

Define a small interface in the consumer:

```go
type Clock interface{ Now() time.Time }
type realClock struct{}
func (realClock) Now() time.Time { return time.Now() }

type fakeClock struct{ t time.Time }
func (c *fakeClock) Now() time.Time { return c.t }
```

Pass `Clock` into constructors; tests pass `&fakeClock{t: ...}`. Use this when the code reads the wall clock to *make decisions* (TTLs, scheduling).

### 2. Use testing/synctest

For code that uses `time.Sleep`, `time.After`, `time.Ticker`, `context.WithTimeout`, run the test under `testing/synctest` (Go 1.25+). Synthetic time advances only when all goroutines are blocked, so timer ordering is deterministic. See [fuzz-synctest-bench.md](fuzz-synctest-bench.md).

Do not combine both for the same field — pick one model per test.

## File system

`t.TempDir()` returns a directory that is removed when the test (and its subtests) finish. Use it instead of `ioutil.TempDir` or `os.MkdirTemp` with manual cleanup.

```go
dir := t.TempDir()
path := filepath.Join(dir, "config.json")
_ = os.WriteFile(path, data, 0o600)
```

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Asserting on a hand-built JSON string | Decode the response, `cmp.Diff` against a struct |
| Forgetting to close the response body | `t.Cleanup(func() { _ = resp.Body.Close() })` |
| Mocking the producer's concrete type with a wrapper interface | Define the interface in the consumer; pass a fake directly |
| Using a global clock that tests must remember to reset | Inject a `Clock` or use `synctest.Test` |
| Spinning up a real HTTP server for every test in a parallel suite | Use `httptest.NewRecorder` when middleware is not involved |
