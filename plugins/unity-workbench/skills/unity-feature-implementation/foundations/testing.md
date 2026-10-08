# Unity Testing

Use the project's existing testing style and infrastructure.

## Test levels

### Static validation

- inspect changed code
- search usages
- verify namespaces and assemblies
- inspect serialized compatibility

### Compilation

Use the strongest available method:

- Unity Editor compilation
- CI compilation
- generated solution compilation
- assembly-specific compilation

### EditMode tests

Prefer for:

- plain C# rules
- calculations
- state transitions
- cooldowns
- validation
- save transformations
- deterministic logic

### PlayMode tests

Prefer for:

- MonoBehaviour lifecycle
- scenes and prefabs
- physics
- coroutines
- runtime UI
- engine-specific integration

### Environment tests

Use when relevant:

- multiplayer peers
- devices
- XR hardware
- target-platform builds
- profiler captures
- visual validation
- save migration

## Test behavior, not implementation details

Good tests verify observable outcomes.

Avoid tests that only inspect private fields or duplicate implementation logic.

## Useful cases

Consider:

- expected path
- boundaries
- missing configuration
- repeated activation
- disabled state
- cleanup
- scene reload
- pooled reuse
- ownership and authority
- old save data
- pause and time scale

## Baseline handling

Before validation, record existing errors and failing tests when practical.

Do not attribute pre-existing failures to the new feature.

## Reporting

Use exact statements:

- “Unity Editor compiled without new errors.”
- “12 EditMode tests passed.”
- “Validated the interaction in Play Mode.”
- “Static review only; Unity Editor was unavailable.”

Do not claim production readiness without evidence.
