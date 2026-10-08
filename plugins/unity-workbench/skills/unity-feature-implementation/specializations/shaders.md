# Shaders Specialization

## Use when

Use for ShaderLab, Shader Graph, materials, render features, custom passes,
post-processing, lighting behavior, and GPU visual logic.

## Inspect first

- active render pipeline
- target platforms
- shader model requirements
- material usage
- renderer features
- shader variants
- existing style and conventions
- performance constraints

## Implementation rules

- Match the active pipeline.
- Avoid unsupported APIs for target platforms.
- Preserve material property names where assets depend on them.
- Use consistent shader property naming.
- Avoid unnecessary variants.
- Consider SRP Batcher compatibility.
- Do not create material instances per frame.
- Cache shader property IDs in hot paths.
- Separate authoring controls from runtime-only values.

## Validation

- shader compilation
- representative materials
- target pipeline
- Console warnings
- visual inspection
- platform restrictions
- performance when relevant
