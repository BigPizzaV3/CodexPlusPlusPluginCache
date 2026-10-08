# Universal Plugin Directory and release packaging

Project OS 2.2.0 is available in the Directory. Project OS 2.2.1 is the corrective source-tree candidate. It retains schema 5 and adds canonical ordinary intake, explicit readiness reporting and a pre-publication package acceptance guard. Passing local checks does not publish it.

The Universal Plugin Directory is the primary installation route. The tagged standalone skill remains a Codex-only alternative. GitHub publication, Directory review and Directory publication are separate gates, so none may be inferred from the others.

## Build the candidate

Run the full suite, then build to a new path outside the checkout:

~~~shell
python3 -B -m unittest discover -s tests -v
python3 -B scripts/package_plugin.py --output /private/tmp/engineering-project-os-2.2.1-plugin.zip
python3 -B scripts/package_plugin.py --check /private/tmp/engineering-project-os-2.2.1-plugin.zip
~~~

The output path must not exist. The builder reads the current working tree, including intentional uncommitted changes. Stable entry ordering, timestamps and permissions make repeated builds reproducible in the same Python and zlib environment. Record the SHA-256, entry count, compressed bytes and extracted bytes for the exact reviewed ZIP.

The package allowlist includes both manifests, the complete skill and its assets, public documentation, README, license, security policy, changelog, contributing guide and the packaging tool. It excludes the repository's local `.agents` control plane, Git metadata, tests and bytecode caches. Hidden `.agents` paths inside skill templates are public product assets and remain included.

The checker validates regular file entries, normalized unique paths, path traversal, symlinks, size limits, CRCs, manifest agreement, relative documentation links and Markdown layout. Public prose paragraphs and list items stay on one physical line so renderers cannot expose source wrapping as isolated words or conjunctions.

The package must not contain a release-managed failure knowledge database. Capability packs and overlays are product guidance. Project knowledge, the user's reusable knowledge registry and exported bundles exist only in connected repositories or user-selected artifact locations.

## Version and schema contract

Release version must be `2.2.1` in the helper, both plugin manifests, marketplace reference, knowledge provenance, tests and active documentation. `SCHEMA_VERSION` is `5`; plans use schema 2 and requests/contracts use schema 1.

The repository upgrade accepts schemas 2, 3 and 4, preserves existing legacy Program and knowledge migrations and adds the schema-5 continuity records in one transaction. It updates managed workflow, minimal AGENTS routing and plan-index metadata without rewriting Markdown plans, context, state, findings, evidence or application code. Historical dispositions remain legacy; uncontracted unfinished work requires review on resume. Test the exact transaction with dry-run, apply, `check`, `git diff --check` and path review.

## Selected metadata

Use these values in both manifests and the Directory form:

- Name: `Engineering Project OS`
- Descriptor: `Built for Codex.`
- Subtitle: `Resume work. Reuse lessons.`
- Skill short description: `Resume Codex work and reuse failure knowledge`
- Plugin description: `Keep long-running Codex work resumable and reuse verified failure knowledge safely between your own projects. ChatGPT is a companion for supplied files and portable bundles.`
- Long description: `Use this when Codex work must survive multiple sessions, preserve verified decisions and evidence or carry reviewed failure lessons into another repository you own. Project OS inspects, bootstraps, validates, repairs and upgrades visible repository records with previews before writes. ChatGPT is a companion for explanation, supplied project files and portable knowledge bundles. Do not use it for ordinary one-session coding or as an automatic global knowledge service.`
- Capabilities: `Resume Codex work across sessions`; `Keep plans, decisions and evidence with the repository`; `Capture verified failure knowledge`; `Reuse reviewed lessons across your own projects`.

Keep `codex` before `chatgpt` in discovery keywords. The skill metadata file `skills/project-os/agents/openai.yaml` may contain only `policy.allow_implicit_invocation: true` under `policy`. Its `short_description` must contain 25 to 64 characters and its `default_prompt` must mention `$project-os` explicitly.

The three Directory starter prompts must match both manifests exactly:

1. `Tell me how Project OS helps Codex resume real engineering work across sessions.`
2. `Help me set up Project OS for this repository and start with a safe preview.`
3. `Help me reuse verified failure knowledge from an earlier project in this one.`

The social preview is versionless. It uses the eyebrow `BUILT FOR CODEX`, the title `Engineering Project OS`, the tagline `Resume work with durable state and reusable failure knowledge` and the existing `CONTEXT`, `PLANS`, `EVIDENCE`, `KNOWLEDGE` labels.

## Continuity and host checks

Replay the multi-message cases in evals/continuity.json using the exact candidate package. Verify request records and plan status after each message. End the initial session, start a fresh session with only the repository files and verify recovery, routing and the exact next action. A passing deterministic fixture test is not a host workflow pass. Keep inaccessible Codex or ChatGPT acceptance pending with the exact required action.

## Required pre-publication acceptance guard

Build candidate ZIPs freely for isolated testing. Package consistency alone reports NOT_EVALUATED and never proves release readiness. Before recommending publication or asking for release authorization, run the read-only guard against the exact tested ZIP and the connected repository that owns its acceptance:

~~~shell
python3 -B scripts/package_plugin.py --check /private/tmp/engineering-project-os-2.2.1-plugin.zip --acceptance-target /path/to/repository --plan-id 007
~~~

This guard rejects a ZIP differing from the candidate checkout and fails with NOT_READY when the selected plan has invalid records, stale proof, open requirements or pending acceptance. A successful result includes the exact ZIP SHA-256 and the named recorded outcome. It checks recorded proof consistency, not the semantic truth of evidence. The agent must verify that this is the release-preparation outcome and that it covers actual fresh Codex and ChatGPT behavior, not a narrower source-only plan. Acceptance files remain private and are never packaged.

If candidate host access is unavailable, report NOT_READY with the exact blocker and keep the plan open. Do not recommend publishing to unlock testing. Changed candidate bytes require rebuilding and repeating affected acceptance. Owner-directed publication with a known blocker does not verify it or close the preparation plan.

## Discovery checks

Replay `skills/project-os/evals/discovery.json` in a fresh Codex task. The set covers direct Codex overview and setup, indirect continuity loss, cross-project failure knowledge, one-session negative control, explicit ChatGPT use with supplied files, missing ChatGPT files and rejection of automatic global sharing.

The metadata follows the official [metadata optimization guide](https://developers.openai.com/plugins/guides/optimize-metadata): it begins the long description with when the plugin should be used, states negative cases and includes direct, indirect and negative golden prompts. Change one metadata field at a time during later tuning and keep experiment notes only in ignored local `.agents` records.

Test all three public starter prompts in a fresh ChatGPT chat. The overview must describe Project OS as built for Codex and ChatGPT as the companion. Existing-repository requests without supplied files must ask for them rather than inspecting an empty host workspace.

## Release sequence

1. Finish source checks, validate the exact reproducible ZIP and review the complete diff. Existing versionless artwork remains unchanged.
2. Run `python3 -B scripts/check_public_tree.py` against the staged file list and run `git diff --cached --check` before any release commit.
3. Load the exact candidate in an isolated test environment and run discovery plus continuity cases in fresh Codex sessions. Preserve the installed stable copy.
4. Test the three starter prompts in a fresh ChatGPT chat and confirm companion behavior.
5. Pass the pre-publication acceptance guard above with all mandatory host results recorded. Only then recommend publication or request explicit owner authorization for commit, push, pull request, merge, tag and GitHub Release.
6. Wait for required checks, create tag and GitHub Release `v2.2.1`, then verify the tagged standalone Codex installation in a fresh task.
7. Submit the same verified ZIP to the Directory through the owner-controlled Portal flow.
8. Record approval separately from publication, then verify public Directory availability in fresh Codex and ChatGPT sessions.

Do not replace package contents under an existing version. Any content change after publication requires another version.

## Directory form and release notes

Walk through Plugin Info, Prompts, Skills and Submit. Verify images, capabilities, prompt text, policy declarations and the package version before submission. Customer support information belongs in the Portal listing, not in unsupported manifest fields.

Use these candidate release notes after the release gates pass:

`2.2.1 corrects ordinary request intake and cancellation with locally available canonical formats and immediate validation. Readiness reports and a package acceptance guard block release recommendations while mandatory behavior checks remain open. Record schemas remain unchanged.`

Use the official [submission guide](https://developers.openai.com/plugins/deploy/submission) and [plugin guidelines](https://developers.openai.com/plugins/app-guidelines) for the external review. Local validation cannot establish Portal acceptance or public availability.
