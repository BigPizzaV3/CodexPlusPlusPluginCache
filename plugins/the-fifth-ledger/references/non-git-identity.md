# Non-Git identity and mutation parity

Use a deterministic filesystem traversal observation when the bounded target is a real
artifact but has no safe Git identity. The helper is evidence for represented filesystem
state, not a substitute for an atomic snapshot, repository, provider, deployment, or
release provenance.

## Establish the assurance boundary

Use the helper only for a local, owner-controlled target that can remain trusted and
quiescent for both traversal passes. The resolved root and its ancestors must not be
adversary-writable. Do not use shared temporary trees, dynamic or virtual filesystems,
or a target that a validator, watcher, build, editor, synchronisation service, or other
process may mutate during observation. Use least privilege.

The helper does not use an atomic filesystem snapshot and does not defend pathname
traversal against adversarial concurrent directory replacement. It resolves a symlinked
root before traversal and reports the canonical resolved root; trust and quiescence must
cover that root and its ancestors. If these preconditions cannot be established, record
exact non-Git identity as `unavailable` rather than treating a result as degraded proof.
It refuses cross-device entries by default. This does not detect every mount arrangement,
including same-device bind mounts. Inspect the target's mount layout separately and
exclude every known nested mount before traversal; any such exclusion makes the result
bounded. Otherwise use a separately authorised identity method.

## Capture identity

Run the dependency-free helper from the plugin source:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -I \
  <plugin-root>/skills/establish-governance-boundary/scripts/snapshot_project.py \
  <project-root>
```

The helper requires two matching sequential traversal passes. This detects represented
change between the passes but does not prove that the tree existed atomically in that
state or defeat changes that are reversed between observations. Record the observation
start and completion time, pass count, assurance label, and trusted/quiescent
precondition; `observed_at` is the completion time, not a point-in-time snapshot instant.

The default scope is `complete`, meaning no target paths are excluded. Its
relocation-stable tree digest covers paths, entry types, regular-file contents and sizes,
permission modes, and symlink targets. A separate mutation-sensitive metadata digest
covers root and entry modes, owner/group identifiers when exposed, sizes, nanosecond
mtime/ctime, and platform flags when exposed.

Known unrepresented metadata includes atime, ACLs, extended attributes, device/inode
identity in the emitted digest, hard-link topology, link counts, birth time, and
allocation or sparse-file metadata; the list is explicitly non-exhaustive. Reading files
or directories can itself update atime on filesystems that enable access-time updates.
The helper makes no explicit content or metadata writes, but it is not mutation-free at
that unrepresented boundary; use no-atime facilities only when supported and separately
authorised. Record this possible observer side effect. `Complete` describes path scope,
not every filesystem property. Call a match represented-tree parity and metadata parity;
do not claim stronger byte-for-byte or total-filesystem parity without separate evidence.

Record the schema, both algorithms and digests, observation window, pass assurance,
complete or bounded scope, explicit exclusions, matched and unmatched exclusions, file
and entry counts, and unrepresented metadata. Do not call the result a point-in-time
snapshot, Git revision, commit, tag, build, publication, deployment, or release identity.

The raw output includes the resolved local root and exact digest. Keep it in the
adopter's declared private evidence lane; publish only a sanitized target class and
behavioral result. Special entries are represented by type and mode rather than readable
content, so explain any stronger identity requirement they leave unavailable.

## Use exclusions honestly

`--exclude PATH` accepts a concrete project-relative file or directory using canonical
POSIX `/` separators and may be repeated. It does not accept patterns, absolute paths,
parent traversal, Windows drive or UNC forms, backslashes, or non-canonical path aliases.

Any exclusion makes the observation `bounded`. A bounded digest proves only its included
scope. It cannot establish complete represented-tree or metadata parity, even when
excluded files look like disposable caches. Full requested-field matches report
`matched_within_bounded_scope`; subset matches report
`requested_fields_matched_within_bounded_scope`. Record matched and unmatched exclusions
from the helper output.

## Compare preflight and postflight

For a read-only or tightly bounded task, capture complete preflight tree and metadata
digests plus the regular-file count. Compare them after all observations and validators:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -I \
  <plugin-root>/skills/establish-governance-boundary/scripts/snapshot_project.py \
  <project-root> \
  --expect-digest <preflight-digest> \
  --expect-metadata-digest <preflight-metadata-digest> \
  --expect-file-count <preflight-file-count>
```

The helper exits `1` when any requested comparison field mismatches and `2` when the
target cannot be traversed completely or the two sequential observations differ. A
matching bounded result remains bounded; exclusions do not become proven unchanged
merely because included fields match.

Supply all three expectation flags for full represented comparison. If only a subset is
provided, JSON and text output report `requested_fields_matched`, never unqualified
`matched`, and expose the individual tree, metadata, and file-count states. Two matching
observations within one invocation establish internal observation consistency; pre/post
parity still requires separate invocations around the bounded work.

The postflight comparison record echoes every supplied expected digest and count. Retain
both raw preflight and postflight records so each observation window, assurance boundary,
scope, actual identity, expected baseline, and comparison result remain auditable.

## Control validator side effects

Treat `check`, `lint`, `format --check`, test collection, parsing, and compilation as
potential writers until proved otherwise.

- Prefer documented no-cache or no-bytecode modes where available.
- Capture a complete preflight snapshot when whole-target parity matters.
- Re-snapshot after every group of tools that may write.
- Classify every difference before cleanup.
- Never delete or overwrite unknown or pre-existing state to manufacture parity.
- If a transient output is precisely attributable to the authorised run, move only that
  exact output to declared recoverable task scratch when cleanup is within authority.
  Otherwise preserve it, report the mutation, and request direction.

Creating and moving a cache can restore represented-tree parity while leaving directory
mtime or ctime changed. Do not restore timestamps to manufacture strict metadata parity.
Report the matched tree digest and mismatched metadata digest separately.

Record the side effect, attribution evidence, recovery location or reason it was left
in place, and final parity. A recovered side effect is part of the evidence, not a fact
to omit from the report.
