# Validation Strategy

Progress from cheapest to strongest evidence:

1. Static inspection
2. Search for broken usages
3. Compilation
4. EditMode tests
5. PlayMode tests
6. Scene or prefab inspection
7. Runtime reproduction
8. Platform or device validation

## Minimum expectations

### Plain C# logic

- compilation
- EditMode tests

### MonoBehaviour integration

- compilation
- lifecycle validation
- PlayMode test or runtime check when practical

### Serialized component or prefab

- compilation
- reference inspection
- missing-reference validation
- runtime check when practical

### Input

- compilation
- action-map inspection
- subscription lifecycle
- representative input test

### Multiplayer

- compilation
- authority review
- framework-specific test
- two peers for strong completion evidence

### Save systems

- new save
- save and reload
- missing-field behavior
- old save migration when formats changed

### UI

- compilation
- binding inspection
- interaction
- navigation
- localization

### Shader or VFX

- compilation
- pipeline compatibility
- Console inspection
- visual validation

## Reporting

State exactly:

- what was compiled
- what tests ran
- what runtime scenario was exercised
- what could not be verified
