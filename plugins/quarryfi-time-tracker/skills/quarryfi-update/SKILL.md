---
name: quarryfi-update
description: Refresh the local QuarryFi plugin install from GitHub
---

Refresh the local QuarryFi time tracking plugin install by pulling the latest changes from GitHub into the folder Codex is currently using.

## Safety invariant

The local plugin checkout must not change during ordinary Codex use. Runtime hooks, status checks, and background heartbeats may write only to `~/.quarryfi/`. This update skill is the only sanctioned workflow that changes files under the plugin directory, and it should make that explicit in its response.

Keep three locations distinct:

- Upstream development repo: where maintainers author, commit, and push product changes to GitHub.
- Local install source: the clone referenced by the Codex marketplace; this is what the updater may fast-forward.
- Codex runtime cache: `~/.codex/plugins/cache/...`; Codex owns this copy. Never run `git pull`, `git reset`, or repair commands inside the cache.

## What to do

1. Find the plugin installation directory. Check these locations in order:
   - `~/plugins/quarryfi-time-tracker` (home-local install)
   - Marketplace source paths in `~/.agents/plugins/marketplace.json` and `<repo>/.agents/plugins/marketplace.json`, resolving relative `source.path` entries from the marketplace file's parent directory
   - Search for a directory containing `.codex-plugin/plugin.json` with `"name": "quarryfi-time-tracker"` under `~/plugins/`, `~/.codex/plugins/` excluding `~/.codex/plugins/cache/`, or the current repo's `plugins/` directory
   - If the only discovered copy is under `~/.codex/plugins/cache/`, do not update it. Tell the user:
     ```
     Found only Codex's runtime cache copy of quarryfi-time-tracker.
     The updater must run against the marketplace source clone, not the cache.
     Reinstall or restore the local source clone, then run the update again.
     ```

2. If the plugin directory is not found, tell the user:
   ```
   Could not find the quarryfi-time-tracker plugin.
   Install it first: https://github.com/quarryFi/codex-plugin#install
   ```

3. Check for updates:
   ```bash
   cd <plugin-dir>
   git fetch origin main 2>/dev/null
   LOCAL=$(git rev-parse HEAD)
   REMOTE=$(git rev-parse origin/main)
   STATUS=$(git status --short)
   ```

4. Before pulling, protect against dirty or half-updated checkouts:
   - If `$STATUS` is non-empty and `git diff --quiet origin/main` succeeds, the files on disk already match the remote but git metadata is stale. Tell the user:
     ```
     QuarryFi plugin files already match GitHub, but the local git branch is stale.
     This indicates an out-of-band file sync or interrupted update.
     Repairing git metadata only; file contents will not change.
     ```
     Then run:
     ```bash
     git reset --mixed origin/main
     ```
     After that, recompute `LOCAL`, `REMOTE`, and `STATUS`.
   - If `$STATUS` is non-empty and the worktree does not match `origin/main`, do not pull and do not stash automatically. Show `git status --short` and tell the user:
     ```
     QuarryFi plugin update blocked because the plugin checkout has local edits.
     Review or stash those edits, then run the update again.
     ```
     If they want to preserve those edits, suggest:
     ```bash
     cd <plugin-dir>
     git stash push -m quarryfi-plugin-local-edits
     git pull --ff-only origin main
     git stash pop
     ```

5. If `$LOCAL` equals `$REMOTE` and `$STATUS` is empty, tell the user:
   ```
   QuarryFi plugin is already up to date (version X.Y.Z).
   ```
   Read the version from `.codex-plugin/plugin.json`.

6. If there are updates available, show what's changed:
   ```bash
   git log --oneline HEAD..origin/main
   ```

7. Pull the update with fast-forward only:
   ```bash
   git pull --ff-only origin main
   ```

8. Read the new version from `.codex-plugin/plugin.json` and show:
   ```
   ✓ QuarryFi plugin updated to vX.Y.Z

   Restart the Codex App to load the new version.
   ```

9. Be explicit that this updates the local plugin folder on disk. The current Codex session may still be running the previously cached copy until restart.

10. Suggest verifying with `quarryfi-status` after restart so the user can confirm:
   - the installed version
   - the latest local audit timestamp
   - whether a hook has fired in the new session

11. If `git pull --ff-only` fails, do not try a merge. Report the failure and show the user the current `git status --short`.

## Error handling

- If the directory exists but is not a git repo, tell the user to re-clone.
- If there's no network, say the update check failed and to try again later.
- Never delete or overwrite the user's `~/.quarryfi/config.json` — that's separate from the plugin code.
- Be explicit that this updates the local plugin folder on disk; the current Codex session still needs a restart before the new version is active.
