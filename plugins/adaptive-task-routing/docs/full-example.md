# Complete routing examples

These are designed UX examples, not model-test results. Model names below are fictional fixture
labels, not selectable product options. All routing notes follow the findings or actionable plan
requested by the user. Both routers use `ask` unless stated otherwise.

## Keep after a plan-only request

The user requests a startup inspection and improvement plan, without implementation. The inspection
finds serialized initialization. Reliable observations and validation establish that
`fixture-balanced / medium` can handle the proposed follow-up checks if later authorized;
their short duration makes a change unlikely to repay setup costs.

```text
The inspection found independent reads being serialized. Improvement plan:
1. Defer optional services.
2. Parallelize independent reads.
3. Test startup order and duration.

---

### Adaptive Task Routing

✓ Keep current

If the planned follow-up checks are later authorized, the current setup has sufficient validation
evidence and switching offers little expected benefit.

Conversation: Stay here; no new conversation needed.
Current AI: fixture-balanced / medium.

The analysis and plan are complete. Implementation has not started.
```

No “keep current?” question is needed, and no implementation is authorized by retention.
When execution has already been requested, the ending instead identifies and performs the next
approved check. A completed plan is not a material routing blocker.

## Provisional retention

The catalog supports `fixture-balanced / high`, but the current model is unreadable. A bounded
check is already authorized and its results can be verified; no material quality blocker exists.
A known current pair with uncertain switching cost or benefit can also warrant provisional retention.

```text
Plan: compare version sources, inspect release artifacts, then run the relevant tests.

---

### Adaptive Task Routing

Keep provisionally

The benefit of switching is not established; the bounded checks can proceed with validation.

Conversation: Stay here; no new conversation needed.
Task-fit setting: fixture-balanced / high; this is not a request to switch now.

Continuing the authorized checks.
```

If failed validation makes responsible progress impossible, replace this action with **Need your
decision**, name the blocking choice and ask one concrete question. Unknown metadata alone is not
such a blocker. Do not certify an unreadable pair as suitable.

## Change and mixed handoff

The current fixture model fails the next phase's quality requirement. A supported target has a
justified advantage. In `ask`, propose the change before applying it:

```text
Plan: compare version sources, inspect release artifacts, then run the relevant tests.

---

### Adaptive Task Routing

Change AI setting

The next phase requires validation that the observed current setup has not handled reliably.

Conversation: Stay here; no new conversation needed.
Task-fit setting: fixture-balanced / high.

Use fixture-balanced / high?
```

If a new conversation is also recommended, lead with **New conversation with handoff** and answer
“Conversation: Start a new conversation with the necessary handoff, pending your decision.” Carry only the objective, confirmed findings, API
constraints, relevant artifacts and next step. Show destination settings only when supported
there; otherwise defer model selection explicitly. A retained model never settles the context
question. A clean start carries no old task-history handoff.

`auto` can apply only justified, authorized, callable and verifiable changes. Without those
controls, state the actual fallback rather than “applying.” Continue authorized work only if no
material quality or destination blocker remains. Explicitly accepted targets need no second
routing confirmation.

## Details and disabled components

A detail request reuses the gate and adds minimum needed, task-fit settings and upgrade rationale.
The internal `recommended_setting` name stays compatible. Switch scores and diagnostic provenance
are not ordinary detailed output. Context-off removes the entire conversation assessment;
Model-off removes model guidance and controls; both-off emits no routing note. Compact/detailed
are display preferences, not new modes.

## Unknown Gemini model

A native default reasoning value does not establish current model identity. If the model cannot
be reliably identified, use provisional retention, omit the default-only current AI field and
state uncertainty in prose. Keep the complete requested findings and plan before the routing
note, and end a plan-only response by acknowledging delivery without implementation. Successful
analysis alone cannot certify suitability for a different future phase.
