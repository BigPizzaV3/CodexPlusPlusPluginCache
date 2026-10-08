# Shared Runtime Routing Policy

This is the canonical runtime policy for every routing skill in this plugin. It is loaded by the skills, not enforced globally by a manifest. The coordinator loads the independent routers in order. During that coordinated run, neither child calls the coordinator or another child. If a host directly selects a child for a general task, the child's direct-selection guard may dispatch once to the coordinator; coordinator-delegated markers prevent recursion. Instructions alone do not guarantee implicit host invocation.

## Separate intent, capability, and decision

Resolve three layers independently:

1. `user_policy`: `off`, `ask`, or `auto` for each router.
2. `runtime_capabilities`: what each exact operation can do in the current surface, session, tools, and permissions.
3. `routing_decision`: what context or model configuration best fits the next phase.

The current conversation already has a context and model configuration. When routing is off, or when an enabled router recommends no change, use that current state without asking for a separate fixed strategy.

## Capability snapshot and revalidation

On first use in an environment, look for a capability snapshot in a host- or user-managed settings store. If no snapshot exists, it is stale, or its environment fingerprint no longer matches, detect each relevant operation and record the result when the host provides a suitable persistence mechanism.

Do not store mutable observations inside the installed plugin package. A snapshot is a cache, never authority. Record enough provenance to judge freshness: surface, host or plugin version when exposed, tool/capability fingerprint, observation time, evidence source, and confidence.

At each routing gate, perform only a lightweight freshness check. Re-detect the affected operations when the surface, session, host/plugin version, permissions, exposed tools, or operation result changes. A failed automatic operation invalidates that capability immediately. Do not repeat the same failed automatic operation in the same gate.

Detect operations separately; never collapse a whole App or CLI to one executor:

```yaml
runtime_capabilities:
  surface: identified surface or unknown
  create_new_context: agent | orchestrator | user_only | unavailable | unknown
  create_handoff_context: agent | orchestrator | user_only | unavailable | unknown
  switch_current_model: agent | orchestrator | user_only | unavailable | unknown
  set_model_for_new_run: agent | orchestrator | user_only | unavailable | unknown
  set_reasoning_effort: agent | orchestrator | user_only | unavailable | unknown
  evidence: runtime metadata | user-provided settings | cached observation | unavailable
  observed_at: timestamp | unknown
  confidence: 0.00-1.00
```

One surface may expose mixed capabilities. For example, it may allow an orchestrator to create a new context with a selected model while requiring the user to change the current model or effort. Preserve that distinction in both decisions and execution.

In-scope read-only metadata checks may establish capability. An interactive command, visible selector, or launch flag is not agent capability unless the agent can invoke the exact operation and verify its outcome. Unknown capability falls back to user operation.

## Dynamic model catalog

### Scoped discovery

Identify the product, interface/mode, execution host (local, remote, sandbox, unknown), and effective conversation separately. Do not infer capabilities from an App/CLI label or assume a phone/web client executes on that device. Read only the relevant [host discovery guide](host-discovery.md) when metadata is missing or stale. Use bounded, in-scope read-only checks before calling an accessible catalog unknown; record an unavailable tool or denied permission instead of bypassing it. Do not probe when routing is off.

For each observation retain `status`, `source`, `scope`, `observed_at`, and applicability to the effective context. Distinguish `not_probed`, `available`, `partial`, `unavailable`, `permission_denied`, `error`, `stale`, and `scope_mismatch`. A fresh read of old settings is still old evidence. Keep live configured values, last-persisted thread values, disk defaults and per-turn execution telemetry separate. Never fill unknown current fields with a catalog default or another process's settings.

Read access is not write capability. Do not start/resume a conversation, send a model prompt, install a hook, change configuration or attach an unrelated session just to discover settings. Do not print credentials, full settings, transcripts or unrelated thread identifiers. A provided helper may cause normal host cache/log activity; it is not a promise of zero host filesystem activity.

Treat the current configuration, available model catalog, and model capability evidence as separate observations. A catalog does not identify the running model.

Prefer model information in this order:

1. Current runtime metadata or a callable host catalog.
2. A user-provided selector inventory, clearly labeled as user-provided.
3. A versioned, expiring fallback registry, only when bundled or configured for that purpose.

Cache a runtime catalog for the current session or another explicitly short host-defined lifetime instead of fetching it at every unchanged gate. Refresh it on a new session, host or catalog change, a selector mismatch, an unsupported-model error, or expiry. Never treat a cached or fallback catalog as proof that a model still exists.

Keep the task-scoring rubric stable and model-neutral: difficulty, ambiguity, dependent reasoning, error cost, validation needs, latency, and compute preference. Map those needs to capabilities declared by the current catalog. Do not permanently assign scores to model names in user policy. If only identifiers are available and no reliable capability metadata or current fallback entry exists, do not invent a ranking or named recommendation.

### Capability evidence and task needs

Describe the upcoming task's capability and reasoning needs even if configuration or catalog discovery fails. This is task guidance, not proof that the current model is suitable. Every enabled model decision has two task-based outputs: the **minimum sufficient setting**, which is the least costly supported pair likely to meet the phase's quality and validation needs, and the **recommended setting**, which is the best-value pair after considering ambiguity, error cost, validation depth, latency and usage. They may be identical. Always record in structured evidence `upgrade_value: low | medium | high` and explain what additional result quality the recommended pair is expected to buy over the minimum; when the pairs are identical, upgrade value is `low`.

Map those needs to normal named settings after confirming destination availability when possible and always require relevant capability evidence. On a recognized OpenAI surface, a matching unexpired bundled registry may produce both named settings when runtime discovery cannot complete; its official cross-surface capability reference supports the recommendation, while account availability remains unverified. On Gemini CLI, its matching registry may recommend only the recorded stable aliases while leaving account-dependent backend resolution unverified. Do not ask the user to transcribe selector options before giving an applicable fallback recommendation. A fallback never authorizes or triggers a switch. If a model is known but its supported effort options are not, retain effort as `CURRENT` with an explicit unknown; do not invent an effort value.

Runtime descriptions are a starting point. When insufficient, consult the vendor's official documentation for the exact model and product, record URL/date/product scope, and label the resulting recommendation as an inference. Documentation can describe capability but cannot establish account availability. API pricing, reasoning options and model aliases do not automatically describe a ChatGPT/Claude/Gemini consumer or CLI product. Do not silently equate aliases, Auto routing policies or subagent settings with the main model's actual execution.

Reasoning output uses the destination's native configuration. Relative task-demand labels are never selector values by themselves. In Gemini CLI, show an observed `thinkingBudget` or `thinkingLevel` only when it is configurable for the effective session; otherwise show the localized equivalent of `model default`. Do not emit bare Codex effort labels as Gemini settings and do not guess a backend model behind an account-dependent alias.

Use relevant task evaluations when available; do not turn short descriptions into precise quality scores or claim an untested pair is optimal. Use the lowest effort likely to succeed for the minimum setting. Raise the recommended setting only when the task has concrete ambiguity, coupled decisions, difficult checking, high error cost, or useful parallel work that the stronger pair can address. Missing source data, unavailable history, unclear business rules, external bottlenecks, or deterministic execution often make upgrade value low because a stronger model cannot supply the missing evidence. Cache capability references with model/product/source/date and an explicit expiry (default at most seven days); recheck earlier on model, host or selector changes. Do not browse at every unchanged gate or require network access to complete useful routing advice.

### Capability-limited Codex discovery

Use the capabilities already available in the current execution. When the bounded Codex metadata helper succeeds, use its complete catalog and any matching live current configuration it can establish. When it reports `codex_state_unwritable` or `permission_denied`, stop after that attempt and use the matching unexpired bundled registry; do not interrupt the routing result to request broader read access. On a positively identified OpenAI surface, including ChatGPT desktop/web and Codex App/CLI, the registry may be used as a cross-surface recommendation reference because its capability descriptions cover those listed surfaces. Record only in structured evidence that account availability is unverified and that the inventory itself was observed in CLI; do not present it as live App metadata. Ignore unreadable current fields when forming the recommendation and omit them from the compact user-facing result. Do not turn a failed read, missing permission, or unresolved Codex surface into `CURRENT / CURRENT`, and do not ask for the selector inventory before recommending.

Permission escalation is diagnostic, not part of the default recommendation path. When a user questions the recommendation or explicitly requests an account-specific check, explain the actual evidence source, relevant dates, applicability limit, and task mapping. Then request narrowly scoped read permission at most once only if that permission unlocks a concrete same-surface `model/list` or equivalent path. Do not request generic permission that can only inspect another process or cannot reach the current selector. After a decline, continue with the fallback and do not repeat the request until the environment or explicit user intent changes.

Read capability and switch capability are separate. Follow the [shared UX contract](routing-ux.md): `ask` waits before a justified change or a material blocker, not after every retention decision. In `auto`, apply the recommended pair only when the exact model and effort operations are callable, authorized, and verifiable; otherwise follow the UX contract for provisional retention, known controls and any material blocker. ChatGPT desktop and web use their visible model/reasoning selector and must not be given the CLI-only `/model` command. Use `/model` only for an identified Codex CLI that documents it. Never claim a switch from catalog access alone.

## Phase continuity and switching value

Route at task boundaries, not every prompt. Reuse a completed gate within an unchanged
phase; a phase transition permits reassessment, not an automatic upgrade or downgrade.
Optimize total task cost and reliability, including expected remaining work, latency,
retries, rework, handoff effort and user corrections. Do not optimize cheap-model turn
share or promise savings from model prices alone. When estimating money, distinguish
API billing from subscription usage and avoid counting cache processing twice.

The context router owns conversation placement. Pass its **effective** decision and
continuity rationale to the model router; if a handoff is declined, use the retained
context. Context routing being off means use the current conversation, not that its
suitability has been assessed. Explicit model-only routing also uses the effective
conversation without inventing a completed context gate.

- `CURRENT`: prefer model stickiness when the observed configuration meets the next
  phase's quality floor and continuity has value. A clear capability deficit or failed
  validation outweighs preserving a cache; do not pin an inadequate model.
- `HANDOFF` or `CLEAN`: reassess configuration for the new destination, including
  remaining work, handoff/setup cost, compatibility and available controls. A new
  conversation is not a zero-cost switch and does not require a different model.

Conversation continuity, prompt-cache reuse and host switch capability are separate
observations. A cache miss does not erase supplied conversation content; staying in
one conversation does not prove a cache hit. Switching back may reuse an unexpired
matching prefix; do not assume every model change is a full cold start. Provider,
model, prefix, TTL, tool/thinking compatibility and reasoning-only changes can affect
reuse. Use scoped official rules and actual usage when available; absent telemetry
means unknown, not zero cost or certain cache loss. Never launch paid inference or
warm caches just to assess switching. Keep observations session-local with source,
time and scope; never persist routing activity logs.

Keep the two task-based settings independent of the switch decision:

- `upgrade_value` compares `recommended_setting` with `minimum_sufficient_setting`.
  Do not replace both settings with the current pair merely to justify staying.
- `switch_assessment` compares moving from the observed current configuration to the
  recommended pair against retaining it for the same next phase. Record
  `switch_value: low | medium | high | unknown`, a reason and
  `decision: retain | change | defer`. The target is the recommended pair; an explicit
  user-selected target is a separate authorized operation, not a fabricated recommendation.
- Weigh capability/reliability gains and expected savings over the remaining phase
  against setup, cache, latency and context disruption costs. This is a qualitative
  judgment unless measured inputs support calculation; do not invent numeric scores.
  If benefits do not meaningfully exceed costs, retain the current configuration.
- If the current pair is unknown, mark switch value unknown and defer automatic
  switching while still giving evidenced task-based settings. Missing cost evidence
  is not evidence of a cheap switch: retain or defer when it could change the decision.
  A clear quality deficit may justify change despite unknown cache cost; record that
  tradeoff instead of inventing a cache estimate. If the observed pair already equals
  the recommendation, retain with low switch value; no cache estimate is needed.

This assessment precedes model/effort application in every host contract. In `auto`,
only `decision: change` permits a router-initiated configuration change, and the exact
operations must still be authorized, callable and verified. For `retain` or `defer`,
keep the configuration and continue authorized work, explaining any material quality
limitation. An explicit user request to apply a particular setting takes precedence;
do not force an additional routing confirmation. `ask` follows the shared UX contract; `off` skips its router. Deferred switch assessment does not make a completed task-based
recommendation a deferred model gate; unresolved destination selection still does.

Read and follow the [routing interaction and presentation contract](routing-ux.md). It owns action-first output, compact/detailed presentation and the distinction between confirmation, provisional continuation and completed plan-only work. Keep switching scores internal; a task-fit recommendation is separate from the recommended action.

## Resolve the mode and executor

- `off`: skip that router's evaluation and output; retain the current context or model settings.
- `ask`: follow [routing UX](routing-ux.md); ask before a justified change or material blocker. Retain and nonblocking defer continue only already authorized work without a routing confirmation. User-selected targets do not need a second confirmation.
- `auto`: evaluate and perform each permitted, callable, verifiable operation. Use the actual fallback for unsupported, unavailable or user-only operations; continue authorized work only if no material quality or destination blocker remains. Mixed capability may therefore produce a partially automatic result, but every reported result must identify what actually happened.

Only report `applied` after observing evidence that the host completed that exact operation. A direct user request to perform a particular host action is explicit authorization but still does not create missing capability.

Use these execution states consistently:

```yaml
execution:
  requested_owner: agent | orchestrator | user | none
  effective_owner: agent | orchestrator | user | none
  status: skipped | awaiting_user_confirmation | awaiting_user_action | applied | retained_current | blocked
  reason: concise explanation
  manual_action: null | concise surface-specific instruction
```

## Preferences and persistence

Use this precedence order:

1. Explicit instruction in the current user turn.
2. Host- or user-managed routing preferences.
3. Project-level routing preferences.
4. Packaged defaults.

Persist only the two modes, user preferences such as latency/cost emphasis, and cache records with provenance. Do not require a second fixed model strategy: the current conversation settings are the fallback. If no settings store exists, use packaged defaults and session-local observations without repeatedly asking onboarding questions.

Users may inspect or change routing modes directly in normal conversation. Treat a direct request such as “use auto mode for model routing,” “turn context routing off,” or “set Adaptive Task Routing to ask” as a configuration command, even though ordinary questions about the plugin do not trigger a routing gate.

- A named router changes only that router. An unqualified Adaptive Task Routing mode change targets both independent routers; it is shorthand, not a third coordinator mode.
- “For this task” or “this time” applies only to the current turn. “From now on” or “in this conversation” applies to the current conversation. “Make this my default” requests persistence in a host- or user-managed settings store.
- If the requested persistence scope is unavailable, apply the setting to the current conversation and say that it will not carry into a new conversation. Never edit the installed package or `shared/defaults.yaml` as a runtime preference store.
- Confirm the effective context and model modes plus their scope in one concise localized response. Do not run model discovery, emit a routing recommendation, or ask for a second confirmation merely to change a mode.
- When the same message also contains a substantial task, apply the mode instruction first and use it for that task's gate. Changing a mode alone does not authorize implementation or any external action.
- A request to inspect modes reports the two effective values and their scope without running either router.

## Interaction rules

- Follow [routing-ux.md](routing-ux.md) after both enabled assessments. `ask` asks before a change or material blocker; retain and nonblocking defer continue only already authorized work.
- Present requested findings or a plan before the action-first routing note. Compute both task settings internally; compact and detailed decide how much to display.
- Keep localized context/conversation advice visible when context routing is enabled. Omit it for context-off or model-only. Preserve both independent mode decisions.
- A destination awaiting confirmation is not an evaluated current context. Show deferred destination settings honestly and combine choices only when accurate.
- Keep source/scope, scores and unreadable current values out of ordinary output; expose diagnostic evidence only on request.
- When the user questions a recommendation, disclose its actual evidence and limitations. Offer one scoped permission request only if it can unlock a same-surface model read; otherwise do not ask for permission that cannot improve the result.
- Provide only controls actually known for the current surface. Do not fabricate menu names or commands.
- A recommendation attached to an improvement plan does not authorize implementation.
- Avoid repeated gates while phase, effective context, policy, capability snapshot, and catalog remain unchanged.
- Routing never expands task scope, permissions, or authorization for external side effects.
- Mode-control messages are configuration operations, not task-resource recommendations. Handle them before gate eligibility and keep their confirmation separate from the branded routing-note format.
