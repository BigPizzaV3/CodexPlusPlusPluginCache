# Batch Execution Semantics

## 1. Selection

Batch jobs operate on an explicit directory plus selection criteria.

Defaults:

- non-recursive;
- deterministic lexical ordering by normalized relative path;
- regular files only;
- hidden files ignored unless explicitly included;
- symlinks are not traversed recursively by default.

Options planned:

```text
--from <extension|format>
--include <glob>
--exclude <glob>
--recursive
--jobs <n>
--fail-fast
--output-dir <path>
--preserve-tree
--overwrite
--json
```

## 2. Parallelism

Default `--jobs` is **1** because FFmpeg workloads are frequently CPU/GPU/memory intensive. Users may explicitly increase concurrency.

A later capability-aware scheduler may adjust defaults, but v1.0 semantics remain deterministic and user-controlled.

## 3. Failure policy

Default behavior: **continue on item failure** and report aggregate results.

`--fail-fast` stops scheduling new items after the first failure. Already-running items may finish unless cancellation is explicitly propagated.

## 4. Exit status

```text
all selected items succeeded → 0
one or more items failed     → 7
selection/usage error        → appropriate non-batch code
user cancellation            → 130
```

## 5. Output directory

Default batch output directory:

```text
<input-directory>/output
```

Recursive processing with `--preserve-tree` mirrors relative input directories beneath the output directory.

Batch jobs never modify source files by default.

## 6. Naming

- Conversion changes the extension and preserves the basename.
- Same-format transformations append an operation suffix.
- Name collisions are errors unless `--overwrite` is explicitly enabled.

## 7. Aggregate result

```ts
interface BatchResult<T = unknown> {
  discovered: number;
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  items: BatchItemResult<T>[];
}
```

Each item retains its own normalized success/error result. Agents must not need to parse log text to determine partial failures.
