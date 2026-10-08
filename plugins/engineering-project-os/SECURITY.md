# Security Policy

## Supported version

This source tree develops candidate Project OS 2.2.1. It does not establish that the candidate is published. Install the Directory plugin or standalone Codex skill first, then upgrade each connected repository explicitly. Updating the plugin or skill does not update repositories by itself.

## Report a vulnerability

Do not include exploit details, credentials, repository contents or other sensitive material in a public issue.

Use GitHub private vulnerability reporting when it is available. If it is unavailable, open a public issue containing no sensitive details and ask the maintainer for a private reporting channel.

Include:

- affected Project OS version;
- operating system and Python version;
- exact helper command, Codex workflow boundary or ChatGPT companion boundary;
- expected and observed behavior;
- a minimal sanitized repository when possible.

## Runtime boundary

The 2.2.1 helper uses the Python standard library and initiates no network request. It reads bundled assets and the target files selected by the user. Commands with an explicit `--config`, `--definition`, `--proposal`, `--checkpoint` or `--source` may also read that user-selected file or repository outside the target. Mutating operations write only inside the target repository except `knowledge export`, which creates one user-selected bundle outside the repository and refuses to overwrite an existing path. Knowledge import never writes to its source. Directory installation and standalone skill installation from GitHub are separate network operations performed by the host.

Project OS contains no daemon, watcher, MCP server, lifecycle hook, hidden database, central failure database or automatic cross-project synchronization. The helper runs only when a person or Codex invokes it locally. ChatGPT can work only with material supplied in its conversation.

## File safety

Project OS is designed to fail closed on:

- absolute, escaping or unsafe managed paths;
- symlink replacement boundaries;
- malformed Program, plan, finding, history or knowledge records;
- incompatible ownership during adoption;
- locally divergent managed guidance or conflicting reusable knowledge;
- incomplete or ambiguous legacy Program migration;
- concurrent changes before an atomic replacement;
- detected URL forms plus common detectable credential and private-path patterns in reusable knowledge and bundles.

Writes require POSIX directory descriptors and no-follow opens (macOS or Linux with Python 3.9+). Unsupported write environments fail before mutation. Create, replace, delete and rollback stay anchored to opened directories; a swapped parent cannot redirect them into a symlink target. Parsed JSON and its concurrency hash come from one byte snapshot. Program closure guards the plan registry as well as the files it changes; plan closure guards contracts, scoped requests, proof and checkpoint owners and upgrade refuses a newer repository release.

These checks detect ordinary concurrent edits and directory swaps. They are not a lock or isolation boundary against a process with equal filesystem privileges: that process can move an open directory, edit an inode during a syscall sequence or alter files after validation. Keep other writers idle while applying an operation. Caught failures trigger guarded rollback; abrupt termination or power loss may leave partial state that needs checker-guided recovery from a reviewed source or backup.

A mutating Project OS request must inspect, preview or dry-run, apply only a clean result and finish with the checker. In ChatGPT, changed files remain conversation artifacts until the user deliberately applies them to the real repository. Direct helper users must review `--dry-run` output before init, adopt, upgrade, Program start, Program close, plan complete or a mutating knowledge operation.

## Program archive boundary

Closing a Program stores the exact contract bytes and records a SHA-256 digest in the history index. The checker detects missing archives, invalid closure metadata and content that no longer matches its recorded digest.

This archive is tamper-evident, not technically immutable. It is not signed and does not prevent a person with write access from deliberately changing both archive and index. Git review, repository access control and backups remain separate security boundaries.

Treat a hash mismatch as an integrity event. Compare trusted Git history and repository evidence before restoring either side. Never accept changed bytes merely by updating their recorded digest.

## Authority boundary

`@Engineering Project OS` in ChatGPT and `$project-os` in Codex select a skill workflow for one message. Neither grants new authority.

Project OS does not authorize dependency installation, application changes, deletion, branch changes, commits, pushes, deployment, publication or communication with external systems. Those actions still require the user's request and applicable repository instructions.

A passing checker proves structural consistency, not application correctness, artifact identity, deployment state, production behavior or manual and physical acceptance.

## Knowledge safety

Do not put credentials, tokens, personal data, private machine paths, any URL, evidence paths, deployment identifiers, raw production logs or copied project history in reusable knowledge, bundles, fixtures or vulnerability examples.

The helper rejects detected URL forms plus a bounded set of other recognizable sensitive patterns. Automated screening cannot identify every project name or contextual disclosure, so human review remains mandatory before a lesson is approved or exported.

Sanitization preserves the mechanism, applicability, trigger, prevention, decisive verification and limits. If removing private context makes a lesson misleading, keep it in project-specific knowledge. Reusable lessons belong to the user and are never submitted to a publisher-managed knowledge service.
