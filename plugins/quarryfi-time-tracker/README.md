# QuarryFi Codex Plugin

Privacy-minimized activity tracking for [OpenAI Codex](https://openai.com/codex). The plugin records active Codex session time and project-level metadata in QuarryFi so businesses can review potential R&D activity alongside GitHub and compensation evidence.

Tracker records are supporting evidence. They do not determine tax-credit eligibility, calculate a claim by themselves, or replace advice from a qualified tax professional.

Supports **multiple company profiles** with project-to-key routing — freelancers and consultants can track R&D time for different clients from a single config file.

## Install

### Public install: OpenAI Plugins Directory

QuarryFi is published in the universal Plugins Directory shared by ChatGPT and Codex.

1. In the Codex App, open the **Plugins Directory**. In Codex CLI, run `/plugins`.
2. Search for **QuarryFi R&D Tracker**, open it, and select the plus button to install it.
3. Start a new Codex task or CLI session so the installed version is loaded.
4. Review and trust the four QuarryFi lifecycle hooks when prompted. In Codex CLI, use `/hooks` if the prompt was dismissed.
5. Configure a seat-assigned key using [Quick Setup](#quick-setup).
6. Ask Codex to "Check my QuarryFi R&D tracking status" and confirm Codex reports `receiving`.

You can enable/disable the plugin at any time from the plugin directory. Codex stores your preference in `~/.codex/config.toml`.

### GitHub development install: Personal Plugins

Use the GitHub-backed Personal Plugins route only for plugin development, release QA, or testing a version that has not reached the public directory. Do not enable the public and personal copies at the same time because matching hooks from both sources can run concurrently.

---

### Home-Local Development Setup (Codex App / Codex CLI)

The plugin folder name must match the `"name"` in `.codex-plugin/plugin.json`, which is `quarryfi-time-tracker`.

Use this to make the plugin available across all your projects.

1. Clone the plugin:

```bash
mkdir -p ~/plugins
git clone https://github.com/quarryFi/codex-plugin.git ~/plugins/quarryfi-time-tracker
```

2. Register it in your personal marketplace:

```bash
mkdir -p ~/.agents/plugins
```

If `~/.agents/plugins/marketplace.json` **doesn't exist yet**, create it:

```json
{
  "name": "personal-plugins",
  "interface": {
    "displayName": "Personal Plugins"
  },
  "plugins": [
    {
      "name": "quarryfi-time-tracker",
      "source": {
        "source": "local",
        "path": "./plugins/quarryfi-time-tracker"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

> **Note:** The `source.path` is relative to the marketplace file's parent directory (`~/`). If you already have a `marketplace.json`, add the `quarryfi-time-tracker` entry to the existing `plugins` array.

3. Restart the Codex App. The plugin should appear in the plugin directory under "Personal Plugins".

### Repo-Local Install

To scope the plugin to a single project:

1. Clone into your repo's plugin directory:

```bash
mkdir -p plugins
git clone https://github.com/quarryFi/codex-plugin.git plugins/quarryfi-time-tracker
```

2. Add a marketplace file at `<repo-root>/.agents/plugins/marketplace.json`:

```json
{
  "name": "project-plugins",
  "interface": {
    "displayName": "Project Plugins"
  },
  "plugins": [
    {
      "name": "quarryfi-time-tracker",
      "source": {
        "source": "local",
        "path": "./plugins/quarryfi-time-tracker"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

### Verify

After installing, confirm two things:

- Manifest exists at `<plugin-folder>/.codex-plugin/plugin.json`
- Default `hooks/hooks.json` exists so current Codex hosts discover lifecycle tracking without an extra manifest field
- A marketplace file includes an entry pointing to the plugin folder

For development or QA of the hook itself, run the local regression check:

```bash
cd ~/plugins/quarryfi-time-tracker
bash -n hooks/track-session.sh
node tests/hook-regression.mjs
```

The regression test uses a temporary `~/.quarryfi/config.json` and a fake `curl` executable, so no network request is made. It verifies that Codex hook events send source `"codex"` payloads to matching profiles with plugin version, runtime channel, hook mode, and install revision diagnostics. GitHub Actions runs the same check on pushes and pull requests.

## Configuration

This plugin shares `~/.quarryfi/config.json` with the Claude Code plugin. If you use both tools, you only need to configure once.

### Quick Setup

```bash
cd ~/plugins/quarryfi-time-tracker
bash setup.sh
```

The setup wizard hides key input and writes an owner-only local config. You'll need a seat-assigned API key from **Tracking integrations and API keys** on your [QuarryFi Workspace dashboard](https://quarryfi.com/dashboard/team#tracking-plugins). Run setup in a regular terminal; do not paste the key into a Codex conversation.

Tracker keys and accepted heartbeats require an active QuarryFi Core subscription. You can create and explore a Free account before upgrading, but Free accounts cannot generate new tracker keys.

### Config Format

```json
{
  "profiles": [
    {
      "name": "Acme Corp",
      "api_key": "qf_...",
      "api_url": "https://quarryfi.com",
      "projects": ["/Users/me/work/acme-api", "/Users/me/work/acme-frontend"],
      "codex_default_project": "/Users/me/work/acme-api"
    },
    {
      "name": "Personal",
      "api_key": "qf_...",
      "api_url": "https://quarryfi.com",
      "projects": []
    }
  ]
}
```

Each profile maps an API key to specific project directories. When a hook fires, the script matches the current working directory against profiles and sends heartbeats for all matching profiles to `https://quarryfi.com`.

The plugin accepts both `"projects"` and `"project_dirs"` arrays so it can share configuration with the Claude Code tracker. For Codex Desktop sessions that report a display-name workspace instead of a real project path, set `"codex_default_project"` on a single-company profile. The hook will use that path for project metadata and routing when the reported Codex cwd does not match any configured project.

### Multi-Company Setup

If you work for multiple companies, each with their own QuarryFi account:

1. Run `setup.sh` and create a profile for each company
2. Add the project directories you work on for each company
3. Leave `"projects": []` on one profile to use it as a catch-all for unmapped directories

**How routing works:**

- The plugin checks your current working directory against each profile's `projects` list
- Match is **prefix-based** — `/Users/me/work/acme` matches `/Users/me/work/acme-api/src/`
- A heartbeat is sent to **every** matching profile (a directory can match multiple profiles)
- If no profiles match, the heartbeat is silently skipped
- Profiles with an empty `projects` array match all directories (catch-all)

**Example:** A freelancer working for Acme Corp and Beta Inc:

```json
{
  "profiles": [
    {
      "name": "Acme Corp",
      "api_key": "qf_acme_key_here",
      "api_url": "https://quarryfi.com",
      "projects": ["/Users/me/clients/acme"]
    },
    {
      "name": "Beta Inc",
      "api_key": "qf_beta_key_here",
      "api_url": "https://quarryfi.com",
      "projects": ["/Users/me/clients/beta"]
    }
  ]
}
```

### Backward Compatibility

The old single-key format is still supported:

```json
{
  "api_key": "qf_...",
  "api_url": "https://quarryfi.com"
}
```

When detected, it is treated as one profile that matches all projects. Released builds ignore legacy custom `api_url` values and always use `https://quarryfi.com`, preventing a modified config from redirecting a seat key. Running `setup.sh` can replace the legacy config with the current multi-profile format after explicit confirmation.

## What It Tracks

- **Session duration** — start and end of each Codex task/session
- **Project name** — derived from your working directory
- **Editor type** — Codex CLI or Codex App
- **Branch** — current git branch
- **Language** — best-effort detection from project files
- **Runtime diagnostics** — plugin version, runtime channel, hook mode, and install revision so QuarryFi can tell a stale install from a healthy one
- **Update cues** — QuarryFi can return a non-blocking version notice after a successful heartbeat; the hook shows it once per release and automatically removes local notice markers after 30 days

### Audit Log

Every heartbeat is appended to `~/.quarryfi/audit.log` as one JSON line per event:

```json
{"ts":"2026-04-08T12:00:00Z","profile":"Acme Corp","api_url":"https://...","http_status":"200","payload":{...}}
```

- Capped at 1MB (older entries are automatically rotated out)
- Fire-and-forget — audit logging never blocks or errors the hook
- Useful for debugging and verifying heartbeats are being sent

### Local retention and removal

- The audit log is capped at 1MB and rotates older entries automatically.
- Per-project session markers are removed when a tracked session ends; stale update-notice markers are removed after 30 days.
- Profile configuration and tracker keys remain on the device until the user replaces or deletes `~/.quarryfi/config.json`.
- To remove all local QuarryFi tracker state after uninstalling the plugin, delete `~/.quarryfi/`. This removes the saved keys, audit log, and session markers from that device; account-side deletion remains available through QuarryFi support and the product's privacy process.

### Privacy

- Only project-level metadata is sent (project name, branch, duration, Git HEAD, hashed repository identity, changed-file count, and coarse activity category) plus minimal runtime diagnostics (plugin version, runtime channel, hook mode, install revision)
- Source code, diffs, prompts, commands, command output, raw repository URLs, filenames, local paths, and AI responses are never transmitted
- Network requests go only to `https://quarryfi.com`; legacy custom endpoint values are ignored
- All tracking runs silently — errors never interrupt your workflow
- The local audit log stays on your machine and is never transmitted

## How It Works

The plugin hooks into Codex lifecycle events and keeps a 60-second timer alive while the session is active. The timer expires after five minutes without a real Codex lifecycle event, which bounds abandoned-session traffic if Codex exits without delivering `Stop`. Timer ownership includes the installed hook revision, so a newly loaded release supersedes a legacy timer instead of allowing both to run.

| Event | Action |
|-------|--------|
| `SessionStart` | Sends a session-start heartbeat and starts the timer |
| `PostToolUse` / `UserPromptSubmit` | Flushes recent activity without double-counting |
| `Stop` | Sends the final heartbeat and clears timer state |

Heartbeats are sent to `POST /api/heartbeat` with source `"codex"`. Multiple profiles are dispatched concurrently. The foreground hook waits only for the network sends it started, while the bounded 60-second timer continues separately in the background; this keeps hooks from hanging without allowing an orphaned timer to run indefinitely.

For stronger evidence reconciliation, each heartbeat can include the current Git commit SHA, a one-way hash of the GitHub `owner/repository` name, a changed-file count, and a coarse activity category. The plugin does not send source code, diffs, prompts, commands, command output, raw repository URLs, filenames, or local paths.

Codex hook trust is hash-based. If the plugin updates its hook file, Codex can show the plugin as installed while skipping the changed hooks until they are reviewed. In Codex CLI, run `/hooks` when available, review the QuarryFi hooks, and trust the updated commands. In Codex App, restart the app after updating the plugin so the current hook registration and trust prompts load into a fresh session.

## Skills

### quarryfi-status

Check your tracking status from within Codex:

> "Check my QuarryFi R&D tracking status"

Shows all configured profiles, matched projects, seat-scoped tracking stats from QuarryFi, the local installed plugin version, and whether any hook fired in the current session.

If QuarryFi shows Codex as `stale` while Claude Code is active, update this plugin, restart Codex, review/trust updated hooks if prompted, then run the status check again after a new Codex action. A healthy Codex status should show source `codex`, a recent `lastHeartbeatAt`, and plugin version `0.4.6` or newer.

### quarryfi-update

Update the plugin to the latest version without leaving Codex:

> "Update QuarryFi plugin"

Pulls the latest changes from GitHub into the local plugin folder Codex is using, shows what changed, and reminds you to restart the Codex App. No need to open a terminal, but the restart still matters because personal plugins do not hot-reload mid-session.

## Updating a GitHub development install

Local Git-backed Personal Plugins do not pull new releases in the background. To update:

**From inside Codex** (easiest): just ask "Update QuarryFi plugin" — the `quarryfi-update` skill handles it.

**From a terminal**:
```bash
cd ~/plugins/quarryfi-time-tracker
git fetch origin
git pull origin main
```

After either method, fully quit and restart the Codex App to load the new version. Personal plugin hooks do not hot-reload into already-running Codex sessions.

To confirm the update took effect:

```bash
jq -r '.version' ~/plugins/quarryfi-time-tracker/.codex-plugin/plugin.json
tail -n 20 ~/.quarryfi/audit.log
```

Then ask Codex: "Check my QuarryFi R&D tracking status". The dashboard/API should show a recent Codex heartbeat after the next hook event.

If you installed the plugin from a repo-local `plugins/quarryfi-time-tracker` folder instead of `~/plugins`, update that clone instead.

## Plugin Structure

```
codex-plugin/
├── .codex-plugin/
│   └── plugin.json          # Plugin manifest (Codex spec)
├── hooks/
│   └── track-session.sh     # Lifecycle event handler (multi-profile)
├── skills/
│   ├── quarryfi-status/
│   │   └── SKILL.md          # Status check skill
│   └── quarryfi-update/
│       └── SKILL.md          # Self-update skill
├── setup.sh                  # Interactive profile setup
└── README.md
```

## Compatibility Note

Codex's plugin system is actively evolving. The hook system in this plugin follows the documented lifecycle events. If Codex updates its plugin API, this plugin may need updates — check the [Codex plugin docs](https://developers.openai.com/codex/plugins/build) for the latest specification.

## License

MIT
