# Research Model Router evidence schema

This schema is internal diagnostic evidence. Do not render it in ordinary compact routing output. Read it only when the user requests diagnostics or when maintaining the router implementation.

```yaml
skill: research-model-router
phase: short description of the upcoming work phase
task_requirements:
  capabilities: [phase-specific needs, not model names]
  reasoning_demand: low | moderate | high
  quality_and_validation: short requirement
  latency_and_usage: user constraints or unspecified
discovery:
  status: not_probed | available | partial | unavailable | permission_denied | error | stale | scope_mismatch
  attempts: [source, outcome and limitation, without secrets]
  scope: product, surface, execution host and effective context
  observed_at: timestamp | unknown
  missing_information: []
capability_evidence:
  source: runtime description | official documentation | task evaluation | unavailable
  reference: source identifier or URL | null
  observed_at: timestamp | unknown
  recommendation_basis: inferred | measured | insufficient
current_configuration:
  model: observed model name | unknown
  reasoning_effort: observed effort | unknown | unsupported
  evidence: runtime metadata | user-provided settings | cached observation | unavailable
  scope: matching live configuration | user-reported | unknown
model_catalog:
  availability: available | unknown
  source: runtime metadata | user-provided settings | cached observation | versioned fallback | unavailable
  observed_at: timestamp | unknown
  cache_scope: current session | host-defined short lifetime | none
  applicable_to_context: verified | unverified | mismatch
assessment: suitable | change_recommended | unverified | deferred
minimum_sufficient_setting:
  model: supported model name | CURRENT | null
  reasoning_effort: supported effort | CURRENT | null
  availability: verified | unverified | unknown
  reason: why this is sufficient for the task
recommended_setting:
  model: supported model name | CURRENT | null
  reasoning_effort: supported effort | CURRENT | null
  availability: verified | unverified | unknown
upgrade_value: low | medium | high
upgrade_reason: additional value over the minimum, or why a stronger pair would not help
switch_assessment:
  effective_context: CURRENT | HANDOFF | CLEAN | null
  context_basis: resolved_gate | context_off | model_only
  continuity_reason: value preserved and setup or handoff cost
  baseline: current_configuration
  target: recommended_setting
  remaining_phase: expected work and opportunity to amortize switching costs
  cache_evidence:
    status: observed | inferred | unknown
    source: scoped usage or official host rules | unavailable
    observed_at: timestamp | unknown
    scope: provider, model, prefix and relevant settings | unknown
    reuse: supported | at_risk | unknown
  quality_floor: met | unmet | unknown
  switching_cost: low | medium | high | unknown
  switch_value: low | medium | high | unknown
  decision: retain | change | defer
  reason: net next-phase benefit versus retaining, with material uncertainty
confidence: 0.00-1.00
reason: one concise phase-specific explanation
mode: off | ask | auto
disposition: skipped | awaiting_user_confirmation | awaiting_user_action | applied | kept_current
interaction:
  presentation: compact | detailed
  continuation: authorized | not_authorized | blocked
  material_blocker: null | concise quality or destination blocker
  confirmation_required: true | false
revisit_at: meaningful next stage transition | null
runtime_capabilities:
  surface: identified surface or unknown
  switch_current_model: agent | orchestrator | user_only | unavailable | unknown
  set_model_for_new_run: agent | orchestrator | user_only | unavailable | unknown
  set_reasoning_effort: agent | orchestrator | user_only | unavailable | unknown
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

In `ask`, record `awaiting_user_confirmation` only for a pending justified change or a material blocker. Retain and nonblocking defer record `kept_current` / `retained_current`; `interaction.continuation` separately records whether work is authorized. A plan-only completion is not a pending routing confirmation. `manual_action` holds a control only for a justified change or explicit target. In `auto`, when switching is
unavailable but downstream work remains authorized, record `disposition: kept_current`
and `execution.status: retained_current` while continuing with the current setting.

`upgrade_value` compares the two task-based settings; `switch_value` compares the
observed current pair with the recommended target. Unknown baseline means unknown
switch value and `decision: defer`. Cost uncertainty may coexist with `change` only
when a clear quality deficit justifies the tradeoff. An already matching pair means
`retain` with low switch value. Context-off and model-only use the current conversation
without claiming a context suitability assessment. Keep cache observations scoped and
session-local; never log activity or start paid probes. In `auto`, `retain` and `defer`
mean `execution.status: retained_current`; only `change` can proceed to independently
verified application. An unresolved destination still uses `assessment: deferred`
and null model fields under the existing contract, rather than inventing a context.
