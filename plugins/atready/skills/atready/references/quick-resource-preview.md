# Protected Quick Setup Preview and Save

Use this short reference only after the user approves an unchanged bundled-purpose recap for one
unambiguous profile with definite strength, availability, and private-work answers. Use
[resource-onboarding.md](resource-onboarding.md) for Detailed Setup, custom or ambiguous resources,
corrected purposes, extra facts, `Not sure` answers, or complete declarations. Keep one resource per workflow.

## Facts envelope

Encode only the approved facts and reuse this bounded JSON for preview and apply:

```json
{"schema_version":1,"name":"CodeRabbit","strength":"strong","available_now":true,"private_work":true}
```

Allow only `schema_version`, `name`, `strength`, `available_now`, and `private_work`. Strength is
`basic`, `solid`, `strong`, or `exceptional`; the last two fields are strict booleans. Exclude
credentials, private content, inferred provider/account state, and extra fields.

## Preview

Require approved local execution and filesystem access. Otherwise request that authorization or
direct the user to the standalone guided `atready add`. The `exec` command below is only for a
disposable host session; never present it as a human-run fallback.
Start a fresh POSIX writable terminal session with this exact static shell `exec` command and no
facts in the command:

```bash
exec "/absolute/path/to/python3" "/absolute/path/to/atready/scripts/atready.py" \
  resource quick-add --facts-json-line --json
```

Wait for exact marker `ATREADY_FACTS_JSON_LINE_READY`, then send the UTF-8 JSON as one line of
at most 4096 bytes plus one newline through one call to the session's stdin writer within 30 seconds.
Send nothing else. The marker means terminal echo is off. Without it,
send no facts and stop. Never place the JSON or resource name in a shell command or temporary file.
This handshake supports POSIX terminals (macOS/Linux) only. On Windows, use Detailed Setup's
protected-file branch.

For a user-selected roster add `--path /absolute/path/to/inventory.yaml`. The configured roster
omits `--path`. The add request does not authorize roster creation; if the target is missing, ask
before separately initializing it under the Detailed Setup target contract.

Accept a preview only with exit `0`, strict JSON, `status: preview-ready`, format
`atready-resource-quick-preview-v1`, and exactly these false effects: `network_accessed`,
`provider_or_account_inspected`, `resource_run`, and `writes_performed`. `inventory_read` must be
true. Require one canonical nested `preview` with the intended resource, exact target, expected
revision, plan token, and no `applied` mutation claim. Keep that nested preview only for the exact
apply binding. Require the CLI-owned `human_preview` string and display it verbatim. Do not show
the nested preview, mapping, correction, effects, target, revision, plan token, defaulted fields,
ratings, or other internal schema labels. Then ask separately:

> Save exactly this entry?

## Mismatch recovery

On a stale revision or plan mismatch before complete preview, discard old tokens but keep the latest approved facts. Exact
same-task `retry preview` re-resolves the target and starts a fresh writable terminal preview; a
second mismatch stops; do not offer another retry. This is the only retry. A fact change returns to recap; another task restarts intake. Never retry
apply or waive save approval.

## Apply and verify

Only a later explicit yes to `Save exactly this entry?` authorizes apply. Resend the same facts and
the exact latest preview tokens in a fresh POSIX writable terminal session:

```bash
exec "/absolute/path/to/python3" "/absolute/path/to/atready/scripts/atready.py" \
  resource quick-add --facts-json-line --apply \
  --expect-revision PREVIEW_EXPECT_REVISION --expect-plan PREVIEW_EXPECT_PLAN --json
```

Wait for `ATREADY_FACTS_JSON_LINE_READY`, then repeat that one-call transport with the unchanged
JSON. Send nothing else. The preview session has exited and cannot be reused. No shell
interpolation or temporary declaration is permitted.

Include the same `--path` choice used for preview. Never retry apply. Accept success only with exit
`0`, strict JSON, format `atready-resource-quick-apply-v1`, `status: applied`, the same mapping,
and a nested receipt proving the intended ID, `applied: true`, `replacement_verified: true`,
revision equal to candidate revision, no warnings, observed revision protection, and POSIX
directory sync where applicable. Then run strict inventory validation and listing through the
bundled launcher and require the same revision and resource ID. Report uncertainty exactly; do not
claim a save.

Preview and apply never contact or run the resource. Preview is no-write; apply writes only the
separately approved local roster update. Neither approval authorizes provider access or execution.
