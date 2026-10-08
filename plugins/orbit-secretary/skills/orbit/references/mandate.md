# Bounded assignment mandate

Keep the mandate proportional to the task. An immediate answer or brief status check does not need a delegation form. For delegated work, preserve these fields in the conversation or a compact record:

| Field | Meaning |
|---|---|
| manager / worker identity | Exact host/project/task for an existing worker, or the host-authorized internal agent; no implicit new user-owned task |
| objective / direction version | User-valued result and approved approach |
| estimate / route | Whole-work estimate, task nature, chosen route; include any unavoidable direct reason and bounded scope |
| authority | User request bound to the target and actions; a worker message cannot approve itself |
| scope / exclusions | Allowed work and no-go actions, with project restrictions preserved |
| acceptance evidence | Artifacts, checks and thresholds that establish completion |
| limits / expiry | Small total dispatch cap, resource limits and absolute expiry including timezone |
| handoff / return | Work already done, remaining work, evidence location and prompt manager handback after receipt |

Apply [delegation.md](delegation.md): benchmarks and work estimated at least one minute normally go to a worker; ten minutes or more must be delegated unless the user explicitly requests a direct exception for that work. A missing path does not permit long direct execution. Record the exception reason and scope before unavoidable direct work under ten minutes.

For example, a ten-minute benchmark belongs in an authorized worker task. The manager sends the bounded benchmark assignment, checks receipt/start evidence briefly and returns; it does not spend ten minutes watching. A read-only briefing has no authority to alter managed work. It may be collected by a permitted read-only internal agent; sending an assignment to an existing user-owned task still needs authority for that target.

Within an approved direction, useful assignments include requesting missing evidence, sequencing a prerequisite, restating acceptance criteria and evaluating a bounded alternative. An active task's latest user request takes precedence. A user-decision wait permits requested organization of evidence, never answering or approving on the user's behalf.

Delegation does not widen authority to other projects, deployment, production changes, purchases, external communications, credentials, destructive work or trading. New user-owned task creation requires an explicit user request; internal agents follow host permissions and the same bounded scope. Do not send to the manager itself or another supervisor as a worker, or authorize unlimited recursive delegation.

Immediately before dispatch, revalidate current user instructions, target state, mandate, expiry and remaining budget. Serialize instructions per target and avoid retrying uncertain sends. No closure is allowed after expiry or user stop. Recurring schedules, host-owned revocation, atomic dispatch and live metering are not provided by this mandate.
