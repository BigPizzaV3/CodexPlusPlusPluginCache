# Routing interaction and presentation

This is the shared UX contract for both routers and the coordinator. Apply it after their
independent assessments; it does not select models or authorize task execution. Gemini embeds
this contract beside its host-specific runtime projection. Other hosts read this file through
the shared policy. Keep `recommended_setting` as the compatible internal field name; label it
**Task-fit setting** / **任務適配設定** in the UI. This is an evidence-based task recommendation,
not a proven optimum or an instruction to switch now.

## Ask before a change, not after every decision

Resolve interaction separately from the model's `decision: retain | change | defer`:

| Situation | `ask` interaction | Next-phase execution |
| --- | --- | --- |
| Retain, no pending context change or material quality blocker | No routing confirmation | Continue already authorized work |
| Defer, uncertainty does not prevent responsible progress | Explain provisional retention; no routing confirmation | Continue already authorized work with appropriate validation |
| Defer, missing information materially blocks quality or the next action | Ask one concrete question explaining what the answer changes | Wait for the missing decision |
| Justified context/model/effort change | Ask before the proposed change unless already explicitly authorized | Wait for the change decision; after a manual change, revalidate |
| User only requested analysis or a plan | Deliver that work and the relevant advice | Do not start implementation, regardless of mode or switch decision |

Unknown current model metadata alone is not a quality blocker. Assess the next phase's concrete
needs, observed work quality and available validation. An unmet quality floor, unresolved
destination, or missing requirement that prevents responsible progress must not become silent
continuation. Do not ask “keep current?” after deciding to retain. A missing implementation
authorization means the requested deliverable is complete, not that routing needs confirmation.
Do not require a fixed confirmation word. An explicit user-selected setting or acceptance is
already authorization for that setting; do not ask for it again.

For an ordinary setting change, ask only whether to use the named target: “Use <model / effort>?”
or “要改用 <模型／推理設定> 嗎？” Do not also ask to revise the plan. Broader choices belong
only to a material blocker. After a decline, continue only if the current approach can meet the
quality requirement; promise extra validation only when a concrete feasible check addresses the
limitation. More checking is not a blanket remedy for an inadequate model.

`auto` still requires justified, authorized, callable and verifiable operations. A recommendation
is not an applied change. When an operation cannot be performed, explain the practical fallback;
continue in the effective context only if work is authorized and no material blocker remains.
Do not pretend a manual-only handoff occurred. If progress requires the destination, provide the
handoff and wait for the user to resume there. `off` skips that router entirely.

## Compose one action-first routing note

Present the user's requested findings or actionable plan first. Within the routing note, use:
Markdown divider → exact `### Adaptive Task Routing` heading → action → short reason
→ conversation advice → useful AI setting → necessary control or next step.
The heading has no localized subtitle. Localize the action and body instead.
For analysis/plan-only requests, the complete requested findings and plan precede the divider;
the routing note is the final section. Never place the plan after the note or end the note with
“以下為改善計畫”. Action-first applies inside the note, not to the whole response. For execution
requests, present the actionable plan, then the gate, then continue authorized execution only
when no decision remains. A routing-only request needs no invented findings or plan.
Keep the action on its own line, followed by a separate reason of one or two short sentences.
Localize labels using the canonical vocabulary below; keep raw enums and scores internal.

For plan-only work, acknowledge the authorized analysis/planning scope. If the gate evaluates
a proposed later implementation phase, say “若後續進入實作” / “If implementation is later
authorized”. Do not describe that phase as already authorized, or substitute an assessment of
completed analysis for the proposed next-phase assessment. Plan-only status alone is not
evidence that the current AI is suitable or that switching offers little benefit.

Select the action from the combined effective result, not just the model decision:

- **Keep current / ✓ 維持目前設定**: no proposed environment change; claim suitability only
  for enabled components with supporting evidence. Context-off cannot certify the conversation.
- **Keep provisionally / 暫時沿用設定**: uncertainty warrants retaining without certifying
  suitability. Explain the relevant uncertainty briefly, without dumping unreadable model fields.
- **New conversation with handoff / → 建議交接**: carry the objective, confirmed facts,
  constraints, decisions, relevant artifacts and next step. Omit failed hypotheses and secrets.
- **Start clean / ↻ 全新開始**: explain why prior task context would interfere; do not carry
  a task-history handoff. Supply only the new task's self-contained request when needed.
- **Change AI setting / ↑ 建議調整 AI 設定**: show the justified target and the next action. Show the
  current pair only when actually observed or supplied by the user.
- **Need your decision / ? 需要你的決定**: a material blocker remains; name it and ask the useful
  question. This is not a synonym for every deferred switch assessment.

### Verified retention evidence

When model routing is enabled, verified keep requires all three: a reliably observed current
model and native reasoning configuration, evidence that it meets the assessed phase's quality
floor, and evidence supporting retention over switching. Successful earlier analysis alone does
not establish suitability for a different next phase. A catalog, saved default or generic
“model default” label does not identify the running model. Native default reasoning is valid
when paired with a reliably observed model; it must never substitute for the model identity.
Keep evidence internal unless details are requested; merely printing a model name is not proof.

If a retention result lacks any of these prerequisites, use provisional keep and explain the
uncertainty without claiming “switching offers little benefit”. Omit unknown/default-only current
AI fields. A useful supported task-fit setting may still be shown. This rule does not replace
a pending context action, explicit user target or material blocker with provisional retention.
Model-off can give a verified context-only keep without probing or displaying any AI setting.

### Canonical action vocabulary

These are fixed action lines, not new routing states. Traditional Chinese uses exactly:

| Action | 繁體中文 |
| --- | --- |
| Verified keep | ✓ 維持目前設定 |
| Provisional keep | 暫時沿用設定 |
| Handoff | → 建議交接 |
| Clean | ↻ 全新開始 |
| Change | ↑ 建議調整 AI 設定 |
| Material blocker | ? 需要你的決定 |

Do not substitute synonyms such as “保留現況” or merge the action into its reason. All hosts
use the same action line for the same decision in the same language. In other languages use
the corresponding localized labels in the packaged examples; do not force Chinese on the user.

A handoff or clean start can also require a model change. Lead with the context action and
include the destination setting when known; otherwise say it will be assessed there. Combine
pending choices only when accurate for the same destination. Never hide an enabled context
result behind model retention. Compact includes one plain conversation sentence, not a separate
new-conversation field. Use “對話：留在目前對話，不需開新對話。” for staying;
“對話：建議開新對話並交接必要脈絡，待你確認。” for a proposed handoff; and
“對話：建議開啟全新對話，不帶入目前脈絡，待你確認。” for a proposed clean start.
Say the destination is awaiting a decision when unresolved. Translate these meanings for other
languages using conversation/session terms appropriate to the host, not desktop window controls.
Distinguish a proposal from a completed operation; “待你確認” applies only when confirmation is
pending, not after acceptance or a verified auto change. Omit the entire conversation assessment
for context-off or an explicit model-only request.

## Compact and detailed

`compact` is the default presentation; `detailed` is available on request. These are presentation
preferences, not extra routing modes. Apply turn/conversation scope like other preferences;
persist a default only through an available host/user settings store, never in the installed
package. Asking for details reuses the current gate and does not authorize work or repeat probing.

- Verified keep in compact shows only the observed current AI pair, never a task-fit alternative.
  Move task-fit settings and their comparison to detailed output. Keep the action, reason and
  enabled conversation sentence. Model-off never adds an AI setting, even for a context keep.
- Provisional keep can arise from unknown current settings or uncertain switching costs/benefits.
  It is not limited to missing model metadata. Show a supported task-fit pair when useful; a known
  current pair may also be shown without certifying suitability. If current settings are unknown,
  explain that briefly in prose instead of a `Current AI: Unknown` field. Do not promise to wait
  for metadata when other evidence could justify a later decision. An unavailable model component
  is reported, not silently omitted.
- Detailed adds the observed current pair when useful, **Minimum needed / 最低足夠設定**,
  **Task-fit setting / 任務適配設定**, upgrade value and concise comparison rationale. Both task
  settings are still computed and kept in structured evidence even when compact omits them.
- Keep `switch_value`, cache evidence, source/scope and other diagnostic fields internal unless
  diagnostics are explicitly requested. Detailed means more explanation, not hidden reasoning,
  a transcript, or a persistent developer activity log.

Examples below assume both routers are enabled. Replace sample values and reasons with evidence;
do not copy a positive suitability claim into an unknown-baseline result.

```text
---

### Adaptive Task Routing

✓ 維持目前設定

目前設定足以完成剩餘核對，切換帶來的改善有限。

對話：留在目前對話，不需開新對話。
目前 AI：<已觀察的模型與原生推理設定>。

不需操作，接著執行已授權的核對。
```

```text
---

### Adaptive Task Routing

暫時沿用設定

若後續授權執行檢查，切換效益仍需確認；本輪僅交付分析與計畫。

對話：留在目前對話，不需開新對話。
任務適配設定：<有依據的模型與原生推理設定>，不代表現在需要切換。

分析與計畫已交付；尚未開始實作。
```

The last sentence depends on authorization: continue authorized work immediately when no pending
decision remains; finish a plan-only deliverable without an artificial routing question. For
change or a material blocker, end with one concrete question or known manual next step instead.
