# Build and Platform Bugs

## Inspect first

- target platform
- scripting backend
- API compatibility
- graphics API
- build profile
- symbols
- package platform support
- native plugins
- build log

## Common causes

- Editor-only API in runtime assembly
- platform-specific define mismatch
- AOT or stripping
- unsupported shader
- missing native binary
- case-sensitive path
- permission or sandbox restriction

## Validation

- clean target build
- representative device
- release configuration
- stripping and symbols
- runtime logs
