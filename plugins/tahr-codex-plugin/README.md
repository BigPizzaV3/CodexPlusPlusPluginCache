# Tahr Codex Plugin

Tahr Codex Plugin packages independent, evidence-backed application security review skills and an optional read-only Tahr customer workflow for Agent Plugins-compatible clients.

## Single-source build architecture

Skills are maintained only in the public [`tahr-security/tahr-security-skills`](https://github.com/tahr-security/tahr-security-skills) repository. This wrapper repository stores the plugin manifest, branding, build validation, tests, and GitHub Actions workflow. It does not maintain copies of skill source.

At build time, the wrapper packages every valid skill tracked by the canonical repository. New, updated, and deleted upstream skills are therefore reflected automatically in the next build without editing a skill list or count here. The generated `SKILLS.md` inventories the exact packaged skills.

## Local build

Place the canonical skills repository next to this repository, then run:

```sh
python3 scripts/build_plugin.py --skills-repo ../tahr-security-skills --output-dir dist
```

The build produces only:

- `dist/tahr-codex-plugin.zip`
- `dist/tahr-codex-plugin.zip.sha256`

The script uses each Git index as its package allowlist, validates skill and agent metadata, checks local Markdown links and manifest assets, and does not execute upstream code. Identical checked-out inputs produce byte-identical archives.

Both repositories' tracked inputs must be committed and clean so `BUILD-PROVENANCE.json` SHAs identify the exact package bytes; untracked and ignored files are excluded.

## GitHub Actions builds

The `Build plugin` workflow runs when packaging-related files change on `main`, validates pull requests, and supports manual runs. The canonical source repository notifies this workflow after source skill changes. Its narrowly scoped `CODEX_BUILD_TOKEN` secret targets only the target repository's Actions workflow; this target workflow needs no secrets.

If automatic dispatch needs recovery, open the target repository's Actions tab, select `Build plugin`, and choose `Run workflow`. Roll out the architecture in this order:

1. Commit and push the target workflow and wrapper changes.
2. Verify a manual target build.
3. Commit and push the canonical source changes and notifier.

For push and manual runs, the workflow uploads the ZIP and checksum as an Actions artifact retained for 30 days. After this repository becomes private, only users with private repository access can download those artifacts. Each package records the exact source and wrapper commit SHAs in `BUILD-PROVENANCE.json` and includes a `sha256sum -c` compatible checksum. Building an artifact does not automatically submit or publish anything to OpenAI and does not create a release.

The publisher controls `plugin.json` versioning. Deliberately bump the plugin version before a new public submission or version whenever packaged content has changed.

## Optional Tahr MCP connection

The canonical optional customer skill can read applications, assessments, and findings from an existing Tahr account through an already configured Tahr MCP connection. This connection is for Codex/local use by existing Tahr customers. It does not provide OAuth or public ChatGPT account linking; the current Tahr MCP supports personal bearer token authentication only.

The production endpoint is `https://run.app.tahr.one/mcp`.

1. Ask an administrator to grant access under `Organization Settings > MCP`.
2. Create a personal token under `Profile > MCP`.
3. Export `TAHR_MCP_TOKEN` in the environment used to launch Codex. For example: `export TAHR_MCP_TOKEN="paste-token-shown-once"`.
4. Add this exact configuration to `~/.codex/config.toml`:

   ```toml
   [mcp_servers.tahr]
   url = "https://run.app.tahr.one/mcp"
   bearer_token_env_var = "TAHR_MCP_TOKEN"
   ```

5. Restart Codex after configuration as appropriate.

The token is shown once, is organization-scoped, and must never be committed, logged, or pasted into chat. All independent review skills continue to work without this optional connection.

## Local marketplace testing

1. Build the plugin and extract `dist/tahr-codex-plugin.zip` so the package is available at `dist/tahr-codex-plugin`.
2. In a separate temporary marketplace directory, create the metadata required by the Agent Plugins-compatible client and point its local plugin source at the extracted `dist/tahr-codex-plugin` directory. Do not place marketplace metadata inside the package.
3. Add the temporary marketplace to the client, install `tahr-codex-plugin`, and confirm that the skills listed in generated `SKILLS.md` are discovered.

Exact marketplace registration and installation commands are client-specific. Follow the local marketplace instructions for the client version under test.

## Authorized use and safety

Use these skills only on applications, accounts, data, and environments that you own or are explicitly authorized to test. Prefer reversible, minimally harmful validation in local or staging environments. A clean result does not prove that an application is secure.

No secrets, credentials, API tokens, or MCP tokens are bundled.

## Provenance and license

Packaged skills and `LICENSE` come from the exact canonical source commit recorded in generated `BUILD-PROVENANCE.json`. The manifest, branding, and build wrapper are authored in this repository. The target and source `LICENSE` files must be byte-identical for a build to succeed.

The package is licensed under the [GNU General Public License version 3.0 only](LICENSE) (`GPL-3.0-only`).
