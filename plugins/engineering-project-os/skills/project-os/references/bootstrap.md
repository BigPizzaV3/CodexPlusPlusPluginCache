# Connect a repository

Use this workflow for `inspect`, `bootstrap` and `adopt`. Installing the skill and connecting a repository are separate operations.

Resolve `scripts/project_os.py` relative to the installed Project OS skill directory. Do not assume the target repository contains the helper.

## Inspect first

1. Resolve the repository root and inspect Git status without modifying files.
2. Read applicable `AGENTS.md` or `AGENTS.override.md` files from the root to the working directory.
3. Inspect tracked configuration, lockfiles, CI, Makefiles, task runners and current documentation.
4. Identify authoritative product, architecture, API, security and operational sources. A filename alone does not prove authority.
5. Detect capability signals, then justify each selected pack and overlay from repository evidence.
6. Classify the connection path: clean bootstrap, preservation of an existing root `AGENTS.md` or adoption of compatible existing owners.

For `inspect`, report that classification, evidence, proposed files and exact next request, then stop without writing.

## Bootstrap means Standard

Bootstrap always creates Standard. It never creates `PROGRAM.md` or guesses that a repository needs a Program. Program is a separate lifecycle decision after connection.

Capability packs are `service`, `web`, `mobile`, `data` and `delivery`. The `react-native-expo` overlay requires `mobile`. Languages and frameworks are signals, not behavior profiles.

## Clean bootstrap

Use `init` when Project OS owners do not exist. A safe unrelated `.agents` namespace such as `.agents/plugins` may remain in place and must be preserved.

Run this in Terminal with the installed helper path resolved:

~~~shell
python3 /absolute/path/to/project-os/scripts/project_os.py detect --target /path/to/repository
python3 /absolute/path/to/project-os/scripts/project_os.py init --target /path/to/repository --packs auto --overlays auto --dry-run
~~~

Review every proposed create and selection. Apply only the identical clean operation:

~~~shell
python3 /absolute/path/to/project-os/scripts/project_os.py init --target /path/to/repository --packs auto --overlays auto
~~~

Do not initialize when the dry run reports a Project OS owner, unsafe path or occupied destination.

## Existing root AGENTS.md

Preserve the file. Propose the smallest explicit routing needed for `.agents/CONTEXT.md` and `.agents/STATE.md`. Apply that reviewed routing without replacing existing instructions, then use the narrow preservation flag.

Run this in Terminal with the installed helper path resolved:

~~~shell
python3 /absolute/path/to/project-os/scripts/project_os.py init --target /path/to/repository --packs auto --overlays auto --allow-existing-agents --dry-run
~~~

The helper refuses the flag until both routes are present. Apply the same command without `--dry-run` only after confirming that `AGENTS.md` will be preserved.

## Existing compatible control plane

Use `adopt` when compatible owners already exist for context, state, plans and findings. Adoption maps them and adds Project OS metadata, managed guidance and an empty user-owned reusable knowledge registry without rewriting those owners.

Run this in Terminal with the installed helper path resolved:

~~~shell
python3 /absolute/path/to/project-os/scripts/project_os.py adopt --target /path/to/repository --inventory --dry-run
~~~

Apply only when the preview reports `safe_to_adopt: true`, every mapping is correct and the proposed plan-format and AGENTS routing changes preserve existing content. Review every listed modification before applying:

~~~shell
python3 /absolute/path/to/project-os/scripts/project_os.py adopt --target /path/to/repository --inventory
~~~

Adoption fails closed on ambiguous owners, unsafe paths, incomplete legacy knowledge coverage and occupied managed destinations.

Do not infer an active Program merely because `PROGRAM.md` exists. Adoption fails closed in this case. Resolve the lifecycle explicitly instead of forcing adoption.

## Finish the connection

1. Merge only routing and lifecycle rules compatible with the existing `AGENTS.md`.
2. Fill `.agents/CONTEXT.md` with verified authority, architecture, commands and boundaries.
3. Remove unjustified packs or overlays. Add nested instructions only for genuinely different scopes.
4. Keep `.agents/STATE.md` idle until a concrete resumable plan is opened.
5. Run the checker:

   ~~~shell
   python3 /absolute/path/to/project-os/scripts/project_os.py check --target /path/to/repository
   ~~~

6. Report created or adopted files, reviewed format or workflow-routing changes, checker result and unverified boundaries. Verify WORKFLOW routing and the empty requests registry. Legacy unfinished plans require a reviewed contract before resume or closure.
7. Recommend a new Codex task so new startup instructions enter the instruction chain.

Do not copy another project's state, plans, findings, history, paths, evidence or product rules. Transfer only approved reusable lessons through the explicit knowledge import workflow.
