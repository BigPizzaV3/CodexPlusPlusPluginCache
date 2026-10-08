# Supported repository profile

This profile defines where Capture and Verify are expected to work. These are
deliberate fail-closed boundaries, not evidence that repositories outside the
profile are unsafe.

## Invocation root

Run the launcher from the exact root of the intended trusted Git repository.
Running it from a subdirectory fails with `run_from_git_repository_root`.
Running it outside a Git repository fails with `git_repository_required`.

## Files observed by Capture

Capture snapshots:

- Git-tracked files; and
- untracked files not excluded by Git's standard ignore rules.

It does not observe files excluded by `.gitignore`, `.git/info/exclude` or global Git
ignore configuration. Changes to those files do not appear in the receipt.

It also excludes `.agentproof/`, `.git/`, Python bytecode, and paths containing
`__pycache__`, `node_modules`, `.venv`, `venv`, `.mypy_cache`, `.pytest_cache` or
`.ruff_cache`, even if Git would otherwise list them.

Included repository paths must be valid UTF-8. A path that cannot be decoded as UTF-8
aborts Capture with `non_utf8_repository_path`.

## Symlinks

Included paths must not contain a symlink component. One included symlink aborts the
entire snapshot with `repository_symlink_unsupported:<path>`. Verify applies the same
fail-closed rule to repository paths recorded in a receipt.

## Snapshot size

- Maximum included file size: 20 MiB. A larger file fails with
  `snapshot_file_too_large:<path>`.
- Maximum total included size: 100 MiB per snapshot. A larger snapshot fails with
  `snapshot_total_too_large`.
- Capture holds the before and after snapshots while building file-change events, so
  both bounded snapshots may coexist in memory.
- Verify independently refuses to hash a recorded repository file larger than
  20 MiB and fails with `repository_file_too_large:<path>`.

## Receipt publication

The filesystem containing `.agentproof/` must support a same-directory hard link.
Capture uses that primitive to publish a fully written receipt atomically without
overwriting a concurrent destination. Lack of support fails closed with
`receipt_publish_failed`.

This behavior was exercised on macOS/APFS. It has not yet been gated on Windows or a
remote filesystem without hard-link support.

## Error map

| Error | Meaning | Required response |
|---|---|---|
| `git_repository_required` | The current directory is not inside a Git repository. | Stop; choose the intended trusted Git repository before retrying. |
| `run_from_git_repository_root` | The launcher was not run from the repository root. | Stop and rerun only from the intended trusted root. |
| `non_utf8_repository_path` | An included repository path is not valid UTF-8. | Stop; do not rename or omit the path automatically. |
| `repository_symlink_unsupported:<path>` | An included or verified path traverses a symlink. | Stop; do not follow, replace or bypass the symlink automatically. |
| `snapshot_file_too_large:<path>` | One included file exceeds 20 MiB. | Stop; do not raise the limit or silently omit the file. |
| `snapshot_total_too_large` | One snapshot exceeds 100 MiB. | Stop; do not raise the limit or silently shrink the observed set. |
| `repository_file_too_large:<path>` | Verify encountered a recorded repository file larger than 20 MiB. | Stop; do not hash partially, raise the limit or reinterpret the result as `MISMATCH`. |
| `receipt_publish_failed` | Atomic no-clobber publication was unavailable. | Stop; do not fall back to a partially visible destination. |

When reporting one of these errors, identify the matching profile condition. Do not
describe a failed Capture as a valid receipt and do not weaken the boundary merely
to make the command succeed.
