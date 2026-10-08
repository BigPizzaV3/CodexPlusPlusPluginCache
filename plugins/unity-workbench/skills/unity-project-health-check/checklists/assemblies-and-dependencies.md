# Assemblies and Dependencies Checklist

Inspect:

- `.asmdef` and `.asmref`
- runtime versus editor separation
- test assemblies
- platform restrictions
- unnecessary broad references
- circular references
- monolithic assemblies
- unsafe code
- auto-reference configuration
- third-party dependency direction
- namespaces and folder ownership

Report conceptual dependency problems even when Unity prevents literal assembly
cycles.
