# Fitness Ledger

Fitness Ledger is a Library-native skill bundle for conversational nutrition logging, deterministic daily reporting, and fitness-source reconciliation. It is designed for people who want AI convenience without opaque, silently changing health records.

## What it includes

- `nutrition-ledger`: provenance-aware food, hydration, and weight logging with corrections, tombstones, validation, and consistent reports.
- `fitness-sync`: pure validation and reconciliation helpers for workout/activity snapshots.

No hosted service, telemetry, or bundled health-data connection is required. The user's ChatGPT Library stores the canonical ledger files, while Caliber and Apple Health remain optional connected source adapters.

Each ledger must declare its own IANA timezone (for example, `Europe/London`). Date assignment uses that saved setting, never the host machine's clock or a regional default.

## Install in ChatGPT or Codex

In Codex CLI or the ChatGPT desktop app's Codex environment, add this GitHub repository as a marketplace source:

```bash
codex plugin marketplace add actowery/fitness-ledger --ref main
```

Refresh the plugin directory, select **Fitness Ledger**, and install it. Start a new Work chat and say, “Set up my Fitness Ledger.” The skill will resolve or create the canonical Library files, gather the timezone and any goals or source adapters the user chooses, and operate through Library rather than requiring a computer or local script.

The GitHub marketplace path is `.agents/plugins/marketplace.json`. A workspace administrator can import that marketplace for team distribution. A public universal-directory listing is a separate OpenAI submission step.

## Public directory submission

Fitness Ledger is prepared as a skills-only public plugin. `PUBLIC_SUBMISSION.md` contains the listing copy, starter prompts, reviewer test cases, release notes, and submission checklist. `PRIVACY.md`, `TERMS.md`, and `SUPPORT.md` provide the public policy and support URLs. Public availability begins only after OpenAI review and an explicit publish action in the plugin submission portal.

## Contributing workflow

Create a topic branch, make a focused change with tests, and open a pull request into `main`. GitHub Actions runs the full test suite on every pull request and on pushes to `main`, across supported Python versions. Merge only after the checks are green and the change has been reviewed. Repository maintainers can additionally require the `CI` check in GitHub branch protection settings.

## Releases

GitHub is the release source of truth; this repository does not maintain a separate downloadable bundle. For a release, update the plugin version and changelog in a pull request, merge after CI passes, then create and push a matching tag such as `v0.1.0`. The release workflow reruns the test suite, verifies that the tag matches `.codex-plugin/plugin.json`, and creates a GitHub Release with generated notes and source archives.

## Install and test locally

Install the plugin from a local marketplace or open the folder in Codex. Then run:

```bash
python3 -m unittest discover -v tests
```

Validate the manifest with the plugin validator provided by your Codex development environment before packaging a release.

Start with `examples/sample_ledger.json`; do not commit real food logs, health records, photos, API keys, or connected-account exports.

## Scope

This plugin tracks and explains data. It does not provide medical diagnosis, treatment, or a hosted health service.

## License

[MIT](LICENSE): people may use, modify, redistribute, sublicense, or sell copies, provided the copyright and permission notice travel with substantial copies. It is provided without warranty.
