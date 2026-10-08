# Consumer-Owned Interfaces

Go's "accept interfaces, return concrete types" rule has a deeper claim behind it: **the interface should live in the package that calls the methods**, not the package that implements them. This reference explains why, and how to migrate code that gets it wrong.

## Why the consumer owns it

Suppose `email` defines a `Sender` interface and returns it from its constructor. Now every package that wants to send mail has to import `email` just to use the `Sender` type — even if all they need is the contract. Worse, anyone writing a fake mailer has to depend on `email` too. The "abstraction" has produced more coupling than no abstraction at all.

When the consumer defines the interface:

- The producer (`email`) exports only a concrete `*Client`.
- The consumer (`notify`) defines `notify.Sender` — the **minimum** subset of `*Client` it actually calls.
- Tests in `notify` implement `notify.Sender` directly. No `email` import required.
- A second backend (e.g., `sms`) satisfies `notify.Sender` without either backend knowing about the other.

The interface tracks what is *used*, not what is *available*.

## A worked example

```go
// package email — concrete, no interfaces
package email

type Client struct{ /* ... */ }
func New(cfg Config) *Client { /* ... */ }
func (c *Client) Send(ctx context.Context, to, body string) error { /* ... */ }
func (c *Client) SendBatch(ctx context.Context, msgs []Message) error { /* ... */ }
func (c *Client) Verify(ctx context.Context, addr string) error { /* ... */ }
```

```go
// package notify — consumer defines what it needs
package notify

type Sender interface {
    Send(ctx context.Context, to, body string) error
}

type Service struct{ s Sender }
func NewService(s Sender) *Service { return &Service{s: s} }
```

`notify` doesn't care about `SendBatch` or `Verify`. The interface is one method.

## Migration: producer-defined to consumer-defined

1. **Audit callers.** For each method on the producer's interface, find who calls it. Group callers by which subset they actually use.
2. **Define a small interface per consumer.** Most consumers use 1–2 methods; the new interface lives in their package.
3. **Delete the producer's interface.** Constructor returns the concrete type now.
4. **Update callers.** Replace the imported interface name with the local one. Compilation will tell you whether anything is missing.
5. **Run tests.** Fakes that lived in the producer's package move to the consumer's `_test.go` files.

The compiler enforces correctness throughout — if a consumer was relying on a method it never mentioned, the build fails.

## When the producer *should* expose an interface

Two narrow cases:

- **Implementation hidden behind a constructor.** A constructor like `hash.New(hash.SHA256)` returns `hash.Hash` because the algorithm is selectable. The interface is the API; concrete types are deliberately unexported.
- **Plugin / SPI boundary.** A framework that loads third-party implementations (`http.Handler`, `database/sql/driver.Driver`) publishes the interface as part of its contract.

Even here, keep the surface small. `http.Handler` has one method.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| `type Storer interface { /* mirrors every method on *Store */ }` in the producer package | Delete; let consumers define what they need |
| One huge `Service` interface used by every test | Split per consumer; each gets a focused fake |
| Importing `email` only for `email.Sender` | Define `Sender` locally |
| Re-exporting the producer's interface from `pkg/internal/abc` so "the import path is shorter" | The cost is the dependency, not the path length |

## A useful heuristic

If two different consumers, looking at the producer's interface, would each circle a *different* subset of methods as "the ones I actually use", then there should not be a producer-defined interface at all.
