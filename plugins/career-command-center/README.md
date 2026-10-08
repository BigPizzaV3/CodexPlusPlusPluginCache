# Career Command Center

Career Command Center combines a native macOS application with a Codex plugin. The app handles guided setup, documents, personalized evidence questions, preferences, opportunity tracking, archive/delete, and automation settings. Codex handles source auditing, live job and PhD research, master CVs, tailored packages, and recurring runs.

## Requirements

- macOS 14 or later.
- Codex desktop or CLI with plugins and automations enabled.
- A Codex project folder where the career workspace can live.

The bundled app is locally signed rather than App Store notarized. If macOS blocks its first launch after download, Control-click the app in `~/Applications`, choose **Open**, and confirm once.

The installer restores launch permissions that may be removed when the plugin is transferred, then locally re-signs and verifies the copied app before opening it.

## Install From Codex

Install **Career Command Center** from the Codex plugin directory. Start a new Codex task in the project that should hold your career workspace and say:

```text
Set up Career Command Center.
```

Codex installs and opens the macOS app. Complete the seven setup steps, including the document and project intake. Fresh setup starts blank and asks for evidence before search preferences; it does not guess your profession or enable a recurring schedule. Return to Codex and say:

```text
Finish Career Command Center setup.
```

Codex then audits the evidence and places source-specific follow-up questions in the app. Each question cites the CV, report, transcript, or intake detail that triggered it. Answer them under **Questions**, then use **Review in Codex**. Codex updates the verified evidence, derives or confirms role families, builds master CVs, and validates the workspace. It registers an automation only after the evidence questions are resolved and you selected a recurring schedule.

## Install a Development Build

The source distribution contains a local marketplace manifest at `.agents/plugins/marketplace.json` and the plugin under `plugins/career-command-center`.

```bash
codex plugin marketplace add /absolute/path/to/plugin_marketplace
codex plugin add career-command-center@career-command-center-local
```

## Daily Use

- Open `Career Command Center` from `~/Applications` or Spotlight.
- Answer cited follow-ups under **Questions** and send completed responses back through **Review in Codex**.
- Review verified opportunities under **To Apply**.
- Use the posting and package buttons from the detail pane.
- Mark an application **Applied** only after submission.
- Use **Archive** to remove a role from active queues while keeping it restorable.
- Use **Delete** to move a posting to Recently Deleted. Permanent deletion removes the details but retains a dedupe marker so the automation cannot add the same role again.
- Edit countries, role families, job or PhD categories, work arrangement, thresholds, and exclusions under **Settings**.
- Edit timing, search depth, minimum lead count, and automatic package generation under **Automation**.
- When the app shows **Sync needed**, click **Sync in Codex** or ask Codex to sync Career Command Center.

## Privacy and Files

The app stores data locally in the workspace selected during setup. It does not upload documents on its own. Codex accesses workspace files when it performs the tasks you request. Application packages are never removed when a posting is archived or deleted.

See [PRIVACY.md](PRIVACY.md) for the complete data-handling policy, [TERMS.md](TERMS.md) for terms of use, and [SUPPORT.md](SUPPORT.md) for help.

## Update

Reinstall the plugin from its configured local marketplace, start a new Codex task, and say:

```text
Update my Career Command Center app.
```

## Development

The plugin and macOS app source are available in this repository. Run the plugin tests with:

```bash
python3 tests/test_plugin.py
```

The project is licensed under the MIT License.
