# Architecture

## Switching value and task continuity

Routing occurs at meaningful task boundaries, not every prompt. Context placement remains
owned by the context router; the model router consumes the effective placement and continuity
rationale. A declined handoff uses the retained conversation, and context-off does not imply
that its suitability was assessed. Neither router is renamed.

The model router first selects minimum-sufficient and recommended settings for the task.
`upgrade_value` compares those two settings. It then evaluates `switch_assessment`: the
benefit of moving from the observed current pair to the recommended pair versus retaining it
for the same remaining phase. Suitable settings may be retained even if a stronger candidate
has capability value. Reassessment after a hard phase does not mandate a downgrade.

Account for remaining work, setup, cache reuse, latency, retries, rework and handoff costs.
Prompt-cache state and supplied conversation content are distinct; a cache miss does not
remove history, a new conversation is not a free switch, and changing effort can also affect cache
reuse under platform-specific rules. Unknown current settings defer automatic switching but
do not suppress concrete task-based recommendations. Unknown cache cost is neither zero nor
certain cache loss; a clear quality deficit can still justify change. Explicit user targets
take precedence without creating missing host controls.

In `auto`, only a justified `decision: change` can proceed to authorized, callable, verified
application. `ask` confirms proposed changes or material blockers; retain and nonblocking
defer continue only authorized work. `off` skips its router. The action-first UX contract
separates task-fit settings from the action now and keeps switch scoring internal. This applies to the shared
policy and both Gemini runtime projections, without a new service or persistent activity log.

Evaluation should compare task completion, quality, corrections, rework, latency and total
workflow cost, including cache usage when observable. Separate API billing from subscription
usage, avoid double-counting cache processing, and report unknown measurements honestly.
The new switch cases are acceptance fixtures, not proof of live host behavior or savings.

## Design goal

Adaptive Task Routing reduces avoidable context and compute use without allowing a routing recommendation to silently exceed user intent or host capability.

The plugin contains one thin coordinator, two independent decision skills, and one shared execution policy:

```text
task request
    │
    ▼
requested analysis or plan
    │
    ▼
adaptive-task-routing (loads and sequences the children)
    │
    ▼
task-context-router ──► context recommendation
    │                   CURRENT / HANDOFF / CLEAN
    ▼
resolve context using user mode + runtime capability
    │
    ▼
research-model-router ─► minimum sufficient + recommended model/effort pairs
    │
    ▼
resolve action + pending decision + task authorization
    │
    ▼
execute the next phase when authorized
```

## Responsibility boundary

| Component | Owns | Does not own |
|---|---|---|
| `adaptive-task-routing` | Gate timing, loading children, sequence, combined visible output | Context judgment, model judgment, independent autonomy mode |
| `task-context-router` | Context continuity, handoff, isolation | Model choice, research execution |
| `research-model-router` | Minimum sufficient and recommended model/effort pairs, plus upgrade value | Context creation, research execution |
| Shared runtime policy | Capability detection, control modes, executor resolution, persistence | Task-specific routing judgment |

Keeping the routers separate permits configurations such as `context_mode: auto` with `model_mode: ask` when context creation is callable but current-model changes are user-only.

The coordinator follows relative links to the packaged child `SKILL.md` files, or host-provided skill resources when local files are unavailable. During a coordinated run, children do not call each other or the coordinator. A child selected directly for a general task dispatches once to the coordinator; coordinator-delegated markers prevent recursion. Explicit context-only or model-only requests stay scoped to that component. A missing child produces an explicit incomplete-gate status rather than a fabricated result.

## Trigger and gate lifecycle

Explicitly selecting the coordinator runs the full workflow. The generated packages also use a host-native reminder: Codex and Claude Code inject one short instruction on `UserPromptSubmit`, while Gemini CLI loads an extension `GEMINI.md` at session startup. Codex and Claude invoke the coordinator for a qualifying next phase. Gemini applies a complete compact coordinator contract embedded in its startup context because CLI 0.59.0 can expose `activate_skill` to the model while failing its execution with `tool_not_registered`. All three surfaces present the requested analysis or plan before routing advice. A child's one-time dispatch guard recovers when a host nevertheless selects it for a general task.

For an analysis-only or plan-only request, finish and present the authorized deliverable first, then route a concrete substantial next phase before yielding. For an execution request, present a concise actionable plan first and route before mutation or substantial execution. `ask` pauses only before a proposed change or a material blocker; retain and nonblocking defer continue authorized work. Model `auto` may apply supported changes and continue. A final answer with no concrete substantial next phase ends normally. At later stage changes, present the completed phase's results first, then re-run model routing alone unless context also needs reconsideration.

Reuse a completed gate while phase, effective context, preferences, catalog, and capabilities are unchanged. If both modes are `off`, skip evaluation, probing, and output. If only one is off, the other remains active. Context-off uses the current context; model-off retains current settings. Retaining a setting does not request confirmation; task authorization is checked separately.

If the user declines a context change in `ask`, model routing evaluates the current effective context. If a destination is pending and its model catalog is unknown, display the model gate as deferred and show observable current settings; revalidate in the destination before work starts. Do not silently drop the second gate or call it complete.

## Visible model result

An enabled model invocation records both task settings and evidence internally, then renders an action, reason and useful native AI setting. Mode and diagnostic availability are omitted from ordinary compact output. Verified keep shows only the observed current AI; task-fit alternatives belong in details. `CURRENT` with known suitable settings is distinct from provisional retention with `assessment: unverified`. A supported catalog does not reveal the current running model. Unknown controls must not become invented names, settings, menu labels, or commands.

The output schema can be rendered as a short note. After the task findings or plan, each note begins with a Markdown divider, a plain `Adaptive Task Routing` heading, then the action and a short reason, followed by enabled conversation advice and useful settings. Stable context enums remain in structured evidence; visible output renders a plain recommendation in the user's language without the raw enum. `off` is the deliberate exception to visibility; a disabled router makes no decision.

## Three-layer resolution

Every decision separates:

1. **User policy** — what level of autonomy the user permits.
2. **Runtime capability** — what the present surface and permissions can actually do.
3. **Routing recommendation** — what best fits the upcoming task phase.

Only after all three are known is an executor selected. Unknown capability falls back to user operation. A change is reported as `applied` only after the host confirms it.

Version 0.3.1 resolves each operation separately instead of assigning one capability to an entire surface. An App may expose orchestrated context creation while keeping current-model and effort changes user-only; a CLI may also expose a mixed set. An explicit user command supplies authorization but not missing capability. Every automatic operation still must be callable and verifiable.

## Environment lifecycle

The first invocation loads a capability snapshot from a host- or user-managed settings store, then detects missing or stale operations. Each later routing gate checks only freshness. The affected capabilities are re-detected after surface, session, host/plugin, permission, tool, or result changes; a failed automatic operation invalidates its cached capability.

The installed plugin package is not used as mutable state because upgrades may replace it.

The available model catalog has a shorter lifecycle than the capability snapshot. Runtime metadata is preferred and cached for the session or another short host-defined lifetime. A user-provided list is labeled as such; a static fallback must be versioned and expiring. When an OpenAI App cannot expose runtime discovery, the router immediately uses the bundled official cross-surface reference to produce minimum-sufficient and recommended settings without asking for a copied selector. Gemini CLI uses a separate registry of stable aliases and preserves model-native reasoning controls; without an observed `thinkingBudget` or `thinkingLevel`, compact output says the model default is used. Account availability remains unverified. In `ask`, show a control only for a justified change or explicit target; follow the UX contract for continuation or a material blocker. In `auto`, independently verified switch controls may apply the pair; otherwise the control is optional and authorized work continues with the current setting. Unreadable current fields are retained only in structured evidence and omitted from compact output. Catalog, running configuration, model capability evidence and switch capability remain separate.

Permission escalation is deferred until the user questions the recommendation or requests an account-specific check. The router first discloses its evidence and limits. It may then ask once for the smallest useful read permission, but only when a concrete path can reach the same App or session model catalog. Access to a separate CLI process does not satisfy that condition. A refusal keeps the fallback result and suppresses repeat requests until the relevant environment or user request changes.

## Cross-platform strategy

Version 0.4.2 separates task requirements from candidate mapping and adds automatic
activation reminders. Discovery observations
carry source/time/scope/status; persisted thread values and disk defaults never fill
unknown live fields. Official descriptions are capability evidence, not account catalogs
or measured task rankings. Only applicable options can become concrete recommendations.
The [host guides](../shared/host-discovery.md) are loaded on demand. The optional Codex
helper performs bounded read RPCs; it does not decide, resume threads or switch models.
Claude/Gemini use their own live metadata or selector guidance. A new CLI process is
not the App connection. Read and write capabilities are resolved independently.

The repository root owns the only maintained `skills/` and `shared/` sources. Skill names remain stable; frontmatter descriptions and their checked trigger contract distinguish the primary coordinator from component-only children. Bodies and translations evolve together. `release.json` owns release identity, version and presentation. `scripts/release_lib.py` translates it into platform manifests at build time:

- OpenAI: root `plugin.json` (Agent Plugins schema; `extensions.com.openai.interface`) and `.codex-plugin/plugin.json` compatibility fallback with a `UserPromptSubmit` hook.
- Claude: `.claude-plugin/plugin.json` plus `hooks/hooks.json`.
- Gemini: root `gemini-extension.json` plus a self-contained `GEMINI.md`, selected by `contextFileName`.

`scripts/build_release.py` creates three staging trees at `dist/<platform>/adaptive-task-routing` and three root-layout ZIPs. Common documentation is included by explicit file list; each platform README comes from `packaging/<platform>/README.md`. Build/test executables are excluded. The one allowed executable source is the optional on-demand Skill helper. Automatic activation uses declarative context or a fixed shell-output hook; it does not probe metadata, start a service, or execute the routers itself.

There is no fourth marketplace archive. Local marketplace registration is a separate host setup step. The validator checks relative references, frontmatter, preserved triggers, automatic activation definitions, shared files, versions, platform manifest boundaries, staged bytes, ZIP members and SHA-256. Rebuilds use fixed archive metadata. Previous dist trees are preserved outside dist in `.release-backups/`. File validation proves that the reminder and both Gemini contract projections are packaged, but installed-host tests are still required to prove that the host delivered and followed the reminder or switched settings.

## Defaults

Both routers default to `ask`, which confirms changes and material blockers. Retain/nonblocking defer continue only authorized work. A plan-only request ends with its deliverable, never implementation. Independent context decisions remain pending even when model settings are retained.

## Action-first UX contract

[The shared UX contract](../shared/routing-ux.md) defines compact/detailed presentation without adding a routing mode. Detailed adds minimum needed, task-fit settings and upgrade rationale; both task settings remain in structured evidence. Unknown current metadata uses provisional retention, never a suitability claim. A material blocker is distinct from merely deferring a switch. Handoff/clean can coexist with model changes, and the enabled conversation advice stays visible. Gemini embeds this same contract in both its startup context and coordinator appendix.
