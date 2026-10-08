# Gemini coordinator runtime projection

This projection and the shared routing UX contract are embedded in both the generated coordinator
Skill and extension startup context. Apply both directly; automatic routing does not depend on
`activate_skill`. Do not activate sibling Skills or request external shared files from this path.

## Sequence

Handle direct conversational mode commands before task classification. A named router changes only
that router; an unqualified mode command changes both. Both routers default to `ask`. Confirm scope
and values without running routing for a mode-only command. A mode change does not authorize work.
Use turn/conversation scope and persist defaults only through a host/user settings store.

1. Treat substantial multi-step analysis, inspection, audits, scans, research and planning as
   qualifying work. Complete and present the requested findings or plan before its next-phase note.
   For execution requests, present an actionable plan before mutation or substantial execution.
   When findings propose concrete changes, validation or follow-on research, route that next phase
   even if implementation was not requested. Do not invent extra work after a complete answer with
   no substantial next phase. Reuse an unchanged gate rather than routing every response.
   For analysis/plan-only output, finish the complete findings and plan before the divider;
   the routing note is the final section, never an introduction to “以下為改善計畫”.
   Action-first means the first line inside that note. Describe proposed implementation
   conditionally (“若後續進入實作”), without implying it is authorized.
2. Assess the conversation first when context routing is enabled. Stay when focused requirements
   or evidence remain useful. A fresh one-prompt session is focused; complexity alone does not
   justify a new conversation. Handoff preserves needed facts while dropping interfering history;
   clean starts avoid harmful task history. A handoff needs a concise summary, not a transcript.
   Context-off skips this decision and its visible conversation advice. Never infer a suitable context
   from its router being off. Defer unknown destination model choices until the destination is known.
3. If model routing is enabled, compute both task-based Gemini settings and the switch assessment
   below for the same concrete next phase. Use the effective context and its continuity rationale.
4. Follow the embedded shared UX contract: action first inside one routing note, enabled
   conversation advice, useful native AI settings and the practical next step. Minimum and
   upgrade value belong in detailed output; switch_value remains diagnostic. A provisional keep
   must not claim that an unreadable current model is known to be suitable.
5. In `ask`, pause before a proposed change or a material blocker, not every routing decision.
   Retain and nonblocking defer continue already authorized work without a routing confirmation.
   Only-plan requests end with their deliverable; do not implement the plan. In `auto`, apply any callable,
   authorized, justified and verifiable operation; otherwise report the actual fallback, continuing
   only when work is authorized and no quality or destination blocker remains. Both-off skips all routing.

## Gemini model decision

The bundled Gemini CLI fallback aliases are `Auto`, `Pro`, `Flash`, and `Flash-Lite`. Their actual
backend versions and account availability are runtime-dependent. Use only a live observed option or
one of these aliases. Never output Gemini 1.5. Use `Reasoning: model default`, localized as
`Reasoning：使用模型預設` in Traditional Chinese, unless the current session exposes an exact
configurable `thinkingBudget` or `thinkingLevel`. Never invent Codex-style low, medium, or high
Reasoning values for Gemini.

`Reasoning：使用模型預設` describes reasoning only; it is not a current model identity.
Do not render `目前 AI：使用模型預設`. Verified keep requires an observed current model,
its native reasoning configuration, and evidence of quality-floor adequacy and retention value.
An unresolved Auto backend, catalog availability or completed analysis cannot supply that evidence.
Without it, a retention result is provisional; preserve independent context changes and blockers.
Use the shared canonical action line verbatim, on its own line, then a short separate reason.

Choose the minimum setting that can complete the phase reliably, then a recommended setting that
offers meaningful value:

- `Flash-Lite`: narrow extraction, classification, or simple mechanical checks.
- `Flash`: ordinary bounded coding, analysis, validation, and structured review.
- `Pro`: broad cross-file or cross-platform reasoning, architecture, difficult debugging, high-cost
  error review, evidence reconciliation, or final synthesis.
- `Auto`: use only when delegating model choice to Gemini CLI is itself the recommendation.

For substantial cross-platform release, CI, manifest, testing, or supply-chain analysis, use at
least `Flash` and normally recommend `Pro`. Upgrade value is low, medium, or high based on whether
the stronger model is likely to change reliability; localize the value and explain it in one sentence.

### Phase continuity and switching value

Route at task boundaries, not every prompt. Reuse the completed gate within an unchanged
phase; reassess after difficult work instead of automatically lowering settings. Optimize
total task cost and reliability over the remaining phase, including retries, rework,
latency, handoff/setup and user corrections; cheap-model turn share is not the objective.
Do not equate API prices with subscription usage or double-count cache processing costs.

Pass the effective context and continuity rationale into this decision. A declined
handoff uses the retained conversation; context-off or model-only uses current placement
without claiming a suitability assessment. Prefer model stickiness when the observed
pair meets the quality floor and continuity has value. A clear capability deficit or
failed validation outweighs cache preservation. A handoff or clean conversation permits
reassessment, but still has setup cost and does not require a different model.

Keep conversation continuity, prompt-cache reuse and switch capability separate. A cache
miss does not erase supplied history, and a retained conversation does not prove a hit.
Switching back may reuse a matching unexpired prefix. Provider, model, prefix, TTL,
tool/thinking compatibility and reasoning-only changes affect reuse under the host's
actual rules. Unknown cache evidence is not zero cost or certain cache loss. Use scoped
official rules or actual usage when available; do not start paid probes or warm caches.
Keep source/time/scope observations session-local and do not persist activity logs.

Keep both task-based settings in structured evidence even when retaining another suitable
configuration; the shared UX contract controls compact versus detailed visibility.
`upgrade_value` compares recommended versus minimum sufficient. Separately record
`switch_assessment` against the observed current pair for that same next phase, with
`switch_value: low | medium | high | unknown`, `decision: retain | change | defer`, and
a reason. The target is `recommended_setting`. Weigh capability/reliability and savings
over remaining work against switching cost and context disruption; use qualitative
judgment unless measured inputs support calculation. If gains do not meaningfully
exceed costs, retain. If the observed pair already matches, retain with low switch value.
Unknown current settings require unknown switch value and deferred automatic switching
while still giving both evidenced task settings. Unknown costs that could reverse the
decision require retention or deferral; a clear quality deficit may justify a change
despite unknown cache cost, with the tradeoff stated. A deferred switch assessment does
not make a completed task recommendation an unresolved destination gate.

### Select the action paragraph

For `retain` or `defer`, do not append `/model`, selectors or an invitation to apply the target.
Use the embedded UX contract to distinguish verified keep, provisional keep and a material blocker.
A nonblocking defer needs no routing confirmation. Unknown model metadata alone is not a blocker.
A proposed handoff still requires its independent context decision even when the model is retained.

Gemini CLI does not expose an agent-callable, verifiable current-model switch through this Skill.
Only for `decision: change` or an explicit user target, provide `/model` as the user control.
In `ask`, ask only whether to use the named target for an ordinary change, once. In `auto`, retain the actual setting and continue
only authorized work without material blockers. Never claim an application or a new conversation
unless that exact operation was performed and verified. Reasoning uses the model default unless
an exact native configurable thinking control is known. The shared UX examples are localized to
Traditional Chinese with `### Adaptive Task Routing` and one plain sentence explaining whether a new conversation is needed.
