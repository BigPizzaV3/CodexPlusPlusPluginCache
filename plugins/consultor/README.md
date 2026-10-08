# Consultor

Consultor is a strategy consulting plugin for Agent Plugins-compatible agent environments.

It packages multiple skills that interrogate business, marketing, positioning, go-to-market, sales, and validation plans. The goal is not to produce decorative frameworks. The goal is to turn unclear thinking into decisions, hypotheses, evidence, risks, and live working documents.

## Skills

- `consultor-workshop`: Main workshop router and consulting session controller.
- `marketing-grill`: Hard marketing interrogator. One question at a time, no recommendations by default.
- `business-model`: Business model, offer architecture, revenue logic, and cliductes.
- `value-proposition`: Customer jobs, pains, gains, alternatives, promise, mechanism, proof, and value proposition fit.
- `offer-design`: Concrete offer structure, deliverables, scope, onboarding, risk reversal, and why-now.
- `positioning`: Category, alternatives, differentiation, proof, and positioning statements.
- `go-to-market`: Audience path, channels, funnel, launch motion, and distribution.
- `competitive-research`: Source-backed market, competitor, substitute, pricing, claims, and positioning research.
- `pricing-strategy`: Pricing, packaging, tiers, discounts, margin, willingness to pay, risk reversal, and price objections.
- `customer-research`: Interviews, feedback, reviews, quotes, jobs, pains, gains, triggers, objections, and evidence.
- `experiment-plan`: Assumptions, evidence, validation tests, metrics, and decision criteria.
- `sales-objections`: Buyer friction, objections, risk reversal, proof, and sales narrative.
- `landing-copy`: Landing page copy structure from strategy, offer, proof, objections, and CTA.
- `dafo-builder`: Specific, evidence-backed SWOT/DAFO builder.
- `canvas-builder`: Business Model Canvas / Lean Canvas builder.
- `workshop-facilitator`: Repeatable workshop flow across phases.
- `strategy-synthesis`: Consolidates the live documents into risks, decisions, open questions, and action plans.
- `resume-consultor`: Resumes an existing Consultor project from local files and asks the next highest-leverage question.

## Scripts

- `scripts/consultor_audit.py`: Audits live consulting documents and generates a repeatable strategy clarity report.
- `scripts/consultor_init.py`: Initializes the local Consultor workspace and optional base memory files.
- `scripts/consultor_report.py`: Generates a final Markdown consulting report from live documents.
- `scripts/consultor_customer_extract.py`: Extracts customer research signals from transcripts, notes, reviews, or support text.
- `scripts/consultor_competitive_table.py`: Normalizes competitor CSV or loose notes into a Markdown comparison table.
- `scripts/consultor_package.py`: Packages Consultor project documents into a handoff ZIP.

Examples use `<plugin-root>` for the installed plugin directory. Resolve it to the actual package root before running a helper script.

Run it from any project:

```bash
python3 <plugin-root>/scripts/consultor_audit.py .
```

Useful options:

```bash
python3 <plugin-root>/scripts/consultor_audit.py . --stdout
python3 <plugin-root>/scripts/consultor_audit.py . -o consultor/reports/audit.md
python3 <plugin-root>/scripts/consultor_audit.py . --json consultor/reports/audit.json
python3 <plugin-root>/scripts/consultor_audit.py . --mode workshop --stdout
```

Initialize or resume a project:

```bash
python3 <plugin-root>/scripts/consultor_init.py . --base-files --resume-note
python3 <plugin-root>/scripts/consultor_audit.py . --stdout
```

Generate a final report:

```bash
python3 <plugin-root>/scripts/consultor_report.py .
python3 <plugin-root>/scripts/consultor_report.py . --stdout
python3 <plugin-root>/scripts/consultor_report.py . --mode board --stdout
python3 <plugin-root>/scripts/consultor_report.py . --include-sources
```

Extract research artifacts:

```bash
python3 <plugin-root>/scripts/consultor_customer_extract.py notes.txt --stdout
python3 <plugin-root>/scripts/consultor_competitive_table.py competitors.csv --stdout
```

Package a handoff:

```bash
python3 <plugin-root>/scripts/consultor_package.py .
```

## Version 0.1 Scope

This plugin is local-first. It includes skills, templates, and a local audit script. It does not include apps, MCP servers, OAuth, or external connectors.

It can still use whatever capabilities the host environment already provides, such as file access, web research, or connected document tools, but the plugin itself does not require those integrations.

## Agent Plugins Compatibility

Consultor uses the Agent Plugins v1.0.0 package layout plus the OpenAI/Codex client manifest required for a branded OpenAI Directory listing.

- `plugin.json` is the portable Agent Plugins manifest and validates against the closed v1.0.0 schema.
- `.codex-plugin/plugin.json` is the OpenAI/Codex client manifest containing Directory presentation metadata.
- `skills/*/SKILL.md` contains the bundled skills discovered by Agent Plugins clients.
- `mcp.json` is intentionally absent because Consultor currently ships no MCP servers.
- Shared resources stay inside the plugin root and are referenced from each skill using paths relative to its `SKILL.md`.
- `LICENSE` contains the MIT terms declared by the manifest; `THIRD_PARTY_NOTICES.md` documents the Font Awesome icon license.
- `.codex-plugin/plugin.json.interface` contains the listing metadata consumed by OpenAI, including the composer icon and logo.

The published Agent Plugins schema is closed and does not standardize the top-level `interface` field. OpenAI ignores that field when it appears in the root manifest and reads presentation metadata from `.codex-plugin/plugin.json` instead. The duplicated identity fields in both manifests are intentionally kept identical so the Agent Plugins root remains authoritative during OpenAI's compatibility conversion.

The package targets the v1.0.0 core because it is the current published specification. Agent Plugins v1.1.0 exists upstream only as a working draft and is not targeted by this release.

## Default Workspace

When no existing structure is found, Consultor writes live project documents under:

```text
consultor/
|-- context.md
|-- assumptions.md
|-- decisions.md
|-- risks.md
|-- strategy/
|-- marketing/
|-- research/
|-- sales/
|-- experiments/
`-- reports/
```

Documents should be created lazily. Empty files and empty sections are not useful.

## Stronger Artifacts

Consultor includes templates for richer consulting outputs:

- Value Proposition Canvas.
- Value proposition.
- Offer design.
- ICP / persona.
- Messaging house.
- Go-to-market plan.
- Competitive research.
- Customer research.
- Interview guide.
- Pricing strategy.
- Pricing experiment.
- Landing copy.
- Workshop checklist.
- Final consulting report.
