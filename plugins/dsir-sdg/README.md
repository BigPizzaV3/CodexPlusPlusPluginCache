# DSIR SDG Data Skill

Use natural language to discover and retrieve United Nations Sustainable
Development Goal data. Powered by the data-access and cleaning logic developed
in the DSIR R package. Users do not need R or DSIR.

The skill retrieves public observations from the UN SDG Global Database. It
supports health questions and other SDG topics represented in that database.
It does not query WHO GHO, private WHO data or unrelated data sources.

## Examples

- Compare historical UHC service coverage in China, Japan and the Philippines.
- Get tuberculosis incidence in the Philippines since 2015 from UN SDG.
- Show maternal mortality ratios for Japan since 2000.
- Find the SDG series for under-five mortality rates, both sexes.
- What financial protection measure is currently published under SDG 3.8.2?
- Find the measles second-dose vaccination coverage series.
- Compare safely managed drinking water in urban and rural areas of the Philippines.
- Does UN SDG publish UHC service coverage for the WHO Western Pacific group?

The agent checks the live indicator AND series catalogues, resolves locations,
retrieves all pages, keeps population dimensions and units, performs basic QA,
and produces source-linked results with CSV and JSON downloads. It asks when
different interpretations would materially change the answer.

## Requirements

- A compatible agent that can load a skill or skills-only plugin.
- Python 3.10 or later in the agent execution environment, with standard-library
  script execution. No third-party runtime packages are required.
- Script HTTPS access to `unstats.un.org`, including the UN SDG V5 endpoint.
- A writable output directory.

No R, MCP server, remote service, Azure deployment, API key or end-user data
download is required. The agent runs the bundled helpers. Installation alone
does not grant network permissions or a script runtime; a web-search tool and
the script runtime can have different access rules.

## Packages and installation

- `dsir-sdg-plugin-0.1.0.zip`: plugin upload/distribution artifact with manifest,
  icons and the complete runtime skill. Use this in a supported **plugin upload**
  or publishing workflow; do not treat a normal chat attachment as installation.
- `dsir-sdg-0.1.0.zip`: standalone skill. Extract and place the `dsir-sdg` folder
  (containing `SKILL.md`, `scripts`, `references`, and `agents`) in the host's skill
  directory. For local Codex, use `~/.agents/skills/dsir-sdg/`. File Explorer is
  sufficient on Windows; PowerShell is optional. Start a new conversation.
- `dsir-sdg-0.1.0-source.zip`: maintainer source, tests, R parity harness, recorded
  validation results and reproducible packaging code. R is used only by the
  maintainer parity tests and is excluded from the runtime packages.

In local Codex, ask: `Use $dsir-sdg to retrieve Philippine TB incidence since
2015 from UN SDG.` In ChatGPT accounts where the plugin has been made available,
install it from Plugins, start a new chat, select it with `@`, and ask naturally.
Public listing or workspace distribution is a separate process. This build does
not publish, register a marketplace, or install into an account. Account and
workspace availability must be tested on the actual receiving account.

## Local developer check

From the skill directory, with Python 3.10+:

```text
python scripts/cli.py doctor
python scripts/cli.py search "TB incidence"
python scripts/cli.py describe 3.3.2
python scripts/cli.py get 3.3.2 --locations PHL --year-from 2015 --output-dir outputs/tb-phl
```

Choose a new output directory on each run. Read `response.json` for the full
answer and provenance, and share `observations.csv` for a table that retains
dimensions and units. `dsir_clean.csv` reproduces DSIR's 15-column core and is
intended for parity/interoperation. `raw.json` and `manifest.json` support audit.

## Meaning and limitations

Data source is **UN SDG**, even where WHO is the custodian. UN and WHO GHO releases
can differ. The live catalogue may revise series names, definitions and codes.
In the release checked in September 2026, UHC is labelled 2025 methodology, and
SDG 3.8.2 uses 40% of discretionary household budget. This is not interchangeable
with older 10%/25% total-expenditure measures.

WHO regions and UN geographic regions are different. The live UN catalogue
contains WHO Western Pacific, but area-catalogue presence does not guarantee
observations for every indicator. No regional average or membership history is
calculated. Missing/censored values remain missing/censored; no imputation,
charts or models are included.

The UN service may be slow or temporarily unavailable. Incomplete retrieval
returns a distinct error, never a successful partial table or a claim that the
UN lacks the requested data. Large global queries can exceed bounded limits;
narrowing the geography reduces work. All-year retrieval precedes year and
series filtering to preserve the DSIR endpoint workaround.

## Validation and maintenance

The source package contains `tests/`, `evals/`, `docs/source_audit.md`, and
`reports/VALIDATION.md`. Evaluation includes live catalogue checks, explicit
failure/empty-result tests, original-R parity and independent agent rehearsals.
Automated casebook contracts are not a general language-model accuracy score.

From the source skill directory:

```text
python -m unittest discover -s tests -v
python evals/run_parity.py --live-r
python packaging/build_release.py
```

Inspect `evals/README.md` for casebook commands and report meanings. R parity
requires the maintainer's DSIR reference source; normal use does not.

Official resources:

- UN API: https://unstats.un.org/SDGAPI/swagger/
- UN metadata: https://unstats.un.org/sdgs/metadata/
- Plugin packaging: https://developers.openai.com/plugins/build/plugins
- Plugin publishing: https://developers.openai.com/plugins/deploy/submission

This is a personal DSIR project by Shanlong Ding, not an official UN or WHO service.
