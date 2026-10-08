# Exceptions and Crashes

## Inspect first

- full stack trace
- first exception, not only cascading errors
- object and scene context
- lifecycle state
- recent related changes
- platform crash logs
- native plugin involvement

## Rules

- Trace the first invalid assumption.
- Do not add broad null checks blindly.
- Do not catch and ignore exceptions.
- Confirm whether Unity destroyed-object semantics are involved.
- Check async continuations after destruction.
- Check static state across domain reload.
- For native crashes, inspect plugin and platform logs.

## Validation

- original crash path
- repeated execution
- scene reload
- disable and destruction
- target platform when relevant
