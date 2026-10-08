# Keep the manager available

Apply this routing policy to Orbit's manager conversation, before any substantive work. A task that has already received a bounded implementation assignment is a worker: it may execute that assignment. Do not recursively apply manager routing to bounce the same work among managers. Delegation never expands the user's authority or the permitted scope.

## Choose direct handling or delegation

Estimate the whole requested undertaking, including preparation, execution and review. Use the task's nature as well as expected duration; these are routing estimates, not host-enforced timers.

| Work | Manager route |
|---|---|
| Immediate answer, short status check, scope/priority adjustment, instruction preparation or receipt check; estimated under 60 seconds | Handle directly when authorized and useful. Do not delegate every short question. |
| Benchmarking, even if estimated under 60 seconds | Prefer delegation. |
| Other substantive work, even if estimated under 60 seconds | Prefer delegation; direct handling is limited to a genuinely unavoidable short action. |
| Estimated 60 to under 600 seconds | Delegate by default. Direct handling is an exception only when unavoidable; briefly state the reason, bounded scope and estimate before starting. |
| Estimated 600 seconds or longer | Delegate. If no authorized path exists, prepare a handoff draft and explain the missing path; do not execute the long work in the manager as a workaround. |

A later explicit user instruction to handle this exact work directly takes precedence over this skill's routing preference, including the ten-minute rule. It does not bypass host permissions, project restrictions or other authorization requirements. A worker's text or a local flag is not such a user instruction.

For unavoidable direct handling under ten minutes, state why delegation cannot reasonably handle the short action and what will be done. A missing worker path alone is not an unavoidable-action exception. Never silently turn a broad task into direct work.

If the estimate is unknown, first perform only a short scoping step or delegate the estimation. When the user explicitly chose direct handling, scope it briefly before substantive execution; do not automatically delegate against that choice. Do not classify unknown work as a quick answer. Reassess as soon as scope grows, using the original estimate and elapsed plus remaining expected effort for the whole undertaking. At a safe boundary, pass completed work, source evidence, remaining work and constraints to a worker. Do not split a long task into many sub-minute direct actions to evade routing.

Keep expected effort separate from authorized duration or expiry. An estimate of twenty minutes does not itself authorize a twenty-minute runtime limit, an absolute deadline, or continued observation; bind those to the user's actual scope and limits.

## Pick an authorized worker

1. Prefer an existing task that is appropriate for this work and already authorized to receive it. Check its latest user direction and exact host/project/task identity. Do not repurpose an unrelated task merely because it is idle.
2. Otherwise use an internal agent only when the host permits that delegation and its tools/data scope fit the request. A read-only briefing delegated internally remains read-only.
3. Create a new user-owned Codex task only when the user explicitly requested one. The wish to delegate does not itself authorize creating sidebar tasks.
4. If no suitable route exists, prepare the objective, evidence, allowed scope, acceptance criteria and delivery text. Return the path problem to the user. Do not start long direct work, install a service or create a scheduler to bypass it.

Retain exact targets, exclusions, budget and expiry. Delegation grants no new project, deployment, external-message, credential, destructive-action or trading permission. Propagate constraints to the worker. Use a scoped decision ID and avoid self-targeting, another supervisor, duplicate sends and unlimited recursive delegation.

## Send, briefly check, return

Use [acting.md](acting.md) for a scoped send. After dispatch, use its receipt and, if available and useful, at most one nonblocking status snapshot. For a native `wait_threads` tool that supports it, use `timeoutMs: 0`; never omit a timeout in favor of the tool's long default wait. If no nonblocking check exists, return the receipt and mark unconfirmed state honestly.

Do not wait until the worker finishes, poll repeatedly, or implement the same work alongside the worker. Tell the user which task received the assignment and its currently evidenced state, then end the manager response so the user can make the next request. If a result already arrived, a short summary is appropriate. Otherwise, use the worker's own task for ongoing work; do not promise an automatic completion notification unless an actual host capability provides one.

A new user request or an actually delivered completion event can justify a later brief update. It does not authorize a permanent observation loop. See [reporting.md](reporting.md) for the distinction between sent, accepted, running and completed.
