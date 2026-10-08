# Contributing

Contributions are welcome when they improve portability, deterministic validation, documentation or safe repository adoption without turning Project OS into an application framework.

## Development setup

1. Fork and clone the repository.
2. Use Python 3.9 or newer on macOS or Linux. Runtime dependencies are not required.
3. Create a focused branch for one observable outcome.
4. Preserve unrelated worktree changes.
5. Run the complete checks before opening a pull request.

**Run this in Terminal from the repository root:**

~~~bash
python3 -B -m unittest discover -s tests -v
python3 -X pycache_prefix=/tmp/project-os-pycache -m compileall -q skills/project-os/scripts skills/project-os/evals scripts
python3 -B scripts/check_public_tree.py
python3 -B -m json.tool plugin.json >/dev/null
python3 -B -m json.tool .codex-plugin/plugin.json >/dev/null
python3 -B -m json.tool .agents/plugins/marketplace.json >/dev/null
python3 -B -m json.tool skills/project-os/evals/prompts.json >/dev/null
git diff --check
~~~

These commands validate runtime behavior, Python syntax, JSON surfaces and patch whitespace. They must not rewrite tracked files.

## Repository working records

This repository keeps its own Project OS working records local. Root `.agents` plans, checkpoints, findings, evidence and knowledge are ignored by Git. Only `.agents/plugins/marketplace.json` is public package metadata. A fresh clone does not need the maintainer's working records to run the tests.

Do not force-add local records. After staging, run the public-source check above: it examines the Git index and CI checks the committed tree. The root-specific ignore rules preserve bundled templates and synthetic fixtures under `skills/` and `tests/`. This is this repository's publication policy; Project OS does not automatically make working records private in other repositories.

Ignored files need a separate backup if they must survive loss of the local checkout. Existing clones and downloaded archives can retain previously published material after a history cleanup.

## Self-hosting rule

This repository can use Project OS to develop Project OS, but the governing installed release and candidate source must remain distinct.

- The installed stable plugin or standalone skill interprets Project OS requests and governs the work.
- The candidate helper in this checkout is run explicitly for candidate tests and migrations.
- Do not replace the installed skill with a mutable checkout.
- Do not treat candidate behavior as installed behavior.
- After a versioned release exists, install that tag and start a fresh task before validating the standalone Codex copy.

This keeps an unfinished candidate from silently changing the rules used to develop it.

## Implementation rules

- Bootstrap creates Standard only. Program begins only through an explicit start operation.
- Preserve existing project files during initialization, adoption, repair, upgrade and Program lifecycle transitions.
- Preserve safe unrelated `.agents` namespaces.
- Keep application code outside Project OS operations unless a separate user request authorizes it.
- Keep languages and frameworks as detection signals. Add capability guidance only when a boundary changes engineering or verification decisions.
- Avoid runtime dependencies unless the benefit, security boundary and Python compatibility cost are demonstrated.
- Reject unsafe paths, ambiguous ownership and locally divergent managed content instead of guessing.
- Use atomic writes and preserve rollback behavior for multi-file operations.
- Add focused tests for success, dry run, conflict, concurrency and path-safety behavior.

## Program and archive rules

- Require a complete Program definition before writing `PROGRAM.md`.
- Do not open a plan as a side effect of starting a Program.
- Refuse Program closure while any plan is active.
- Require exit evidence for `completed` and a reason for `stopped`.
- Close plans only through the guarded helper with contracts, scoped requests and completion receipts.
- Preserve legacy dispositions without inventing proof; review uncontracted work on resume.
- Deliver managed workflow changes to existing repositories through a previewed routing and format migration.
- Archive exact contract bytes and record their SHA-256 digest.
- Check every indexed archive path and digest.
- Describe the archive as tamper-evident, not technically immutable, signed or remotely protected.

## Knowledge rules

- Keep findings, project knowledge and user-owned reusable knowledge separate.
- Add knowledge only after the failure mechanism is confirmed.
- Project OS ships no publisher-managed seed database. Reusable fixtures and portable bundles contain no credentials, personal data, private paths, real user content, URLs, evidence paths or copied proprietary history.
- Preserve applicability, trigger, mechanism, prevention, decisive verification and scope boundaries.
- Require human review before approval or export and never overwrite a conflicting target entry silently.
- Keep import source repositories read-only and make repeated imports idempotent.

## Documentation and skill rules

- Explain whether a request belongs in Codex chat, Terminal or the ChatGPT companion.
- Keep each Markdown prose paragraph and each list item on one physical line. Do not hard-wrap prose. Preserve separate lines only for headings, tables, code fences and intentional nested blocks.
- Make canonical short requests primary and describe them as natural language, not a parser.
- `$project-os help` stays read-only and lists every supported shortcut, purpose, required argument and examples.
- For workflow recipes, state result, possible files, proof and when the workflow is unnecessary.
- Use `$project-os` only for explicit skill invocation. Ordinary application prompts omit it.
- Keep setup, mental model, usage and technical reference in their dedicated documents.
- Keep examples stack-agnostic and free of private project material.
- Do not use the Oxford comma in English prose, documentation or public plugin metadata.
- Preserve `allow_implicit_invocation: true` so ChatGPT can expose the selected plugin skill.

## Release lockstep

`VERSION` in `skills/project-os/scripts/project_os.py` is the release source. A release change updates every active release surface together:

- portable and Codex package manifests;
- repository-local packaging metadata and source ref;
- pinned standalone installation URLs;
- generated `SYSTEM.project_os_version`;
- reusable knowledge migration rules and content-hash validation;
- portable bundle metadata;
- CI assertions, fixtures, documentation and release notes.

Candidate 2.2.1 uses `SYSTEM.schema_version: 5`, plans schema 2 and request/contract schema 1. Change the schema only when the manifest format changes. The version in `plugin.json`'s external `$schema` URL belongs to that external schema and is not a Project OS release version.

The lockstep test must pass before release. Do not add silent coercion or project-specific migration branches.

Build and validate the exact working-tree ZIP using [Directory packaging](docs/PACKAGING.md). The suite includes extracted-package fixtures, Markdown layout checks and runtime checks. Local checks do not replace fresh Codex and ChatGPT plugin-loader evaluation, Portal scan, hosted URL verification or publication authorization.

## Pull requests

Describe the concrete problem, smallest implemented change, checks run and remaining unverified boundaries. Do not claim deployment, production behavior or physical acceptance from source inspection or unit tests.

Report security issues through [SECURITY.md](SECURITY.md), not a public pull request.
