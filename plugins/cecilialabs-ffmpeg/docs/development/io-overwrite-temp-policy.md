# Input/Output, Overwrite & Temporary-File Policy

## 1. Output safety

The default behavior is **never overwrite an existing output silently**.

- Default FFmpeg behavior maps to no-overwrite semantics.
- `--overwrite` is required for replacement.
- An input path may not equal an output path unless an operation explicitly supports safe in-place mode in a later milestone.
- v1.0 does not require destructive in-place editing.

## 2. Derived output names

When `--output` is omitted, a command may derive a deterministic destination only when the result is unambiguous.

Examples:

```text
video trim-start input.mp4 → input.trim-start.mp4
video speed input.mp4 --factor 2 → input.speed-2x.mp4
convert file input.mp4 --to webm → input.webm
```

If the derived output would collide with the input or another artifact, fail rather than silently replace it.

## 3. Atomic finalization

File-producing transformations should write to a temporary sibling file when feasible, then rename it to the requested final output only after FFmpeg succeeds and post-validation passes.

Temporary file pattern:

```text
.<basename>.cecilia-ffmpeg.<request-id>.tmp.<extension>
```

The real extension remains last so FFmpeg can infer an output format when format is not explicitly passed.

## 4. Temporary lifecycle

1. Create/intermediate paths lazily.
2. Keep temporary files in the target directory when atomic rename is required.
3. Use OS temp storage for non-final intermediates that do not need same-filesystem rename.
4. Register every temporary artifact with a cleanup manager.
5. Delete registered artifacts on success.
6. Delete registered artifacts on expected failure/cancellation.
7. Preserve them only with `--keep-temp` or when cleanup itself fails.
8. Never delete a user-provided input.

## 5. Streaming exception

Streaming/capture operations do not use atomic file finalization unless their destination is a file. Network outputs are treated as sinks.

## 6. Permissions

Filesystem permission errors are surfaced as `E_IO_PERMISSION_DENIED` and exit `6`. The toolkit does not attempt privilege escalation for media output.
