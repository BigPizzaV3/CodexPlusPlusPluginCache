# BrowserAct Codex plugin

Codex Skills for browser automation and reusable website-skill generation with the [Browser Act CLI](https://pypi.org/project/browser-act-cli/).

The repository root is the plugin root. Its `skills/` directory contains exactly the two Skills below.

## Skills

| Skill | Purpose |
|---|---|
| `browser-act` | Runs a browser to extract rendered website data, interact with pages, and capture screenshots. |
| `browser-act-skill-forge` | Explores a website's implementation path, then generates and verifies reusable, site-specific Skill packages. |

`browser-act` is a browser automation Skill that uses the BrowserAct CLI to extract rendered website data, perform page interactions, and capture screenshots.

```bash
browser-act get-skills core --skill-version 2.0.2
```

`browser-act-skill-forge` is for reusable work rather than one-off extraction. Its `references/` directory is part of the Skill and defines the exploration and output format used when generating site-specific packages.

## Requirements

- Python 3.12.x
- [`uv`](https://docs.astral.sh/uv/)
- `browser-act-cli`

Install the CLI when it is not already available:

```powershell
uv tool install browser-act-cli --python 3.12
```


## Repository contents

The plugin's runtime content is `.codex-plugin/`, `assets/`, `skills/`, `README.md`, and `LICENSE`. This repository does not include a local Marketplace configuration, packaging script, or validation script.

## License

MIT — see [LICENSE](LICENSE).
