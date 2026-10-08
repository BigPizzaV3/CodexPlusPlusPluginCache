# Language decision record

## Aliasing

Passing a slice or map by value does not copy its backing data. Record whether the callee may retain or mutate it. Copy only where ownership changes or untrusted mutation matters; unconditional copies can be costly and misleading.

## API compatibility

Exported names, method sets, type identity, error identities, nil behavior, JSON shape, and generic constraints can all be compatibility surfaces. A source-compatible change can still change runtime semantics.

## Generics

Prefer a concrete implementation when types carry different business meaning. Use a type parameter when the algorithm and invariants remain identical. Constraints should express operations the implementation needs, not enumerate incidental current types.

## Errors

Ask what the caller must decide: retry, correct input, detect absence, preserve an invariant, or only report failure. Expose no more identity than that decision needs.
