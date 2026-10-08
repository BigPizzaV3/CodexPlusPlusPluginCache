# Lifecycle and Initialization Checklist

Inspect:

- initialization order
- `Awake`, `OnEnable`, and `Start`
- duplicate initialization
- balanced subscriptions
- cleanup
- pooled object reset
- domain reload behavior
- static state reset
- scene transition lifetime
- async work after destruction
- script execution order dependencies
- disabled-object behavior
- application pause and quit

Prioritize issues that can produce intermittent or scene-dependent failures.
