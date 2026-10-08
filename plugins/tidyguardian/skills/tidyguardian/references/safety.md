# Safety model and threat boundary

## Permission and scope

The only mutation entry point is `apply-plan`. It revalidates a frozen versioned plan, source identities/content, root identity, ignore policy and exact destinations. A plan expires after 24 hours. It contains proposals, not a reusable approval. A selection JSON contains only a matching plan digest and operation IDs.

Execution requires an interactive terminal and a separate exact confirmation phrase for every action type in the selected set. Confirmation is bound to the plan plus selection digest. No `--yes`, `--force`, saved boolean or legacy `--execute` bypass exists. All actions are confirmed before any file move starts. Changes after confirmation abort rather than override safety checks.

An agent must never type this confirmation for the user. A TTY is a confirmation gate, not an identity provider: an agent/process with unrestricted shell access can allocate a pseudo-terminal, monkeypatch Python or directly alter files. Host-level permissions, a separate trusted approver/executor and restricted filesystem access are necessary against such an agent. Do not describe this skill alone as an OS security boundary.

## Data preservation

There is no permanent delete, recursive removal, empty-directory removal or purge implementation. QUARANTINE and METADATA rename approved files into `.tidyguardian-quarantine` on the same filesystem. The vault never expires automatically and does not free disk space. It is not the OS Trash and not a backup.

MOVE/RESTORE use native atomic no-replace rename, not copy-then-delete. Linux uses `renameat2` with `RENAME_NOREPLACE`; macOS uses `renameatx_np` with `RENAME_EXCL`. Unsupported OS/filesystem operations fail closed. Cross-device paths and Windows mutation are refused. No fallback calls shutil.move, os.replace, unlink or rmtree.

Files must be regular and single-link. Directories, symlinks, junction/reparse points, hardlinks, protected paths and recognized project dependencies are not eligible. Snapshots include device, inode, size, mode, link count, nanosecond modification/change times and SHA-256. Duplicate quarantine also requires a separate unchanged retained file and fresh byte comparison on supported execution platforms. Retained copies cannot be targeted elsewhere in the batch.

## Paths and protected data

Reject absolute paths, traversal, noncanonical separators, control characters, ambiguous trailing dots/spaces, nested devices and symlink/reparse components. Parent descriptors are opened without following symlinks during native execution. Operating-system locations, repository internals, credentials, known application packages, the vault and lock are protected. `.tidyguardianignore` adds non-negated relative path/glob exclusions to sources and destinations.

Known project files protect their containing tree. Recognized sidecars protect associated media. Unknown project references, live photos, cloud placeholders, camera-card structures and application-specific dependencies are not comprehensively detected. Add explicit exclusions and keep such workflows out of execution until a dedicated adapter is tested. Same bytes do not imply a copy has no backup or application value.

Metadata cleanup only proposes signature-recognized `.DS_Store` and `Thumbs.db` files in leaf folders. Arbitrary `._*`, `desktop.ini`, unknown formats and directory removal are excluded. Execution consumes a fixed approved plan, never a fresh cascading cleanup scan.

## Failure and recovery

Reports are uniquely named, private, outside the source, and created exclusively. Journal entries are flushed/fsynced, hash-chained, and written before and after each move. Directory entries are fsynced on supported POSIX systems. The persistent root lock serializes cooperating TidyGuardian processes, not other applications.

A crash can leave a prepared operation whose rename completed but whose done record did not. `restore-plan` inspects the preserved file and refuses uncertainty, conflicts or identity/content changes. Restoration always produces a new reviewed plan. It does not overwrite existing paths, purge the vault, undo external application writes or remove empty destination folders. A hash chain detects accidental edits; it is not authentication against an actor able to rewrite the whole journal.

No filesystem interface here guarantees safety against a malicious concurrent process moving parent directories or swapping a source at the final syscall boundary. Post-move checks stop and retain journaled data on mismatch; there is no destructive rollback. Close applications, pause sync, use privately controlled directories and maintain independent backups. Network/cloud filesystems, power-loss behavior and all hardware/OS combinations require further integration testing.

## Local-first is not a decoder sandbox

The core does not upload content or execute instructions found inside files. Optional FFmpeg/FFprobe calls restrict protocols to local file/pipe and use timeouts. They remain external parsers, not a sandbox for hostile media. Metadata reads and thumbnails are explicitly requested separately from execution.

## Native API references

- Python filesystem operations: https://docs.python.org/3/library/os.html
- Linux rename semantics: https://man7.org/linux/man-pages/man2/rename.2.html
- Darwin flags are defined by the platform C headers; macOS CI exercises its native backend.
