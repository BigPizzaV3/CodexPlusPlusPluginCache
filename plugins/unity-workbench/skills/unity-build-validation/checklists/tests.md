# Tests Checklist

## Inspect

- Unity Test Framework
- EditMode suites
- PlayMode suites
- integration tests
- framework tests
- CI test commands
- test result output
- flaky or ignored tests

## Execution order

1. targeted changed-area tests
2. related assembly tests
3. broader EditMode suite
4. relevant PlayMode suite
5. full suite when required

## Record

- filter
- passed
- failed
- skipped
- duration
- artifact path
- introduced versus pre-existing failure

Do not disable tests to obtain a passing result.
