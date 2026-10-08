# VFX Specialization

## Use when

Use for Particle System, VFX Graph, trails, impacts, GPU particles, spawned
visual feedback, and effect orchestration.

## Inspect first

- Particle System or VFX Graph
- render pipeline
- effect pooling
- spawn ownership
- network visibility
- target platform
- effect lifetime
- event and property bindings

## Implementation rules

- Keep gameplay authority separate from effects.
- Pool frequently spawned effects when justified.
- Avoid unbounded particles.
- Reset pooled effect state.
- Do not synchronize visual-only state unnecessarily.
- Consider transparent overdraw.
- Use project naming and property conventions.
- Keep effect lifetime and cleanup explicit.
- Avoid expensive readbacks.

## Validation

- correct trigger
- repeated spawning
- pooled reuse
- cleanup
- scene unload
- target platform
- visual inspection
- particle count and performance when relevant
