---
name: strategy-synthesis
description: Consolidate Consultor sessions into current strategy, decisions, assumptions, risks, evidence gaps, experiments, and action plans.
compatibility: Requires Python 3.11+ only when using the optional bundled audit, report, and packaging helpers.
---

# Strategy Synthesis

Synthesize existing Consultor work into a concise strategic view.

Use this skill when the user asks to consolidate, summarize, produce the final consulting output, create an action plan, or resume from existing Consultor documents.

Do not invent missing strategy. If something is unclear, mark it as an open question or hypothesis.

## Audit Script

When the project has no `consultor/` workspace yet and the user asks to start or resume consulting work, initialize the workspace first:

```bash
python3 ../../scripts/consultor_init.py <project-root> --base-files --resume-note
```

When the user asks for an audit, score, risk map, evidence map, contradiction scan, or a repeatable synthesis of existing Consultor documents, prefer running the local audit script before writing new synthesis:

```bash
python3 ../../scripts/consultor_audit.py <project-root>
```

Use `--stdout` when the user wants to see the report in chat. Use `--mode executive` for short executive audits, `--mode workshop` for workshop preparation, and `-o consultor/reports/consultor-audit.md` when writing the report into the project.

## Final Report Script

When the user asks for a final report, consulting report, executive summary, exportable Markdown deliverable, or artifact package, run:

```bash
python3 ../../scripts/consultor_report.py <project-root>
```

Use `--stdout` when the user wants to see it in chat. Use `--include-sources` when traceability is more important than brevity.

Report modes:

```bash
python3 ../../scripts/consultor_report.py <project-root> --mode compact
python3 ../../scripts/consultor_report.py <project-root> --mode workshop
python3 ../../scripts/consultor_report.py <project-root> --mode board
python3 ../../scripts/consultor_report.py <project-root> --mode investor
python3 ../../scripts/consultor_report.py <project-root> --mode launch
```

The default output is:

```text
consultor/reports/final-consulting-report.md
```

## Handoff Package

When the user asks to package, share, export, or hand off the local Consultor work without using an external connector, run:

```bash
python3 ../../scripts/consultor_package.py <project-root>
```

Resolve script paths relative to this `SKILL.md` file before running them.

## First Step

Inspect existing Consultor or marketing documents before asking the user:

- `consultor/`
- `marketing/`
- `strategy/`
- `docs/`
- `brand/`
- `go-to-market/`
- `campaigns/`

## Output Documents

Use or create these documents only when there is real content to record:

- `consultor/reports/strategy-summary.md`
- `consultor/reports/final-consulting-report.md`
- `consultor/decisions.md`
- `consultor/assumptions.md`
- `consultor/risks.md`
- `consultor/experiments/experiments.md`

## Synthesis Shape

Prefer this shape:

```text
1. Current Best Understanding
2. Confirmed Decisions
3. Active Hypotheses
4. Evidence
5. Strategic Risks
6. Contradictions
7. Open Questions
8. Next Experiments
9. Immediate Actions
```

## Quality Bar

Keep the synthesis short enough to act on.

Separate Verified, Assumption, and Hypothesis. Do not collapse uncertainty into confident prose.
