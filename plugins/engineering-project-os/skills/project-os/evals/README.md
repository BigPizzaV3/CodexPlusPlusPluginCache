# Reviewer cases

`submission.json` contains nine positive and four negative Codex workspace cases. Each case has an independent synthetic fixture, prompt, expected workflow and expected result. `prompts.json` contains additional Codex and ChatGPT companion cases. `discovery.json` is the golden prompt set for direct, indirect, incomplete, negative and edge routing behavior. No private repository, account, dependency installation or network service is needed.

The three public starter prompts also require a fresh ChatGPT check. Install the exact candidate ZIP through the local marketplace and start a new chat. Confirm that the overview prompt explains the product without requesting files. Then use a synthetic project description for safe setup and attach a synthetic reusable knowledge bundle for cross-project import. Confirm that the selected plugin exposes Project OS instead of a generic fallback audit.

## Replay the discovery golden set

Run every case in `discovery.json` on its named surface with the exact candidate installed in a fresh chat or task. Record whether Project OS was selected, which intent it followed and whether every expected behavior was present. Direct and indirect positive cases measure recall. Negative cases measure precision. Incomplete and edge cases verify that selection does not invent missing context or mutation authority.

If routing needs adjustment, change one discovery field at a time, reinstall the candidate and replay the complete set. A frontmatter description change affects selection. A skill-body change affects behavior after selection. Public listing copy and starter prompts affect user expectations but do not replace behavioral testing.

## Replay continuity across sessions

continuity.json supplies five multi-message cases: compatible intake without a save command, conflict, independent successor, explicit withdrawal and required remote acceptance. prepare_fixture.py creates their isolated connected repositories with a real focused Python check and a pending synthetic remote gate. It supplies no external access.

Load the exact candidate on the named host and send each message in order. Inspect the actual requests registry, contract, index and checkpoint after each message; do not infer behavior from response wording. End that session. Start a fresh session over the same files and send only restart_prompt, without the previous chat. Verify recovered requirements, destinations, blockers and the exact next action. For ChatGPT, supply the resulting synthetic records as files in the new chat.

Record the package SHA-256, surface, each observation and file snapshots in local evidence. Fixture generation and deterministic helper checks prove fixture validity only. They do not execute host reasoning, prove plugin selection or close the fresh-session acceptance gate.

## Prepare one case

Extract the submission ZIP. Resolve `<plugin-root>` to its absolute extraction directory. Select a case name from `submission.json` and a new target directory whose parent already exists:

~~~shell
python3 -B <plugin-root>/skills/project-os/evals/prepare_fixture.py --case bootstrap-react-native-expo-repository --target <new-temporary-directory>
~~~

The command creates only that new synthetic repository. It refuses an existing target. It does not install the plugin, initialize Git, install packages or contact a service. The Expo fixture contains configuration only; its package versions are detection inputs, not installation recommendations.

Open the fixture as the Codex task's repository with the candidate plugin loaded. Record a file-hash snapshot outside the fixture, send the case's exact prompt and compare the response and changed files with every expected workflow and result item. Use a new target for each run. For read-only cases, compare all file hashes before and after; exclude only host-created files whose origin you separately record. For bootstrap, confirm the existing fixture inputs are unchanged.

Run the checker from the same extracted package after a mutating control-plane case:

~~~shell
python3 -B <plugin-root>/skills/project-os/scripts/project_os.py check --target <fixture-directory>
~~~

## Case-specific checks

- Help and ambiguous requests: no applying helper command or repository change.
- Check: the connected fixture passes the checker before the prompt and stays byte-identical.
- Empty bootstrap: Standard, no Program, no plan and no history archive.
- Expo bootstrap: select `mobile` and `react-native-expo`, exclude `web`, preserve package and app JSON.
- Current upgrade: dry run lists no create/update/delete actions and all hashes stay unchanged.
- Prepare and approve: create one batch preview, approve only `REVIEW-PORTABLE-001`, keep evidence project-local and run the checker.
- Export: create a deterministic bundle with two active lessons, report its SHA-256 and preserve the reusable registry.
- Applicable import: import the mobile lesson, skip the service-only lesson, preserve the source bundle and verify a repeated dry run is idempotent.
- Unrelated code: `python3 -B -m unittest -v test_handler.py` initially fails on `None` in `handler.py`. After the ordinary code fix, both tests pass and no `.agents` directory exists.
- Private lesson: `REVIEW-PRIVATE-001` has synthetic placeholders and a synthetic signed URL. Keep preparation read-only, refuse carrying those details into reusable knowledge and preserve the verified mechanism only in a sanitized revision.
- Conflicting import: report the same-ID content conflict and preserve every source and target hash.
- Blocked resume: `sample.txt` proves the recorded blocker is resolved. Resume plan 001, set execution to running and update STATE. Leave the acceptance item incomplete and the next step unimplemented, as the prompt requests.

## Evidence boundary

The source test suite builds a ZIP and executes its fixtures, bootstrap, checker and upgrade paths. Those deterministic checks do not execute Codex or ChatGPT reasoning workflows and do not prove plugin discovery. Record fresh Codex and ChatGPT plugin-loader results separately, including the exact ZIP hash and host. Portal ingestion, review approval and publication also remain separate checks.

## Premature readiness regression

Replay continuity-premature-release before publication: local tests and a prepared ZIP are already reported, but both host gates are pending. Inspect the actual failing readiness command, NOT_READY leading report, no publication recommendation and fresh file-only recovery. Plain addition/cancellation scenarios must validate JSON after every turn; matching a phrase in skill instructions is insufficient.
