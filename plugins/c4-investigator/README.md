# c4-investigator

`c4-investigator` is a skill-only Codex/ChatGPT plugin for guided, evidence-led cryptocurrency and cyber-enabled investigations. The first skill, `c4-fake-trading-app-investigator`, helps an authorized investigator turn text, audio transcripts, screenshots, payment records, domains, accounts, wallets, and transaction hashes into structured case state, prioritized investigative actions, c4 Lab tool recommendations, candidate Indian-law issue mapping, and review-ready complaint/FIR and investigation-report drafts.

## What v0.1 includes

- multimodal intake and evidence-provenance guidance;
- a continuing case checkpoint with stable evidence and finding IDs;
- fake trading platform hypothesis and alternative-explanation testing;
- manual recommendations for real c4 Lab tools and routes;
- a date- and jurisdiction-sensitive Indian legal verification workflow;
- complaint/FIR brief and investigation-report templates;
- a deterministic checkpoint validator with synthetic tests.

The plugin has no MCP server, authentication, network service, or direct c4 Lab access. The investigator runs any suggested c4 Lab tool and returns the result as a new evidence item.

## Repository layout

```text
.codex-plugin/plugin.json
skills/c4-fake-trading-app-investigator/
  SKILL.md
  agents/openai.yaml
  assets/
  references/
  scripts/
tests/
```

## Validate

From the repository root:

```bash
python3 ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/c4-fake-trading-app-investigator
python3 -m unittest discover -s tests -v
python3 skills/c4-fake-trading-app-investigator/scripts/validate_case_checkpoint.py tests/fixtures/valid_checkpoint.json
```

## Safety and legal boundary

This project supports organization, analysis, and drafting. It does not certify evidence, make legal determinations, register an FIR, authorize coercive action, or replace human forensic, supervisory, prosecutorial, and legal review. Never place private keys, seed phrases, passwords, OTPs, session tokens, or unnecessary personal data into a chat or c4 Lab tool.

All fixtures in this repository are synthetic.

## License

MIT. See `LICENSE`.
