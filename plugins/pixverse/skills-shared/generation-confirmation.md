# Generation And Optional Confirmation

## Default: Continue Automatically

The user's generation request authorizes work within the agreed deliverable. Run the
read-only preflight for every paid batch, including the first batch, later stages and
bounded repairs. With the default effective `skip` policy, briefly state what is being
made and proceed immediately. Do not ask “Would you like to generate?”, request a confirmation keyword,
wait for first-generation approval, or require previous generation receipts.

Use a natural progress update, for example:

> I will create four reference images using Sunburst 2K/high, then continue with video generation.

Keep task counts, selected model/quality, current balance and editable batch details
available in the preflight record. Mention balance when useful; do not turn every
progress message into a billing form or estimate an exact price without evidence.
Actual usage is recorded after generation. For Canvas, show its required bound-plan
sheet, then execute the exact returned command without waiting when policy is `skip`.

## Confirmation Is An Explicit User Preference

If the user says “Confirm each batch first”, “Tell me before spending credits”, “This is costing too much” or asks to control
spending, enable `require` for the current project before the next submission:

```bash
"${PVX}" preferences quote-confirmation require --project <slug>
```

Acknowledge once: “I have enabled confirmation for each batch. I will show you the details before generating.” Preserve any
stated budget or limit as a project constraint; confirmation does not prove an unknown
cost fits a hard budget. Do not submit work beyond that limit. If the user explicitly
applies the preference to all projects, omit `--project` to store it globally.

When effective policy is `require`, finish deterministic preparation and preflight
first, then present only the concrete next batch, model/quality and balance:

> This batch will create four reference images using Sunburst 2K/high. The current balance is 91,012 credits. Reply "Confirm" to begin.
> To continue future batches in this project automatically, reply 'Allow future generation'.

Localize wording and actual batch details. Offer continuation once, and again only
when useful. Normal confirmation copy should not explain internal preference names,
owner locks, skill filenames, English policy quotes or CLI commands. Provide such
detail only when the user asks, when needed to resolve a real problem, or when a
higher-priority host instruction requires it. Do not apologize for confirmation.

## Interpret Replies And Preference Scope

- “Confirm” / “Continue generating” after a shown batch approves that batch under `require`.
- “Allow future generation”, “Complete it directly” or “Do not ask again” explicitly restores automatic execution
  within the current project's agreed deliverable. Record it once with
  `"${PVX}" preferences quote-confirmation skip --project <slug>`, re-preflight and
  continue immediately. Do not ask the user to confirm the preference change.
- A new project choice acknowledges the current global setting, for either `require`
  or `skip`. A later explicit global change supersedes earlier project choices.
  Read the effective policy; raw `global_require` / `global_skip` flags alone are
  not the decision. Existing explicit preferences survive an upgrade; absent settings
  use automatic execution. Do not write a preference merely to apply the default.
- For Canvas, store the choice on its bound named project, re-preflight and execute
  the exact returned bound-plan command. Never swap flags on an older plan. Prior
  receipts remain recovery evidence, not a prerequisite for automatic generation.

Automatic execution stays within the requested project and reasonable repair scope.
It does not authorize unrelated deliverables, unlimited speculative retries, a model
downgrade, or bypass missing login, entitlement, balance, bound-plan checks, host
permissions or uncertain-submission recovery. If the result needs a material creative
choice or the user requested review, ask that specific question; do not add a general
paid-generation confirmation gate.
