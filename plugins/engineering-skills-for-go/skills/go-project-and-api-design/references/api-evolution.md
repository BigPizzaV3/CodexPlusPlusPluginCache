# API evolution

## Constructor questions

Before adding a constructor, ask whether validation, defaults, resource acquisition, hidden state, or future compatibility requires it. A plain struct literal can be the clearer API for passive data.

## Dependency questions

An interface earns its place when a consumer needs multiple implementations, isolation from an effect, or a stable external contract. It does not earn its place merely because a type is injected.

## Migration questions

List old writer/new reader, new writer/old reader, rollback, partial backfill, and replay behavior. Version data at the boundary that needs evolution rather than scattering version switches through domain code.
