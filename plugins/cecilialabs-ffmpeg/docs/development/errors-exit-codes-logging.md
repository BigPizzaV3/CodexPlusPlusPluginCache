# Error Taxonomy, Exit Codes & Logging

## 1. Error model

All expected failures are normalized to a `ToolkitError` shape.

```ts
interface ToolkitError {
  code: ErrorCode;
  message: string;
  category: ErrorCategory;
  retryable: boolean;
  details?: Record<string, unknown>;
  cause?: unknown;
}
```

## 2. Error categories

| Namespace | Category | Examples |
|---|---|---|
| `E_USAGE_*` | CLI usage/validation | missing flag, invalid duration |
| `E_CONFIG_*` | configuration | invalid config, conflicting options |
| `E_ENV_*` | runtime environment | FFmpeg missing, unsupported version |
| `E_CAPABILITY_*` | binary capabilities | missing encoder/filter/hwaccel |
| `E_INPUT_*` | input/file | missing file, unreadable path |
| `E_PROBE_*` | FFprobe/media inspection | malformed probe output, no streams |
| `E_MEDIA_*` | semantic media validation | incompatible streams, invalid format assumption |
| `E_OPERATION_*` | domain operation | impossible trim range, transition too long |
| `E_FFMPEG_*` | FFmpeg execution | non-zero exit, filter failure |
| `E_IO_*` | filesystem/output | output exists, permission denied |
| `E_BATCH_*` | batch orchestration | partial failure, empty selection |
| `E_INTERNAL_*` | invariant/internal | unexpected implementation failure |
| `E_ABORTED` | cancellation | SIGINT/user cancellation |

## 3. Exit codes

| Exit | Meaning |
|---:|---|
| `0` | Success |
| `1` | Unexpected/internal failure |
| `2` | Usage or option validation error |
| `3` | Environment/binary/capability error |
| `4` | Input/probe/media validation error |
| `5` | Operation or FFmpeg execution failure |
| `6` | Output/filesystem/overwrite failure |
| `7` | Batch completed with one or more failed items |
| `130` | Interrupted/cancelled (`SIGINT`) |

A batch with zero failures exits `0`; a batch that continues after failures exits `7` and reports every failed item.

## 4. Logging channels

### stdout

Reserved for the command's primary result.

- Human mode: concise result/path/report.
- JSON mode: exactly one JSON document.

### stderr

Reserved for:

- progress;
- warnings;
- verbose diagnostics;
- rendered FFmpeg invocation;
- non-JSON error presentation.

## 5. Log levels

```text
error
warn
info
debug
```

Default human mode: `info`.  
`--quiet`: `error` only.  
`--verbose`: `debug`.

## 6. JSON mode rules

When `--json` is active:

- no ANSI color;
- no spinner/progress decoration on stdout;
- stdout contains one final envelope;
- stderr may contain process diagnostics only when `--verbose` is also enabled;
- errors still emit a valid envelope before exiting non-zero whenever initialization reached the command runtime.

## 7. Command rendering

Verbose and dry-run output may render a shell-like representation for human inspection, but this string is informational only. Execution must continue to use `{ binary, args[] }` with shell disabled.
