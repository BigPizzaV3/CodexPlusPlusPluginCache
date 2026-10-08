# Bug Fix Validation Strategy

## Required validation

1. Re-run the original reproduction.
2. Confirm the failure no longer occurs.
3. Run regression coverage.
4. Check nearby behavior.
5. Check Console output.
6. Review the diff.
7. Remove temporary diagnostics.

## By defect type

### Exception

- original stack path
- repeated execution
- lifecycle cleanup

### Gameplay

- expected path
- blocked path
- repeated use
- reset and reload

### Multiplayer

- server or host
- owner
- observer
- late join or disconnect when relevant

### Save

- failing representative data
- new data
- migration
- save and reload

### Rendering

- visual comparison
- shader warnings
- target pipeline
- target platform

### Performance

- equivalent before and after captures
- target hardware
- same scene and conditions

## Reporting language

Use:

- “Confirmed root cause.”
- “Likely cause; full reproduction was unavailable.”
- “Original reproduction passed 20 consecutive runs.”
- “Static validation only.”
- “Two-peer multiplayer validation completed.”

Avoid:

- “Seems fixed.”
- “Should be fine.”
- “Probably Unity.”
