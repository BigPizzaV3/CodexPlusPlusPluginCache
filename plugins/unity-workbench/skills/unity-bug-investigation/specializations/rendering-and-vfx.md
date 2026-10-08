# Rendering and VFX Bugs

## Inspect first

- render pipeline
- shader compile output
- material properties
- renderer features
- camera setup
- VFX event and property bindings
- target graphics API
- platform support

## Common causes

- pipeline-incompatible shader
- missing renderer feature
- material property mismatch
- wrong camera or layer
- variant stripping
- shared material mutation
- effect not reset after pooling
- unsupported platform feature

## Validation

- representative scene
- Console shader warnings
- multiple cameras
- target platform
- pooled reuse
- visual comparison
