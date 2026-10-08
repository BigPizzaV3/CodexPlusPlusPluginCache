# Failure knowledge

Project OS separates repository-specific evidence from reusable engineering lessons owned by the user. Knowledge stays in ordinary repository files. There is no central Project OS failure database, publication step, hosted service or background synchronization.

## Add a finding

For `finding add: <observation>`, inspect current evidence and search for an existing owner first. Record a stable ID, status, impact, evidence, required next check and optional active plan. Keep observations separate from inference and do not claim an unverified mechanism.

Preview the intended registry and evidence changes, preserve unrelated entries and run the checker after writing.

## Capture project knowledge

For `knowledge capture: <finding-id>`, require a confirmed mechanism and decisive evidence. Project knowledge may retain repository names, dependencies, local paths and environment details because it does not leave the source repository automatically.

Record applicability, trigger, mechanism, prevention, decisive verification and version or scope boundaries. Link the source finding. Do not turn a candidate or hypothesis into a failure lesson.

## Prepare and approve reusable knowledge

For `knowledge prepare: <lesson-id|all>`, remain read-only. Build a proposal outside the repository from one confirmed project lesson or every confirmed project lesson requested by the user. Remove project names, credentials, personal data, absolute machine paths, every URL, deployment identifiers, evidence paths and copied product history.

Preserve enough detail to keep the trigger, mechanism, prevention, verification and boundaries accurate. Use trimmed canonical IDs and applicability tags without whitespace, commas or control characters. If sanitization would make a lesson misleading, leave it project-specific and explain why.

Show every proposed entry in one batch review. Do not approve, write, export or publish anything during preparation. The helper rejects detected URL forms plus common detectable private patterns and sensitive field names. Screening still cannot identify every project name or contextual disclosure, so human review remains mandatory.

After the user selects entries from the proposal, preview the deterministic approval command:

~~~shell
python3 /absolute/path/to/project-os/scripts/project_os.py knowledge approve --target /path/to/repository --proposal /path/to/proposal.json --ids FAIL-001,FAIL-002 --dry-run
~~~

Use `--all` only when the user approved the complete proposal. Apply the identical reviewed command without `--dry-run`, then run `check`. Approved entries belong to the user and live in `.agents/knowledge/reusable/failures.json`.

`knowledge propose-shared: <lesson-id>` is a deprecated read-only alias for `knowledge prepare: <lesson-id>` in release 2.1.0. Never interpret it as permission to publish a lesson or submit it to Project OS authors.

## List, revise, retire and remove

Use `knowledge list: project|reusable` for a read-only inventory. A reusable lesson can be revised only through a reviewed proposal so target-local changes are never overwritten silently.

`knowledge revise: <lesson-id>` prepares a replacement revision, previews its exact lifecycle links and applies only after review. `knowledge retire: <lesson-id> because <reason>` preserves the lesson and its reason with status `retired`. `knowledge remove: <lesson-id>` is destructive and requires a separate preview plus exact ID confirmation. It refuses to remove either side of a replacement chain. Local removal does not recall copies already imported elsewhere.

Run the matching helper operation with `--dry-run`, review it, apply the same operation and finish with `check`.

## Export reusable knowledge

Export only reviewed reusable knowledge. By default the bundle includes every non-draft entry: active lessons plus retired and replaced tombstones needed to propagate lifecycle changes. A direct repository transfer and a portable bundle carry the same entry format. Neither includes source repository identity or project evidence.

Preview a complete reusable export:

~~~shell
python3 /absolute/path/to/project-os/scripts/project_os.py knowledge export --target /path/to/source-repository --output /path/to/failure-knowledge.json --dry-run
~~~

Use `--ids FAIL-001,FAIL-002` for a selected set. Every export must include each linked predecessor and replacement record needed for a complete lifecycle chain. `--active-only` omits tombstones and works only when the selected active lessons have no lifecycle dependencies. Apply the identical command without `--dry-run`. The helper creates a deterministic `project-os-reusable-knowledge` JSON bundle at a new path that resolves outside the source repository and reports its SHA-256. It refuses to overwrite an existing output file.

In ChatGPT, the user downloads the returned bundle artifact and later uploads it to the destination conversation. In Codex, the destination workflow can read either that bundle or the source repository directly.

## Import into another project

Import is always explicit and never mutates the source. First ensure the destination repository is connected to the current Project OS schema, then preview the source:

~~~shell
python3 /absolute/path/to/project-os/scripts/project_os.py knowledge import --target /path/to/destination --source /path/to/source-repository --dry-run
~~~

The source may also be a canonical JSON bundle. By default the helper selects active lessons whose `applies_to` values match `engineering`, a selected capability pack or a selected ecosystem overlay in the destination. It also considers retired and replaced tombstones regardless of their applicability tags, then recursively includes every linked entry needed to keep each selected replacement chain complete. The preview lists selected and skipped entries with reasons. Use `--ids FAIL-001,FAIL-002` for an exact reviewed set; it fails if a required lifecycle link is omitted. Use `--all` to consider every non-draft entry explicitly.

Apply only the same reviewed command without `--dry-run`, then run `check` and repeat the import dry run. The repeated preview must report no pending writes. Import rejects detected URL forms in reusable content before changing the target, but human review remains mandatory for contextual disclosures the scanner cannot recognize.

Import is conflict-safe:

- The same ID and content hash is already present and is skipped.
- The same content under another ID is deduplicated and reported.
- The same ID with different content is a conflict and causes no writes.
- A retired or replaced tombstone updates an existing target predecessor only when `previous_content_hash` matches. If the predecessor is absent, the tombstone is retained so an older active bundle cannot resurrect it later.
- A target-local revision is never overwritten silently.

## Deprecated synchronization command

Since 2.1.0, `sync-knowledge` is read-only. It explains that Project OS has no centrally managed knowledge source and directs the user to `knowledge import --source`. It does not write. Use `upgrade` to update product guidance, packs and overlays.
