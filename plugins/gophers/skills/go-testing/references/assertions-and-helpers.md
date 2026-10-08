# Useful Failures, cmp.Diff, and Helpers

The standard library plus `github.com/google/go-cmp` covers nearly every assertion shape you need. The point of this reference is not "what to type" but "what makes a failure useful."

## The shape of a useful failure

A good failure message answers four questions without the reader opening the test file:

1. Which function failed?
2. What were the inputs?
3. What did we get?
4. What did we want?

```
TestParseHeader/missing-bearer: ParseHeader("Token abc") = (nil, "missing scheme"), want (*Header, nil)
```

In code:

```go
got, err := ParseHeader(in)
if err != nil || !reflect.DeepEqual(got, want) {
    t.Errorf("ParseHeader(%q) = (%+v, %v), want (%+v, nil)", in, got, err, want)
}
```

Print `got` before `want`. The convention is universal in the Go standard library and tooling; reversing it confuses everyone.

## cmp.Diff

For structs, slices, maps, and protobufs, `reflect.DeepEqual` produces unreadable diffs. Use `go-cmp`:

```go
import "github.com/google/go-cmp/cmp"

if diff := cmp.Diff(want, got); diff != "" {
    t.Errorf("ParseHeader(%q) mismatch (-want +got):\n%s", in, diff)
}
```

Always pass `want` first; the diff direction `(-want +got)` is part of the convention. Echo it in the message so readers know which side is which.

### Options

| Option | Use |
|---|---|
| `cmpopts.IgnoreFields(T{}, "CreatedAt")` | Skip timestamps and other ambient fields |
| `cmpopts.SortSlices(less)` | When order is not meaningful |
| `cmpopts.EquateApproxTime(d)` | Time fields with tolerance |
| `protocmp.Transform()` | Comparing `proto.Message` values |
| `cmp.AllowUnexported(T{})` | Compare unexported fields (use sparingly) |

Reach for `AllowUnexported` only when there is no public observation of the field. If the field has a public getter, compare the getter's result.

## Helpers: t.Helper and t.Cleanup

A helper that calls `t.Errorf` or `t.Fatalf` must have `t.Helper()` as its first line. Without it, the failure points inside the helper, not the test that called it.

```go
func assertJSONEqual(t *testing.T, want any, gotJSON []byte) {
    t.Helper()
    var got any
    if err := json.Unmarshal(gotJSON, &got); err != nil {
        t.Fatalf("unmarshal: %v", err)
    }
    if diff := cmp.Diff(want, got); diff != "" {
        t.Errorf("JSON mismatch (-want +got):\n%s", diff)
    }
}
```

`t.Cleanup` registers teardown that runs after the test (and after every subtest). Prefer it over `defer` in helpers — it survives `t.Fatal` and works inside `t.Run` subtests.

```go
func tempDir(t *testing.T) string {
    t.Helper()
    dir := t.TempDir()                  // already cleaned up by testing
    t.Cleanup(func() { /* extra */ })
    return dir
}
```

`t.TempDir()` and `t.Setenv()` come with cleanup built in — use them by default.

## Custom assertion helpers

A handful of project-specific helpers can drastically reduce noise:

```go
func mustParse(t *testing.T, s string) time.Time {
    t.Helper()
    v, err := time.Parse(time.RFC3339, s)
    if err != nil { t.Fatalf("parse %q: %v", s, err) }
    return v
}
```

Two rules:

- **Helpers return values; they do not assert deep behaviour.** A helper that wraps three assertions hides which one failed.
- **No magic.** A helper that takes a `*testing.T` and runs the test inside it is a framework. Avoid.

## testify (when adopted)

`testify` is acceptable if used consistently. Two libraries within it: `assert` (continues on failure) and `require` (`t.Fatal` on failure). Lint with `testifylint` to catch the common pitfalls.

```go
import "github.com/stretchr/testify/require"

require.NoError(t, err)
require.Equal(t, want, got)
```

`testifylint` flags `assert.Equal(t, got, want)` (wrong order — `want` comes first in testify). The compatibility cost is real: if half the codebase uses `testify` and half uses the stdlib pattern, every reader has to context-switch. Pick one per repository.

## Snapshot tests

Snapshot ("golden") tests compare current output to a checked-in file. They are fine for **structured** output you can re-decode (JSON, YAML) but dangerous for serialised text where whitespace, key order, and timestamps cause noisy diffs.

```go
golden := filepath.Join("testdata", "golden", t.Name()+".json")
if *update { _ = os.WriteFile(golden, got, 0o644) }
want, _ := os.ReadFile(golden)

var wantV, gotV any
_ = json.Unmarshal(want, &wantV)
_ = json.Unmarshal(got, &gotV)
if diff := cmp.Diff(wantV, gotV); diff != "" { t.Errorf("golden mismatch:\n%s", diff) }
```

Decode before comparing; do not diff serialised strings.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| `t.Errorf("expected %v, got %v", want, got)` | `got` before `want` |
| `cmp.Diff(got, want)` with `(-want +got)` in the message | Match argument order to the message direction |
| Helpers without `t.Helper()` | Add it as the first line |
| Mixing testify and stdlib assertions in the same package | Pick one |
| Snapshot tests over raw JSON strings | Decode first, then `cmp.Diff` |
