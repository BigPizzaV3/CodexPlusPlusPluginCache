# Marketing Swarm

A ChatGPT/Codex Plugin distilled from the marketing-agent architecture in `ruvnet/marketing`.

The upstream project models fifteen specialist agents across coordination, intelligence, creative, attribution, and operations. This Plugin does not expose fifteen thin Skills one-for-one. It groups the reusable user-facing jobs into a smaller set of substantial workflows with a router, evidence rules, and explicit execution boundaries.

## What it does

Marketing Swarm helps with:

- paid-media account and campaign diagnosis
- spend risk, pacing, and anomaly review
- cross-platform budget scenario planning
- creative pattern and message analysis
- creative fatigue and refresh planning
- scenario and sensitivity analysis
- causal attribution and incrementality review
- comparison against prior campaign evidence
- quality control before recommendations are treated as decisions

## Architecture

The Plugin is intentionally `skills-only`.

```text
marketing-swarm-router
  |-- campaign-diagnostics
  |-- budget-media-allocation
  |-- creative-genome-analysis
  |-- creative-fatigue-mutation
  |-- scenario-simulation
  |-- causal-attribution
  |-- marketing-memory
  `-- decision-quality-gate

utilities
  |-- host-workspace-operator
  `-- sandbox-python-executor
```

This boundary is deliberate. The upstream repository contains runtime code and platform-integration concepts, but a public Skill must not pretend it owns ad-account permissions. If the current ChatGPT/Codex host has an authorized advertising app, a Skill may use it according to that app's permissions. Otherwise, Marketing Swarm analyzes supplied exports, files, reports, or user-provided figures and returns recommendations only.

## Decision rule

Every recommendation should distinguish:

1. observed evidence
2. calculated metric
3. inference
4. assumption
5. proposed test or action
6. expected impact range, when evidence supports one
7. confidence and what would change the conclusion

No live spend, bid, targeting, creative, or campaign mutation is implied by the Plugin package itself.

## Inputs

Useful inputs include CSV exports, platform reports, campaign tables, creative-level performance, funnel metrics, attribution exports, holdout results, experiment designs, briefs, and historical performance notes.

The Plugin can still work with incomplete data. It should identify the missing fields that materially constrain the answer instead of inventing them.

## Provenance

This conversion is based on the MIT-licensed `ruvnet/marketing` repository and preserves its domain concepts while adapting them to the OpenAI Plugin/Skill model. See `NOTICE.md` and `docs/source-map.md`.

## Validation

Run:

```bash
python3 tests/test_plugin_structure.py
python3 tests/test_skill_quality.py
```

For release preparation, validate and package with Plugin Autopilot's current `validate_plugin.py` and `package_plugin.py` as well.

## Submission status

This package is prepared as a local Plugin artifact. Public Plugin Directory submission remains a separate step because verified publisher identity and final public policy/support metadata must be confirmed in the publisher account.
