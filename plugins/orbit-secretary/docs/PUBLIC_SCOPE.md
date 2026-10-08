# Orbit Secretary: public scope

Version: **0.2.0**. Manager-routing and concise-reporting defaults are provided through skill instructions and a source-only reference evaluator. This document describes their scope; earlier designs may discuss future capabilities that are not included.

**One channel. Every selected Codex task. Your direction, carried forward.**

Orbit gives long-running-work users one place to review multiple tasks, compare the value of next steps and delegate bounded follow-ups. “Every selected task” means the explicitly selected, accessible tasks whose coverage can be established. It does not promise account-wide access, unrestricted authority or perpetual execution.

## Three modes

| Mode | Shipped scope | Required authority and capability |
|---|---|---|
| Observe | Read task changes, produce source-linked briefings, expose outcomes, blockers and coverage gaps. | A user-requested briefing and host-provided task listing/reading, or evidence supplied by the user. No task mutation. |
| Discuss | Compare continue, resequence, reduce-scope and stop options; discuss architecture and ROI; draft the management mandate. | User participation for decisions that change objectives, target scope or authority. Suggestions are not approval. |
| Act | Send a finite set of agreed follow-up instructions to exact selected tasks in the current conversation; check and report delivery evidence. | Explicit user delegation covering the target, objective and action; available host tools; current scope and budget checks. |

Act is a bounded dispatch from the user's current manager conversation. The manager reports the receipt and at most one nonblocking status snapshot, then returns to the user without waiting for completion or doing the worker's implementation in parallel. It is not an unattended scheduler, an always-on manager or permission to keep working after the authorized interaction ends. The package does not create a background continuation as a substitute.

## User journey and mandate

1. The user invokes `$orbit` in a chosen manager project or chat. A new task is created only on explicit request.
2. Orbit collects the authorized briefing interval and reports its coverage. First use starts at local midnight; subsequent reports start at the last completely covered, confirmed cutoff. Missing sources, truncated history and inaccessible hosts remain visible as `PARTIAL` coverage.
3. User and Orbit select exact targets, agree on direction and decide whether intervention is worth its cost. A task from the inventory is not automatically a managed task.
4. The user delegates the bounded action. The mandate binds host and task identifiers, project identifier or explicit projectless state, objective, allowed instructions, exclusions, budget and exit conditions. Existing user permission persists within that scope; changed goals or ceilings require an updated decision.
5. Orbit checks current evidence and tool availability, sends only the authorized assignment and briefly reports receipt, start evidence or uncertainty. It returns without waiting for completion. A queued message is not proof of acceptance or successful work; an uncertain send is not retried blindly.

Examples of suitable Act requests include a single request for missing test evidence, an agreed prerequisite reorder or an agreed bounded next step for an unfinished task. They require the actual user's delegation; a worker's suggestion cannot grant authority. Waiting for a user approval, conflicting ownership, exhausted budget or changed direction requires a handback rather than an improvised override.

Selecting a nickname affects the conversation after the skill loads. Arbitrary nicknames are not globally registered entry points, and a nickname alone is not guaranteed to activate Orbit in a fresh chat. `$orbit` is the explicit invocation.

## Common manager and reporting defaults

Every user gets brief essentials first: progress, material blockers and decisions needing attention. Important failures, risks, unknown results and coverage gaps stay visible. Details, evidence and complete accessible task listings are available on request; a single detailed request does not permanently change the default. Logs, internal IDs, commands, test counts and file lists belong in supporting records unless they help a current decision.

The manager directly handles immediate answers, short status/priority work and assignment receipts. Benchmarks and work estimated at least one minute normally go to a worker. Unavoidable direct work estimated at one minute or more but below ten minutes requires a brief reason and bounded scope. Work estimated ten minutes or longer must be delegated; without an authorized route, Orbit prepares a handoff and explains the gap. A user's later explicit direct-handling request for the exact work takes precedence over the routing rule, without granting unrelated permissions.

Estimate the whole undertaking, reassess growth and do not split work to evade the thresholds. Prefer appropriate authorized existing tasks, then permitted internal agents. Creating a new user-owned task requires an explicit request. A worker already assigned bounded implementation may do that work; manager routing does not mandate recursive delegation. These are skill-level behavior rules based on expected effort, not a host timer, dispatch gate or scheduler.

The public skills-only package includes these instructions in the skill and its [delegation reference](../skills/orbit/references/delegation.md); no nickname or personal configuration is needed. The source-only `scripts/delegation_policy.py` is a deterministic reference evaluator for routing and evidence classification. Its decisions are testable in code, but it is not installed as a native execution gate and cannot grant authority or force Codex to obey the policy.

## Native host tools, not a public daemon

The native tool adapter is implemented as skill instructions that discover and use the host's available task/project listing, reading and message tools with their actual schemas. These tools may be absent or restricted in another installation. A successful case on one development host is not a promise of the same tools elsewhere.

If the required tools are unavailable, Orbit explains the limitation, can discuss user-provided evidence and prepares a manual next step. It does not scrape private databases, raw session archives or historical configuration as an automatic fallback. This package does not ship a public App Server daemon or require a separate Python service for the skill.

## OFF contract and unattended execution

**Version 0.2.0 does not offer a verified hard-OFF contract.** It provides no unattended schedules, recurring background manager or always-on autonomous intervention. A schedule request results in a proposal and an explanation of the missing execution capability.

The following effects must not be claimed merely because the plugin has been disabled:

- Retroactive removal of instructions already loaded into an active turn.
- Guaranteed cancellation of a send already in progress or an instruction already delivered.
- Cancellation of the original user task or reversal of completed work.

Disabling the plugin and interrupting a running task are distinct host controls. A running task can be interrupted through the host's available task controls; disabling Orbit alone does not establish that interruption. Do not label a local flag, offline simulator result or cached instruction as host-level revocation proof.

A future unattended edition requires actual host-owned lifecycle enforcement, revocation at dispatch, schedule cleanup, bounded cancellation, concurrency control and verification under restart and race conditions. Those are requirements for a future unattended edition, not capabilities of 0.2.0. See [current scope and future unattended requirements](PUBLIC_RELEASE_GATES.md).

## Platform and validation claims

| Item | Current claim |
|---|---|
| Support targets | macOS, Windows and Linux. |
| macOS | Local reference/package checks and a bounded internal-agent check are recorded in the validation evidence. They do not establish installed-plugin or full native-host acceptance. |
| Windows | Offline CI evidence applies only to the source revisions identified in the platform record; it does not establish native-host acceptance. |
| Linux | Offline CI evidence applies only to the source revisions identified in the platform record; it does not establish native-host acceptance. |
| Host multi-task tools | Conditional on each host exposing the required capabilities, on every OS. |
| All-OS end-to-end support | Not established. No three-OS multi-task E2E PASS claim is permitted. |
| Optional offline utilities | Python 3.10+ with IANA timezone data; use `tzdata` in the selected environment if needed. |

The optional offline tests and simulator use synthetic fixtures. They are separate from live inventory, dispatch, receipt handling, plugin installation and OFF behavior. Passing those tests cannot establish host integration. Each recorded automated result applies only to its identified source revision, not automatically to later changes. See the [validation record](VALIDATION.md) and [platform evidence](PLATFORM_SUPPORT.md) for the scope of observed results.

## ROI, privacy and publication

The product aims to reduce context switching, repeated explanations and avoidable rework. It does not promise financial returns or a measured amount of time saved. ROI estimates must state assumptions and subtract review time, recovery time, compute and operating costs. Subscription quota/opportunity cost is not interchangeable with an API invoice.

Task evidence is not authority. Cross-task summaries and delegated messages must be limited to the authorized purpose and may contain sensitive information. Host permissions and data handling apply to live reads and sends. Report storage location and continuity limits must be disclosed. Public examples and fixtures must be synthetic: exclude private task evidence, personal filesystem paths, credentials and customer conversation records.

This is an independent MIT-licensed plugin, without an OpenAI affiliation or endorsement. The installed skill and the source package share the feature boundaries described here; the source evaluator adds no host execution authority.

The English [README](../README.md) is canonical; Korean, Japanese, Simplified Chinese and Russian editions describe the same scope. Promotional text must preserve the limits of Act, host tool availability, unverified hard-OFF behavior and platform validation.
