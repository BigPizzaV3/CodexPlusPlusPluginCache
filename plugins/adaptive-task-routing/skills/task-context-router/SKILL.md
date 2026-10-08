---
name: task-context-router
description: Context-only child router that chooses CURRENT, HANDOFF, or CLEAN and handles conversational inspection or changes of the context-routing mode. Use when the user explicitly asks only for context advice or mode control, or when adaptive-task-routing delegates. For a general substantial task needing both context and model routing, dispatch to adaptive-task-routing instead. Do not choose a model or reasoning effort.
---

# Task Context Router

Choose the working context before substantial execution. This skill routes the task; it does not perform the task itself.

For Traditional Chinese guidance, read [references/zh-TW.md](references/zh-TW.md) only when the user prefers Chinese or the Chinese explanation is needed.

## Required shared runtime policy

Before making a routing decision, read and follow [../../shared/runtime-routing-policy.md](../../shared/runtime-routing-policy.md) and [../../shared/defaults.yaml](../../shared/defaults.yaml). They define environment detection, preference precedence, executor selection, persistence boundaries, and fallback behavior for every router in this plugin.

If the host cannot load a plugin-level reference, preserve these minimum invariants: separate user intent from runtime capability; lightly revalidate capability at every routing gate; treat saved capability as a non-authoritative hint; default unknown capability to user operation; and claim `applied` only after verified host execution.

## Direct-selection dispatch guard

Before deciding Context or emitting output, determine why this Skill was loaded. Continue locally only when the user explicitly requested context-only routing or context-mode control, or the `adaptive-task-routing` coordinator marked this call as coordinator-delegated. Handle a context-mode inspection/change immediately under the shared policy: confirm the effective value and scope without evaluating Context. For any general substantial task where both Context and Model routing are expected, stop this child workflow, read [adaptive-task-routing](../adaptive-task-routing/SKILL.md), and follow that coordinator once. Do not emit a standalone Context result before dispatch. Pass an internal `delegated_from: task-context-router` marker; when the coordinator reads this Skill again with its coordinator-delegated marker, continue here and never dispatch again.

## Routing gate

When the coordinator delegates a plan-only or analysis-only request, run after that requested deliverable is complete and before its substantial next phase. For an execution request, run after a concise actionable plan exists and before mutation or substantial execution. A direct context-only request may run as soon as the request is understood.

Reconsider at a genuine task boundary: a substantially different objective, the transition from exploration to a stable downstream phase, a context crowded with irrelevant or conflicting history, or a phase requiring isolation or reproducibility. Do not invoke for every small follow-up.

## Decide

Return one recommendation:

- `CURRENT`: keep the current conversation when the task depends on recent discussion and the context remains coherent.
- `HANDOFF`: move to a new context with a compact handoff when the next phase needs selected conclusions and constraints, not the full exploration history.
- `CLEAN`: use a new context without task history when independence, blind evaluation, contamination control, or a truly unrelated task outweighs continuity.

Judge dependency on prior turns, relevance of accumulated context, stale-instruction or anchoring risk, whether a concise handoff preserves all requirements, expected next-phase complexity, isolation needs, switching cost, and actual host capabilities.

Return the effective context and a continuity rationale for the coordinator to pass to model routing: what information remains useful, what must be reconstructed, and any handoff/setup cost. This informs switching value but does not choose a model. A retained conversation is not proof of a prompt-cache hit; a new conversation does not make configuration changes cost-free. If the user declines a handoff, pass the retained context, not the proposed destination. When this router is off, the coordinator reports current placement without claiming it was assessed.

Do not recommend a new context merely because the task is difficult. Do not use `CLEAN` when losing prior requirements creates avoidable risk. If the host cannot create a new context, report the recommendation without claiming it was applied.

Identify the effective execution destination separately from the visible client (web, desktop, phone or terminal). A local shell or a new CLI process does not prove the current App can create or transfer a conversation. Preserve source/time/scope on capability observations; a destination's unreadable model settings must not block context-only advice. Do not fetch a model catalog for this router. A handoff may carry labeled configuration hints, never assume they remain current or supported in the destination.

## Apply the user's control mode

Resolve this router's mode independently of the model router. A current-turn instruction wins over stored preferences. If no mode is available, default to `ask`.

- `off`: do not evaluate; remain in the current context and emit no recommendation.
- `ask`: when the result is `CURRENT`, continue without interrupting. Before a recommended context change, ask whether the user wants it. If declined, continue in the current context. If accepted, perform the approved operation when it is callable and verifiable; otherwise give the user known manual steps and let them resume naturally in the destination without requiring a confirmation word.
- `auto`: apply automatically subject to availability, permissions, and safety constraints.

`off` means the router does not run. `ask` is the default interactive mode. When both routers require confirmation, combine their choices into one concise prompt when accurate, while preserving independent controls.

## Output

Follow [routing UX](../../shared/routing-ux.md): lead with the context action and reason, and always include one localized sentence explaining whether a new conversation is needed when enabled. A recommended change is not an applied change. In a coordinated run, return the result for one combined note; do not emit a separate block. Continue only authorized work, and never let a retained model suppress a pending handoff or missing destination decision.

Use the shared canonical action line unchanged and keep its short reason on a separate line.

Keep `CURRENT`, `HANDOFF`, and `CLEAN` as stable values in structured evidence only. In compact user-facing output, show a plain-language description localized to the user's language and do not append the enum in parentheses. For Traditional Chinese use “留在目前對話,” “切換到新對話並帶入精簡交接,” or “開啟全新對話，不帶入目前脈絡,” as applicable.

```yaml
skill: task-context-router
recommendation: CURRENT | HANDOFF | CLEAN
confidence: 0.00-1.00
reason: one concise task-specific explanation
mode: off | ask | auto
disposition: skipped | awaiting_user_confirmation | awaiting_user_action | applied | kept_current
handoff_required: true | false
runtime_capabilities:
  surface: identified surface or unknown
  create_new_context: agent | orchestrator | user_only | unavailable | unknown
  create_handoff_context: agent | orchestrator | user_only | unavailable | unknown
  evidence: runtime metadata | user-provided settings | cached observation | unavailable
  observed_at: timestamp | unknown
  confidence: 0.00-1.00
execution:
  requested_owner: agent | orchestrator | user | none
  effective_owner: agent | orchestrator | user | none
  status: skipped | awaiting_user_confirmation | awaiting_user_action | applied | retained_current | blocked
  reason: concise explanation
  manual_action: null | surface-specific instruction
```

For `HANDOFF`, also provide only the state needed in the destination:

```yaml
handoff:
  objective: current objective
  confirmed_requirements: []
  decisions_and_rationale: []
  relevant_artifacts: []
  current_state: concise status
  unresolved_questions: []
  next_action: first useful step
```

Never include secrets, irrelevant history, hidden reasoning, or a transcript. For `CLEAN`, do not attach a task handoff.

When the host exposes only user controls, provide the exact action for that surface plus the handoff when needed. An interactive command visible to the user is not an agent capability unless the agent can actually invoke and verify it.

## Coordination boundary

This skill decides **where work runs**. `research-model-router` decides **which model and reasoning effort run it**. Keep them separate and use this order:

```text
requested analysis or actionable plan → task-context-router → resolve context
→ research-model-router → resolve action and authorization → execute or ask for a real decision
```

The [coordinator](../adaptive-task-routing/SKILL.md) owns this full sequence and loads the model router after this Skill returns. This Skill dispatches to the coordinator only when the host selected it for a general task; it never chooses the model itself. A direct context-only request stays context-only.

If context routing awaits the user, the coordinator defers final model selection until the destination is known, unless both recommendations can be presented accurately in one prompt. If the user declines an `ask` recommendation, the effective context stays current. Neither router expands permissions, creates unrelated work, or authorizes external side effects.
