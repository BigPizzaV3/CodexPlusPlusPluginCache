---
name: ai-hooter
description: Use AI Hooter when the user explicitly asks to be hooted, called, summoned, or alerted, including persistent project-wide grants such as “use Hooter whenever you need me” and explicit revocations of that grant. Never use it for routine updates or without an explicit task or project authorization.
---

# AI Hooter

AI Hooter is an opt-in human-attention workflow for Codex on macOS. It plays a
funny local voice alert through the separately installed AI Hooter Mac app.
The pairing credential and all alerts stay on localhost.

## Use the bundled helper

Resolve `scripts/hooter-cli.mjs` relative to this `SKILL.md` and execute it with
the Mac's installed `node` runtime. Never download or substitute another
script. Run commands from the user's current project so project-scoped
authorization is associated with the correct project.

The helper prints one JSON object. Treat `ok: true` as success. Every command
that can contact the local Mac app (`pair`, `status`, `forget`, `call`, and
`acknowledge`) must be run with Mac-local or localhost access on the first
attempt. Do not try those commands inside the restricted task sandbox first:
it can block `127.0.0.1` even when the app is running and correctly paired.
The local-only `arm` and `disarm` commands do not need localhost access.

If a command was accidentally attempted without that access and the helper
reports that it could not reach the local macOS app, retry the exact same
bundled-helper command once using Mac-local or localhost access approval. Do
not download another helper, change the command, re-pair, or tell the user the
app is offline before that retry. If an access-approved attempt fails, show the
returned message once and continue safely.

For every other failure, show the returned message once and continue safely.

## Pair the Mac app

Pairing and authorization are separate. Pairing connects Codex to the local
Mac app; it does not grant permission to hoot.

When the user explicitly asks to pair, connect, or set up AI Hooter, run:

`node <helper-path> pair`

Tell the user to click **Allow** on the approval card opened by AI Hooter and
wait for the command to finish. Confirm success only when the helper returns
`ok: true`. A fresh successful pairing makes the Mac app speak its own pairing
confirmation. Do not send a separate `call`; pairing still grants no permission
for later Codex alerts.

Use `node <helper-path> status` only when the user asks whether Hooter is
connected. Use `node <helper-path> forget` only when the user explicitly asks
to forget, disconnect, revoke, or reset local pairing.

## Authorization scopes

AI Hooter is off by default. Do not infer permission from installation,
pairing, or ordinary status language.

A request such as “Hoot me when this task finishes” authorizes only the named
task or condition. A request such as “Use Hooter whenever you need me for this
project” grants persistent project scope. For persistent scope, run:

`node <helper-path> arm`

The bundled SessionStart hook restores that saved project authorization in
future Codex tasks for the same project. Never carry it to another project.

When the user explicitly revokes persistent project permission, run:

`node <helper-path> disarm`

## Deliver an authorized hoot

When the authorized condition occurs, run exactly one command:

`node <helper-path> call --event <event> --project <project> --summary <summary> --urgency <urgency>`

Allowed events are `attention`, `decision`, `question`, `access`,
`browser_handoff`, `approval`, `blocked`, `security_critical`, `review`,
`complete`, and `summary`. Allowed urgencies are `normal`, `important`, and
`critical`.

Keep `project` between 1 and 80 characters. For ordinary events, `summary` is
visual dashboard context; the Mac app speaks its built-in or user-selected
phrase, and metadata length must never block delivery. Use event `summary` only
when the user explicitly asked to hear a completed-work summary; its supplied
text is spoken aloud, must be at most 700 user-visible characters, and must stay
within four concise sentences.

Never put source code, credentials, tokens, private customer data, or long
error output in a summary. Quote every command-line value safely. If a value
cannot be represented safely, shorten or paraphrase it instead of exposing
the original data.

Preserve the returned `hoot_id` until the user's next message. When the user
returns, acknowledging that matching summon is the first action of the new
turn. Run this as the first tool action, before commentary, analysis, planning,
other tools, edits, tests, or a user-facing response—even when the new message
also contains another request:

Multiple Codex tasks and projects may have outstanding Hoots at the same time.
Each task must retain only the `hoot_id` returned to that task. Never replace it
with a global “latest” ID or acknowledge an ID learned from another task.

`node <helper-path> acknowledge --hoot-id <hoot-id>`

Run that first tool action with Mac-local or localhost access on its first
attempt. Wait for the helper result, then clear the remembered ID and continue
with the user's message. Never acknowledge an ID from another task. A
reachability failure from an attempt that lacked Mac-local access is the one
exception to the no-retry rule: make the required access-approved retry before
clearing the ID. After an access-approved failure, show the returned message
once, clear the remembered ID, and continue safely without another retry.

## Attention rules

For an authorized task or project, hoot before waiting for the user when
meaningful progress depends on the user doing, seeing, testing, choosing,
approving, unlocking, signing in, handing over a browser, or supplying
information. Completing the user's requested work is also an attention event
when the user asked to be hooted on completion.

Time the hoot at the attention boundary, never while autonomous work remains.
For completion or review, finish every edit, command, test, and verification
first. Make the helper call the final tool action, then immediately send the
finished user-facing response. Do not continue thinking through the task,
running tools, or making changes after a successful hoot.

For a question, approval, access request, or handoff, prepare the complete
user-facing request first. Make the helper call the final tool action, then
immediately send that request. Never hoot merely because work has started or
while the user would return to an agent that is still working.

Do not hoot for routine commentary or progress. Call at most once for the same
condition. A standing project authorization may be reused for later distinct
attention conditions until the user revokes it.
