# Request and result contract

The launcher accepts one `--request` argument. In the plugin workflow that argument
must be the fixed repository-relative path `.agentproof/request.json`.

## Requests

`capture`:

```json
{
  "action": "capture",
  "model": "gpt-5.6-sol",
  "prompt": "Implement the requested change and run relevant tests.",
  "sandbox": "workspace-write"
}
```

- Exact keys only.
- `prompt`: non-empty UTF-8 string, at most 64 KiB.
- `model`: 1–128 characters from letters, digits, `.`, `_`, `:`, `/`, `+`, `-`.
- `sandbox`: `read-only` or `workspace-write`.

`verify`:

```json
{"action":"verify"}
```

No other keys or actions are accepted. In particular, this distribution exposes no
Sign or Anchor action.

Verify guarantees the strict receipt line produced by this plugin runtime. Historical,
more permissive receipts from the Build Week prototype are not a supported input until
a separate migration profile is tested.

## Fixed paths

- Receipt: `.agentproof/agent-session.json`

The launcher refuses symlinked control paths and existing output targets.
The receipt is published with an atomic no-clobber hard-link operation from a private
temporary file in the same directory. A concurrent destination causes a closed
`receipt_output_already_exists` failure rather than replacement.

## Child execution

Capture invokes the installed CLI as a new child using the equivalent of:

```text
codex -a never -m <model> exec --sandbox <sandbox> --json -C <repository-root>
```

The prompt is sent through stdin and is not interpolated into the command. `-a never`
is required because this child is non-interactive and cannot answer approval prompts.
It does not remove the selected child sandbox or authorize execution outside it.

Raw child stderr is never forwarded. If the child exits nonzero, the error includes
only its exit code, stderr SHA-256, byte count and line count.

## Supported repository profile

Capture and Verify have explicit repository-root, observed-file, symlink, snapshot
size and filesystem constraints. Read
[supported-repository-profile.md](supported-repository-profile.md) before Capture.
Treat its error map as fail-closed behavior, not as instructions to bypass a limit.

## Error contract

Expected runtime and contract failures produce one JSON object on stderr with
`result = ERROR`, a typed `error` and the standard `limits`; the process exits 1.
Missing Git and Codex executables are reported as `git_unavailable` and
`codex_unavailable`. Running outside a Git repository is reported as
`git_repository_required`.

An otherwise unhandled runtime exception is reduced to
`unexpected_runtime_error`, its exception type and a SHA-256 commitment to the
traceback. Raw traceback text and exception messages are not emitted.

## Result semantics

- `receipt_valid`: the canonical receipt and its internal event chain validated.
- `repository.result = MATCH`: recorded final commitments for changed paths match the
  current repository.
- Neither value establishes completeness, truth, quality, safety, compliance or
  authorization, and `MATCH` must not be compressed into a generic approval.
- There is no independent signer or public timestamp in this distribution.
- If `remote.origin.url` is absent, `repository_id` commits to the absolute local
  repository path. The same repository in a different path can therefore have a
  different `repository_id`.
