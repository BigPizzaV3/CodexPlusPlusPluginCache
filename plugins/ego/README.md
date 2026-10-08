# ego for Codex

## Requirements

- macOS with ego lite installed and open
- `ego-browser` available on the agent's `PATH`
- An agent host that can read Skills and execute local shell commands

## Installation

The Codex ZIP serves both install routes. `.codex-plugin/plugin.json` and
`skills/` sit at the archive root, and `.agents/plugins/marketplace.json`
points at that same root with `"path": "./"`.

To install locally, extract the ZIP and add the extracted directory:

```bash
codex plugin marketplace add /absolute/path/to/ego-codex
codex plugin add ego@ego-codex-local
```

Restart Codex if the plugin does not appear, then ask it to use `$ego-browser`.
Remove the installed plugin with `codex plugin remove ego@ego-codex-local`.

To publish, upload the same ZIP as a skills-only plugin in the submission
portal and select the verified developer identity that matches `author.name`.
The listing copy comes from the manifest's `interface` object, whose `category`
must be one of the values the portal accepts. See
[Submit plugins](https://developers.openai.com/plugins/deploy/submission) and
the [submission error reference](https://developers.openai.com/plugins/deploy/submission-errors).

See the [OpenAI plugin guide](https://developers.openai.com/plugins/build/plugins).
