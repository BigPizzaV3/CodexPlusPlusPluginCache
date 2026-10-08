# OpenAI host discovery

Specification check: 2026-09-12. Recheck interfaces against the installed version.

## Codex CLI and App

Before presenting model controls, follow the model router's action-paragraph selection.
For `retain` or `defer`, use its retention/hold paragraph without `/model`, a selector
instruction or an invitation to apply the target. Unknown current settings alone never
trigger manual-switch advice. The control examples below apply only to a justified
`decision: change` or an explicit user-selected target, including the fallback path.

Prefer metadata or a documented read tool exposed by the current host. A catalog
must describe the effective destination, not the subagent menu or a different account.
If a local shell, Python 3.10+ and Codex CLI are available and permitted, run the
[optional read-only helper](../../skills/research-model-router/scripts/probe_codex.py).
First identify the surface from host/runtime metadata or the user's explicit statement,
then pass it explicitly. When neither source distinguishes CLI from App, use the
bounded automatic process-ancestry check instead of guessing:

```text
python3 /absolute/plugin/skills/research-model-router/scripts/probe_codex.py --surface codex-cli --cwd /actual/project
python3 /absolute/plugin/skills/research-model-router/scripts/probe_codex.py --surface codex-app --cwd /actual/project
python3 /absolute/plugin/skills/research-model-router/scripts/probe_codex.py --surface auto --cwd /actual/project
```

Resolve the installed path; do not copy the example literally, assume Python exists,
or infer the surface from the presence of a local shell. Do not default to
`codex-app` merely because the prompt lacks a CLI label. `auto` reports only a
classification and stable basis; it never prints process commands. A standalone
Codex CLI ancestor verifies CLI scope. When tool isolation hides that ancestor, an
exact `thread/read` result whose stable `source` is `cli` also verifies the current
CLI surface; this identifies thread origin, not live model settings. A Codex App
ancestor selects the conservative App rules below. Unknown or ChatGPT evidence
leaves catalog applicability unverified.

A subagent-only menu is not a failed main-context catalog read. When it is the only
visible menu, still use the permitted helper/read path above or reuse a fresh scoped
result. If that path is unavailable, record the concrete limitation (for example no
local CLI, denied access, timeout, or an unverified App/CLI scope). Missing live
current settings alone do not invalidate a catalog whose destination scope is verified.

The helper initializes a short-lived app-server and calls only `model/list`,
`config/read` and, when an exact thread ID is exposed, `thread/read` with
`includeTurns: false`. It follows catalog pagination, limits elapsed time/output,
returns only selected metadata and terminates its own process. It does not call
`thread/start`, `thread/resume`, `turn/start`, config writes or model switches.
The host may refresh its own catalog/cache/logs or use network authentication.

The short-lived app-server may need Codex-owned state outside a project-only shell
sandbox. If the helper reports `codex_state_unwritable` or `permission_denied`, stop
after that attempt and read the bundled
[`openai-codex-cli.json`](../model-catalogs/openai-codex-cli.json) when its `expires_at`
has not passed. On a recognized OpenAI surface listed in `reference_surfaces`, use the
file as cross-surface recommendation evidence without asking the user to transcribe the
selector first. Its inventory was observed in one CLI environment, so it establishes
account availability only there; its dated official capability source supports named
recommendations across the listed ChatGPT and Codex surfaces. Use the recorded models,
effort options, and descriptions to produce a concrete minimum-sufficient pair and
recommended pair for the task. Mark account availability, current settings and switch
necessity `unverified` in structured evidence; ignore the unknown current pair when
choosing those task-based settings. Do not present the registry as live App metadata,
and do not mention its use, applicability, freshness, or unreadable values in compact
user-facing output unless the user explicitly asks for diagnostics.

Catalog discovery never establishes switch capability. Follow [routing UX](../routing-ux.md).
For retain or nonblocking defer, omit model controls and continue only authorized work without
routing confirmation. A material blocker requires a useful question. For justified change or an
explicit target, an identified CLI may show `/model`; ChatGPT desktop/web uses its visible selector.
In ask, request the pending change once. In auto, use only authorized, callable, verified changes;
report the actual fallback if unavailable and do not proceed through a material blocker.
`/status` can supply user-reported settings, not an agent-controlled switch. Omit unreadable current
values from compact output. Do not repeat discovery within an unchanged gate.

Do not request broader permission during the normal fallback. If the user later
questions the recommendation, explain whether the result used current runtime data or
the bundled cross-surface reference, including the reference date and availability
limit. Ask once for a narrowly scoped read only when the active client exposes a
specific permission-gated path to that same App/session's `model/list`. Permission to
start or inspect a separate CLI/App Server is not a same-session read and must not be
presented as one. If no matching path exists, keep the fallback recommendation and ask
for the visible selector only if the user still wants an account-specific comparison.

Codex-specific host metadata, or loading this Skill from a Codex installed-plugin cache,
is positive product evidence even when it does not identify CLI versus App. A generic
ChatGPT sandbox containing a `codex` executable is not positive Codex-host evidence.

Interpret its results separately:

- `catalog`: models and effort options advertised to the queried CLI environment.
  Resolve destination applicability using the surface rules below. A returned
  identifier is availability evidence, not a successful inference or quality test.
- `disk_defaults`: configuration resolved for the requested cwd, not live settings.
- `thread_configuration`: matching thread's stable origin plus configured values if
  loaded on that server; otherwise last-persisted values, never per-turn telemetry.
  Exact `source: cli` may identify the surface even when the state is `notLoaded`,
  but it does not promote saved model/effort to live values. A read timestamp does
  not make a persisted value live. Missing thread metadata stays unknown.

### Resolve catalog applicability

Without `--surface`, the helper initializes `applicability: unverified` because it
cannot identify the caller's surface. This is an input to the router's scope check,
not a final verdict to copy unchanged. Resolve catalog applicability separately from
current settings and write capability:

- **Current destination is Codex CLI:** invoke the helper from the current task with
  `--surface codex-cli`, the resolved helper path and the current project cwd. A fresh
  successful catalog marked `applicability: verified` is candidate availability
  evidence for that CLI task even though the helper uses a separate process. Use it
  unless there is positive evidence that the current CLI was launched with a different
  remote, OSS provider, profile, model catalog, authentication context, or another
  availability-changing override that the helper did not receive. Do not require proof
  that no hidden override exists, a live thread bridge, matching saved values, or
  per-turn telemetry. Absence of such proof is not a scope mismatch. Evaluate the CLI
  session performing the work, even when the user launched it in another terminal;
  it need not match the conversation that installed or edited the plugin. A catalog
  copied from another conversation still needs its own scope check before reuse.
- **Current destination is Codex App:** a separate CLI runtime catalog is not App
  availability evidence. `--surface codex-app` keeps that availability unverified unless
  the helper uses a verified control socket for the App. When runtime access is absent,
  use the bundled file's official cross-surface capability reference to give concrete
  minimum and recommended settings immediately; do not require a copied selector list.
  Keep account availability unverified internally and direct the user to the App selector.

Once CLI scope is established, record the catalog as applicable and recommend from
its supported models/effort options using task-relevant capability evidence. The
helper may still report `current_configuration: unknown`, saved thread settings,
or an overall `status: partial` because a different read failed. None of these
invalidates a successful scoped catalog read. No live thread bridge, matching saved
model, or per-turn telemetry is required to recommend a pair. Current fields remain
unknown unless independently observed; do not promote matching disk and saved values
to live settings. Ask for selector options only when the OpenAI product itself cannot
be established or the bundled reference is expired or missing.

For a CLI task, returning `CURRENT / CURRENT` solely because the successful helper
ran in another process is an incorrect result. Runtime model descriptions plus
supported effort options are sufficient for a capability-based recommendation unless
they do not distinguish candidates for the task; benchmarks are optional evidence,
not a prerequisite.

### Observe current settings

By default a newly started process is not the App's live connection. Only when the
host/user provides a verified existing control-socket path may `--socket /absolute/path`
connect via `codex app-server proxy --sock`; never discover sockets by scanning private
state, start a daemon, or change App launch flags. Confirm the returned thread ID and
scope. Even a loaded thread's configured model is not proof of the model that served
a particular turn. Without a matching live bridge, retain unknown current values and
use persisted settings only as labeled hints.

## ChatGPT web, desktop and mobile

Use current host metadata or a user-provided selector inventory. Do not assume these
surfaces expose Codex RPC, a local shell, the same model IDs, or a configurable reasoning
effort. A sandbox containing Python is not evidence of access to the user's computer.
Do not run the Codex helper merely because a ChatGPT sandbox has a `codex` executable.
If a remote execution host exists, identify that destination before using its catalog.
With no runtime catalog, use the matching unexpired bundled cross-surface reference to
give both concrete settings without first requesting the current model/power menu.
Keep availability unverified and never infer the current pair from API documentation.
Use only controls actually exposed by that surface. When a visible
model/reasoning selector is available, name it as the manual action and do not mention
the CLI-only `/model` command.

## Sources

- [App Server methods and transports](https://learn.chatgpt.com/docs/app-server)
- [Codex model descriptions and selection guidance](https://learn.chatgpt.com/docs/models)
- [Skill resources and optional scripts](https://learn.chatgpt.com/docs/build-skills)
- [Plugin surface support](https://learn.chatgpt.com/docs/plugins)

The CLI and App must be tested separately. Context creation and configuration changes
require independent authorized, callable and verifiable capabilities; the helper grants none.
