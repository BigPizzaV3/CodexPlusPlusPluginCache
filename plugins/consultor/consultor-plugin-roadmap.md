# Consultor Plugin Roadmap

This roadmap captures the ideas discussed for evolving `consultor` from a skill package into a fuller local-first consulting plugin.

## Current Version

Current version is `0.1.2` in both manifests.

Current scope:

- Local plugin named `consultor`.
- Portable Agent Plugins v1.0.0 manifest at root `plugin.json`.
- OpenAI/Codex Directory presentation manifest at `.codex-plugin/plugin.json`.
- Multiple consulting skills.
- Shared Markdown templates.
- Local audit script.
- Local init / resume script.
- Local final report script.
- Competitive research skill and template.
- Pricing strategy skill and template.
- Value proposition skill and strengthened templates.
- Customer research skill and templates.
- Offer design, landing copy, DAFO builder, canvas builder, and workshop facilitator skills.
- Customer extraction and competitive table scripts.
- Local handoff package script.
- No external apps, MCP servers, OAuth, or required connectors yet.

## Agent Plugins Compliance

Status: implemented and revalidated on 2026-08-24 for the current local-first package and OpenAI Directory upload flow.

Consultor now follows the Agent Plugins v1.0.0 portable package expectations that apply to a skills-only plugin:

- Root manifest exists at `plugin.json`.
- Root manifest declares `$schema` as `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`.
- Root manifest uses only Agent Plugins core fields and passes the closed v1.0.0 schema.
- OpenAI presentation fields live only under `.codex-plugin/plugin.json.interface`.
- Skills are discoverable at `skills/*/SKILL.md`.
- All 18 skill directory names match their frontmatter `name` fields and pass the official Agent Skills `skills-ref` validator.
- Skill descriptions are non-empty and within the Agent Skills limit.
- Optional script requirements are declared with `compatibility` in the skills that invoke them.
- Shared scripts and templates are referenced using paths relative to each skill root and remain inside the plugin root.
- No `mcp.json` is present because the plugin does not currently ship MCP servers. This is intentional and valid.
- The package contains no symlinks, so no packaged path can resolve outside the plugin root.
- The MIT `LICENSE` file matches the manifest license declaration, and `THIRD_PARTY_NOTICES.md` records the Font Awesome logo attribution and license.
- The published v1.0.0 specification is targeted. The upstream v1.1.0 working draft is monitored but intentionally not used.
- The OpenAI/Codex manifest supplies the public name `Consultor`, category, descriptions, developer, capabilities, legal URLs, starter prompts, brand color, composer icon, and logo.

Compliance guardrails:

- Do not add `skills`, `interface`, `apps`, `mcpServers`, hooks, or client presentation fields to root `plugin.json`; portable components remain in their fixed Agent Plugins locations.
- Keep OpenAI listing fields inside `.codex-plugin/plugin.json.interface`, which is the path consumed by the Directory ingestion contract.
- If adding MCP later, use root `mcp.json` with `$schema` set to `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`.
- If adding portable MCP script commands later, keep plugin-relative paths inside the plugin root and use `./` or supported `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` placeholders according to the MCP field rules.
- If adding client-specific portable metadata later, put it under `extensions` using a verified reverse-domain namespace.
- Keep skill resource references relative to the skill root. Do not introduce hardcoded installation paths.
- Re-run both the Agent Plugins JSON Schema validation and the Agent Skills `skills-ref` validation before every release.

Release verification completed for v0.1.0:

- Root `plugin.json` validates unchanged against `schemas/1.0.0/plugin.schema.json` from the official `agentplugins/agent-plugins-spec` repository.
- `.codex-plugin/plugin.json` passes OpenAI's current plugin ingestion validator.
- Every immediate child of `skills/` contains one valid `SKILL.md`.
- All local Markdown resource links resolve inside the plugin package.
- All six bundled Python helpers compile and complete their command-line smoke tests on Python 3.11+.
- The release ZIP contains one top-level `consultor/` directory, the strict root `consultor/plugin.json`, the OpenAI client manifest at `consultor/.codex-plugin/plugin.json`, no `mcp.json`, no symlinks, and no cache or temporary files.

## Implemented

### Multiple Skills

Status: implemented in v0.1.

Skills:

- `consultor-workshop`
- `marketing-grill`
- `business-model`
- `value-proposition`
- `positioning`
- `go-to-market`
- `competitive-research`
- `pricing-strategy`
- `customer-research`
- `experiment-plan`
- `sales-objections`
- `offer-design`
- `landing-copy`
- `dafo-builder`
- `canvas-builder`
- `workshop-facilitator`
- `strategy-synthesis`
- `resume-consultor`

### Templates and Live Documents

Status: implemented in v0.1 local-first.

Existing templates:

- DAFO / SWOT
- Business Model Canvas
- Cliductes
- Positioning
- Segments
- Value proposition
- Competition
- Channels
- Funnel
- Pricing
- Messaging
- Experiments
- Decisions
- Campaign brief
- Consultor audit
- Value Proposition Canvas
- Value proposition
- ICP / persona
- Messaging house
- Go-to-market plan
- Competitive research
- Pricing strategy
- Customer research
- Interview guide
- Offer design
- Landing copy
- Workshop checklist
- Pricing experiment
- Final consulting report

Future optional extensions:

- Optional external export targets such as Google Docs or Slides.

### Project Memory / State

Status: implemented in v0.1.

Current convention:

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

Implemented:

- `scripts/consultor_init.py`
- `resume-consultor` skill
- Base templates for context, assumptions, risks, and strategy summary
- Phase-aware resume rules
- Superseded decisions section in `decisions.md`

### Scripts of Analysis

Status: implemented in v0.1 local-first.

Implemented script:

- `scripts/consultor_audit.py`
- `scripts/consultor_init.py`
- `scripts/consultor_report.py`
- `scripts/consultor_customer_extract.py`
- `scripts/consultor_competitive_table.py`
- `scripts/consultor_package.py`

Current output:

- Clarity score.
- Confirmed decisions.
- Active hypotheses.
- Evidence.
- Risks.
- Open questions.
- Experiments.
- Immediate actions.
- Potential contradictions.
- `Assumption -> Evidence -> Risk -> Experiment` map.
- Optional JSON output.
- Area scores.
- Risk categories.
- Audit modes: full, executive, workshop.
- Report modes: full, compact, workshop, board, investor, launch.

Future optional extensions:

- Better semantic contradiction detection would require a model or deeper NLP and is deferred.

## Backlog

### 1. Stronger Exportable Artifacts

Goal: make Consultor produce useful consulting deliverables, not just working notes.

Possible artifacts:

- DAFO / SWOT.
- Business Model Canvas.
- Value Proposition Canvas.
- ICP / persona.
- Positioning document.
- Messaging house.
- Go-to-market plan.
- Experiment checklist.
- Final Markdown report.
- Optional Google Docs / Slides export later if connectors are available.

Suggested implementation:

Status: implemented in v0.1 local-first.

Future optional extensions:

1. Optional Google Docs / Slides export if connectors are enabled later.
2. Optional model-assisted prose rewrite for final report synthesis.

Implemented local handoff:

- `scripts/consultor_package.py`

### 2. Analysis Scripts

Goal: give the plugin repeatable analysis that a plain skill does less reliably.

Ideas:

- Clarity score by project area.
- Risks by category.
- Hypotheses pending validation.
- Unanswered questions.
- Contradiction scan.
- `Assumption -> Evidence -> Risk -> Experiment` map.
- Workshop-readiness score.
- Investor-readiness or launch-readiness score.

Status: implemented as local scripts.

Future optional extensions:

- Optional model-assisted contradiction detection.

### 3. More Specialized Skills

Goal: keep the plugin modular as consulting work branches.

Status: implemented in v0.1.

Implemented:

- `dafo-builder`
- `canvas-builder`
- `landing-copy`
- `offer-design`
- `workshop-facilitator`

### 4. Project Memory and Resume Mode

Goal: make Consultor resume sessions without asking everything again.

Current idea:

- Use project files as memory, not global hidden memory.

Core files:

- `consultor/context.md`
- `consultor/assumptions.md`
- `consultor/decisions.md`
- `consultor/risks.md`
- `consultor/strategy/*.md`
- `consultor/marketing/*.md`
- `consultor/sales/*.md`
- `consultor/experiments/*.md`
- `consultor/reports/*.md`

Status: implemented in v0.1.

Implemented:

- Phase-aware resume.
- Audit-first resume.
- Superseded decision handling section.

### 5. Connectors

Goal: use external systems when they add real value.

Candidate connectors:

- Google Drive / Docs / Slides: final documents and decks.
- Gmail / Calendar: customer interview prep and follow-up.
- Slack / Teams: internal feedback synthesis.
- Notion / Atlassian: project knowledge and planning.
- Web/search: competitor, pricing, and market research.

Suggested stance:

- Do not add connectors until local workflows are stable.
- Prefer optional connector use through host capabilities before bundling MCP or app integrations.

Status: intentionally deferred.

Reason:

- The plugin is local-first and does not require accounts, OAuth, apps, or MCP servers.
- Host-provided connectors can still be used by the agent when available.

### 6. External Research

Goal: make Consultor investigate the market instead of only asking the user.

Research tasks:

- Find competitors.
- Compare claims.
- Detect pricing.
- Review landing pages.
- Extract copy patterns.
- Build positioning tables.
- Identify alternatives and substitutes.

Suggested implementation:

Status: implemented in v0.1 local-first.

Implemented:

- `competitive-research` skill.
- `competitive-research.md` template.
- Source citation and Verified / Assumption / Hypothesis rules.

Future optional extensions:

1. Optional richer source ingestion.
2. Optional model-assisted research synthesis.

### 7. Workshop Mode

Goal: turn Consultor into a repeatable consulting process.

Proposed phases:

1. Interrogation.
2. Contradictions.
3. Synthesis.
4. Artifacts.
5. Validation plan.
6. Resume from generated files next session.

Status: implemented in v0.1.

Implemented:

- Explicit phase state in `consultor/context.md`.
- `workshop-checklist.md` template.
- `workshop-facilitator` skill.
- Audit script integration at the start and end of workshops.

## Recommended Implementation Order

1. Optional: add connector workflows for Google Docs / Slides when desired.
2. Optional: add model-assisted synthesis for final report prose.
3. Optional: add deeper semantic contradiction detection.

## Notes

- Keep v1 local-first.
- Avoid decorative frameworks.
- Do not create empty files.
- Generated documents should use the user's or project's language.
- External market facts must be verified and cited.
- Recommendations are allowed in most Consultor skills when useful, but `marketing-grill` remains interrogative and does not recommend unless explicitly asked.
