---
name: research-model-router
description: Model-only child router for substantial coding, debugging, architecture, validation, research, or analysis, and for conversational inspection or changes of the model-routing mode. Use when the user explicitly asks only for model/reasoning advice or mode control, when adaptive-task-routing delegates with a resolved context, or at a later model-only phase transition. For a general task needing both context and model routing, dispatch to adaptive-task-routing instead. Skip ordinary chat and tiny operations; do not choose context.
---

# Research Model Router

Match an upcoming work phase to enough model capability for reliable work without unnecessary time or compute. The historical name is retained for compatibility; the scope includes implementation and validation as well as research and analysis. This skill routes configuration; it does not perform the task itself.

For Traditional Chinese guidance, read [references/zh-TW.md](references/zh-TW.md) only when the user prefers Chinese or the Chinese explanation is needed.

## Required shared runtime policy

Before making a routing decision, read and follow [../../shared/runtime-routing-policy.md](../../shared/runtime-routing-policy.md) and [../../shared/defaults.yaml](../../shared/defaults.yaml). They define environment detection, preference precedence, executor selection, persistence boundaries, and fallback behavior for every router in this plugin.

If the host cannot load a plugin-level reference, preserve these minimum invariants: separate user intent from runtime capability; lightly revalidate capability at every routing gate; treat saved capability as a non-authoritative hint; default unknown capability to user operation; and claim `applied` only after verified host execution.

## Direct-selection dispatch guard

Before doing model discovery or emitting output, determine why this Skill was loaded. Continue locally only when the user explicitly requested model/reasoning-only routing or model-mode control, the `adaptive-task-routing` coordinator supplied a resolved effective context and marked this call as coordinator-delegated, or a previously completed coordinator gate is being revisited for a genuine model-only phase transition. Handle a model-mode inspection/change immediately under the shared policy: confirm the effective value and scope without model discovery or a recommendation. For any general substantial task where Context and Model routing have not both been resolved, stop this child workflow, read [adaptive-task-routing](../adaptive-task-routing/SKILL.md), and follow that coordinator once. Do not emit a standalone model result before dispatch. Pass an internal `delegated_from: research-model-router` marker; when the coordinator reads this Skill again with its coordinator-delegated resolved-context marker, continue here and never dispatch again.

## Routing gate

Run after the plan or preceding analysis for the upcoming phase and the effective working context are known, before that phase begins. For a plan-only or analysis-only request, the recommendation follows the requested deliverable and applies to its concrete substantial next phase. For an execution request, a concise actionable plan appears first, and this gate runs before mutation or substantial execution. A caller can supply the resolved context. Direct use stays model-only only under the direct-selection guard above.

When delivering an improvement plan with a concrete substantial next phase, include a model/effort recommendation for that phase before yielding, even if execution awaits approval. Advice does not authorize implementation. If a final answer has no substantial next phase, do not invent one or add a new routing gate just to end the response. Before difficult final evidence synthesis, route before doing that synthesis.

Re-run only at a meaningful stage transition: pilot to expanded workload, retrieval or execution to interpretation, robustness or adversarial testing, routine transformation to difficult reasoning, or final evidence synthesis. Do not re-route for every tool call or ordinary chat.

## Decide

First describe `task_requirements`: the phase's capability needs, relative reasoning demand, quality/validation needs and latency/usage constraints. This judgment does not depend on knowing the current model. Then produce two independent task-based results: `minimum_sufficient_setting`, the least costly pair likely to meet those requirements, and `recommended_setting`, the best-value pair after considering ambiguity, error cost, validation depth, latency and usage. The two pairs may be identical. Always record `upgrade_value` in structured evidence (`low`, `medium`, or `high`) and a concrete `upgrade_reason` describing what the recommended pair is expected to add over the minimum. Do not suppress useful task guidance when discovery is incomplete.

When observations are missing or stale, follow the matching [host discovery guide](../../shared/host-discovery.md). Resolve `../../shared` from the directory containing this `SKILL.md`: it is `<plugin-root>/shared`, not `skills/shared`. In a permitted Codex environment the guide links to [the optional read-only probe](scripts/probe_codex.py); do not run that helper on Claude/Gemini or assume ChatGPT has access to the user's CLI. Excluding a subagent menu only rejects that source: continue to an applicable host read path or fresh, scoped observation. Do not conclude that the main-context catalog is unavailable merely because the visible menu is for subagents. If the Codex helper identifies a project-sandbox state-access failure, stop after that attempt and follow the host guide's versioned bundled-registry fallback without requesting extra read permission. In a positively identified OpenAI host, including ChatGPT desktop/web and Codex App/CLI, unavailable runtime metadata does not suppress the two concrete settings: use the unexpired bundled registry as a cross-surface recommendation reference and label account availability `unverified` only in structured evidence. Its CLI observation proves availability only for that observed CLI, while its dated official capability source supports recommendations on the listed OpenAI surfaces. Do not ask the user to transcribe selector options before giving those recommendations. Record any attempted read and outcome before falling back. Prefer an applicable runtime catalog, use official model descriptions only as scoped capability evidence, and use relevant task evaluations when available. Keep inferred recommendations distinct from measured results.

For verified runtime decisions, recommend only a `model` and `reasoning_effort` supported by the current environment. For a matching unexpired registry fallback, recommend only pairs recorded in that registry and label their account availability `unverified`. Never invent identifiers.

Reasoning controls are platform-native. The rubric's `low`, `moderate`, and `high` task demand is internal analysis, not proof that those strings are selectable settings. On Gemini CLI, use an exact observed `thinkingBudget` or `thinkingLevel` only when it is configurable in the effective session. Otherwise render `Reasoning: model default`, localized to the user. Never output bare Codex-style `low`, `medium`, or `high` as a Gemini setting without matching Gemini control evidence.

Resolve the catalog's scope instead of copying a probe's initial `unverified` label. Follow the host guide's surface-specific invocation and criteria. In an identified Codex CLI task, invoke the helper with `--surface codex-cli`. When CLI versus App is not explicitly identified, invoke it with `--surface auto`; do not guess App. Automatic detection may use a standalone CLI process ancestor or the exact thread's stable `source: cli` when tool isolation hides that ancestor; the latter identifies the interface without treating saved model/effort as live. Accept a fresh successful CLI catalog marked `applicability: verified` unless positive evidence shows an availability-changing launch mismatch. The helper's separate process, unreadable live settings, absence of an App bridge, or inability to prove that no hidden override exists must not invalidate that CLI catalog. Runtime descriptions and supported effort options can support a capability-based recommendation without benchmarks. If scope is still unresolved, name the actual conflicting evidence; neither unknown current values nor an unrelated failed metadata read is a catalog failure.

Judge technical difficulty, ambiguity, dependent reasoning steps, evidence volume and heterogeneity, validation needs, consequence of subtle errors, synthesis or critique demands, latency and compute cost, and whether the phase is execution-heavy or interpretation-heavy.

- Prefer fast, economical settings for clear retrieval, formatting, extraction, and deterministic transformations.
- Prefer balanced settings for ordinary multi-step research and analysis.
- Prefer stronger capability and higher effort for ambiguous methodology, difficult synthesis, robustness review, consequential conclusions, or tightly coupled technical decisions.
- Reassess after the demanding phase ends; lower settings only when the expected remaining-phase benefit justifies switching cost.
- Treat missing source data, unavailable history, unresolved definitions and external bottlenecks as limits on upgrade value: more model capability cannot manufacture evidence.

Treat model and effort as a pair. Use the lowest effort likely to satisfy the task for the minimum setting. A stronger model does not automatically require maximum effort, and most tasks do not require `max` or `ultra`. Keep both internal settings task-based even when the current pair is suitable; report retention separately rather than overwriting the minimum or recommendation with the observed pair. Do not hide concrete recommendations behind `CURRENT / CURRENT`.

### Assess whether to switch

Follow the shared policy's [phase continuity and switching value](../../shared/runtime-routing-policy.md#phase-continuity-and-switching-value) contract after selecting both task-based settings and before applying either model or effort. Route at task boundaries, not every prompt. The coordinator supplies the effective context and continuity rationale; a declined handoff or disabled context router must not be treated as a new destination.

Prefer model stickiness when the observed current pair meets the quality floor. Evaluate remaining-phase gains against switching cost and context locality, including setup, latency, retries and rework. Unknown cache evidence is not zero cost or certain cache loss. Conversation retention does not establish cache reuse; reasoning-only changes also require assessment. Quality deficits can justify a change despite cache uncertainty. A new context still has setup costs and does not force a new model.

Produce `switch_assessment` separately from `upgrade_value`: compare the observed current pair with `recommended_setting`, record `switch_value` (low, medium, high, or unknown), `decision` (retain, change, or defer), and a reason. Unknown current settings require unknown switch value and deferred automatic switching, without suppressing the two concrete task settings. If uncertain costs could reverse the decision, retain or defer rather than fabricating net savings. An already matching pair has low switch value and is retained. Only `decision: change` permits a router-initiated change in `auto`; explicit user setting requests take precedence and still require callable, verifiable controls.

Use the shared UX contract to express the switch assessment in the action and its reason. Keep scoring internal; detailed output adds concise comparison rationale. Retain/nonblocking defer do not require routing confirmation; a material blocker does. A task-fit recommendation is not an applied change.

Read current configuration and available options separately from exposed runtime metadata or user-provided settings. A catalog of supported models is not evidence of which model is running. Mark each unreadable current field `unknown`; use `unsupported` only when the host confirms that reasoning effort is not configurable.

Resolve the recommendation independently of whether it can be compared or applied:

| Available evidence | Decision |
| --- | --- |
| Applicable candidates, supported effort options and capability evidence are sufficient; current pair is unknown | Give concrete minimum and recommended pairs. Current values and whether a switch is needed remain unknown. Do not substitute `CURRENT / CURRENT` solely because live settings cannot be read. |
| Current pair is known and supported by capability evidence | Give both task-based pairs by their concrete names, compare the observed pair with them, and assess switching value. Retain the current pair when justified. Recommend an alternative only with sufficient evidence. |
| A model recommendation is supported, but its effort options are unknown | Record the model in both internal settings, retain effort as `CURRENT` with uncertainty in evidence, and use native supported controls in the visible task-fit setting. Relative task demand is not an invented selector value. |
| Runtime discovery is blocked on a recognized OpenAI surface, but the unexpired bundled registry has model descriptions and effort options | Stop after the failed read and give concrete minimum and recommended fallback pairs without asking the user to transcribe the selector. Treat the registry as cross-surface recommendation evidence, while keeping account availability and current settings unverified. Apply only through independently verified switch controls in `auto`; follow routing-ux.md for authorized continuation, a justified change or a material blocker. |
| Gemini CLI live selector metadata is unavailable, but the unexpired Gemini CLI registry applies | Recommend only its stable aliases (`auto`, `pro`, `flash`, or `flash-lite`) using the recorded task guidance. Never guess a concrete backend model because alias resolution is account-dependent. Use the model's default reasoning behavior unless an exact native thinking control is observed. Do not ask for `/model` before giving the fallback recommendation. |
| Relevant bounded discovery leaves insufficient catalog or capability evidence to choose a pair, and no recognized-product bundled reference applies | Show task requirements, the attempted source and outcome or concrete access limitation, and the missing evidence. Provisionally retain `CURRENT / CURRENT` with `assessment: unverified`, or ask once for selector options when an exact choice is necessary. Do not call this proof of suitability. |

Lack of an automatic switching tool affects execution, not the ability to recommend evidenced pairs. `upgrade_value` compares the recommended pair with the minimum sufficient pair, never with an unknown current setting. In `ask`, present the recommended pair as task guidance and defer automatic switching when the current pair is unknown; do not describe it as an upgrade or downgrade from the unknown setting.

## When the user questions a recommendation

Do not request broader read permission during the normal fallback path. If the user says the recommended model or effort looks wrong, asks why it was chosen, or explicitly requests an account-specific check, then disclose the useful diagnostic facts: whether the recommendation used runtime data or the bundled reference, the reference observation and expiry dates, that account availability is unverified when applicable, and the task factors that led to both pairs.

After that explanation, ask once for narrowly scoped read permission only when the current host exposes a concrete path that the permission would unlock and that path can query the same effective App/session with `model/list` or equivalent metadata. Name the exact read and why it would improve the answer. Generic filesystem, network, CLI, or approval permission is not useful if it can only inspect another process or cannot reach the current selector; do not request it. If no matching read path exists, say so and optionally ask the user to share the selector only when they still want an account-specific comparison. If the user declines, continue with the reference recommendation and do not ask again until the surface, permission state, or explicit request changes.

## Apply the user's control mode

Resolve this router's mode independently. Follow [routing UX](../../shared/routing-ux.md).

- `off`: skip this router and its output.
- `ask`: ask before a justified model/effort change, or when a material quality blocker needs a user decision. Retain and nonblocking defer require no routing confirmation; continue only already authorized work. An unknown current pair alone does not prove a blocker or suitability.
- `auto`: only `decision: change` permits a router-initiated switch, subject to authorized, callable and verifiable operations. Otherwise retain the actual configuration; continue authorized work only without a material blocker. An unavailable control does not prove that an inadequate configuration is safe to use.

A plan-only request never authorizes implementation. Respect an explicitly selected target without another confirmation. Combine genuine pending questions with the context router only for a known destination.

## Output

Use the [shared UX contract](../../shared/routing-ux.md). Keep `minimum_sufficient_setting`, `recommended_setting`, `upgrade_value` and `upgrade_reason` in structured evidence. `recommended_setting` is displayed as **Task-fit setting / 任務適配設定**. Compute both task-based settings internally. Verified keep requires a reliably observed model and native reasoning configuration, phase-specific quality evidence and evidence supporting retention. A generic model-default label is not a model identity. Use the shared canonical action line on its own line; keep unknown retention provisional without overriding context actions, explicit targets or blockers. Verified keep in compact shows only the observed current pair; task-fit alternatives appear only in detailed output. Provisional keep can still show a useful task-fit pair, including when current settings are known but switching benefit or cost is uncertain. Do not overwrite them with the current pair to justify retention.

Put the requested plan or preceding findings before the routing note. Lead with the action and one-sentence reason, then useful settings. A standalone invocation uses a divider and plain `Adaptive Task Routing` heading (`### Adaptive Task Routing`); a delegated invocation returns its result to the coordinator and must never emit a second divider or heading. Model-only output makes no conversation suitability claim.

Show current settings only when observed and useful; never print `Current: unknown / unknown`. Unless diagnostics are requested, do not mention the probe, fallback/registry source, freshness, scope or internal scores. Never render the schema or internal evidence in ordinary compact output. Read [the evidence schema](references/evidence-schema.md) only for diagnostics or maintenance. Detailed presentation adds minimum needed, task-fit setting and upgrade rationale; it is not a new gate.

### Select the action paragraph

For `retain` or `defer`, do not append `/model`, selectors or invitations to apply the target. Use a positive keep action only with suitability evidence; otherwise use provisional retention. When authorized work can continue, say what continues and proceed without asking. When only a plan was requested, finish the plan without implementing it. When a material blocker exists, identify it and ask a concrete question; do not ask whether to keep current just because metadata is missing.

For `decision: change` or an explicit user-selected target, use controls known for the effective surface:

- ChatGPT desktop/web: 如需採用建議，可使用介面中的模型與推理強度選單調整。Do not include the CLI-only `/model` command.
- Identified Codex CLI: `/model` is a user control, not an agent-callable operation.
- Gemini CLI: 目前環境無法代為切換模型；Reasoning 使用模型預設。Only show `/model` for a justified change or explicit target. Native reasoning is `Reasoning：使用模型預設` unless an exact supported control is observed.

In `ask`, ask only whether to use the named target for an ordinary change; reserve plan changes for a material blocker; do not require a fixed confirmation word. In `auto`, report only verified application or the actual fallback, and continue authorized downstream work only when no material blocker remains. Never say “applying” merely because switching was recommended.

## Coordination boundary

This skill decides **how much model capability the work needs**. `task-context-router` decides **where the work runs**. Keep them separate and use this order:

```text
requested analysis or plan → task-context-router → resolve context
→ research-model-router → resolve action and authorization → execute or ask for a real decision
```

The [coordinator](../adaptive-task-routing/SKILL.md) owns this full sequence. This Skill dispatches to it only when the host selected the child for a general task before Context routing; it never performs the Context decision itself. Explicit model-only invocation remains valid. At later substantial phase transitions, re-run only this Skill when a completed Context decision is still valid; use the coordinator when a genuine context-boundary question also appears. Neither router expands permissions or authorizes unrelated external actions.
