# Milestone 3 — Consolidated Fixes

This package supersedes the previous Milestone 3 and first hotfix archives.

## Fix 1 — FFmpeg 8 filter table parsing

Ubuntu FFmpeg `8.0.1-3ubuntu2+esm4` emits filter capability rows using two flags:

```text
TS aap               AA->A      Apply Affine Projection algorithm to first audio stream.
.. abench            A->A       Benchmark part of a filtergraph.
.S acrossover        A->N       Split audio into per-bands streams.
T. acrusher          A->A       Reduce audio bit resolution.
```

Older FFmpeg releases may use three flags, for example:

```text
TSC overlay           VV->V      Overlay a video source on top of the input.
... anull             A->A       Pass the source unchanged.
```

`parseFilterTable()` now accepts both layouts using a constrained `T` / `S` / `C` / `.` capability column and continues to reject legend rows such as:

```text
T.. = Timeline support
.S. = Slice threading
```

The previous ANSI stripping and stdout+stderr collection compatibility fixes are retained.

## Fix 2 — Node Buffer generic typing

Current Node typings distinguish `Buffer<ArrayBuffer>` from `Buffer<ArrayBufferLike>`. `Buffer.alloc(0)` can be inferred as the narrower former type, while `subarray()` may return the latter.

`TailCapture.value` is now explicitly declared as:

```ts
private value: Buffer = Buffer.alloc(0);
```

With current `@types/node`, the default `Buffer` backing-store generic is `ArrayBufferLike`, so assignments from captured process chunks and subarrays remain type-safe without an unsafe cast.

## Regression coverage

`test/core/capabilities.test.ts` now contains an FFmpeg 8 regression fixture derived from the exact Ubuntu output that exposed the issue, while retaining coverage for the older three-character layout.

## Validation performed while packaging

- Parsed the provided FFmpeg 8 output shape successfully: 4/4 fixture filters recognized.
- Parsed the packager's FFmpeg 7.1.5 filter table successfully: 555 filters recognized.
- Verified the modified source contains the explicit Buffer annotation.

The full npm build/test suite should still be run after extraction in the target repository because this packaging environment does not contain the project's npm dependency tree.
