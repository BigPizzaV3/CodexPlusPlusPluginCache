# Workflow Proof Gates

## Universal gate

A business-logic finding must show:

1. a target-specific invariant supported by evidence;
2. a valid baseline with defined business-success semantics;
3. one precise manipulation or concurrency condition;
4. an authoritative before/after, readback, or comparable impact signal;
5. a reproducible unsafe outcome on a safe fixture;
6. cleanup/restoration status and redacted evidence.

## Claim-specific gates

| Claim | Required proof | Insufficient alone |
|---|---|---|
| Price/value manipulation | Authoritative order/quote/balance/entitlement state reflects the unauthorized value or effect | Request accepted or value echoed |
| Workflow bypass | Later transition or protected outcome completes without the required prior state | Direct endpoint returns a page or validation error |
| Duplicate/replay | More than one benefit/action persists when policy allows one | Multiple responses, multiple tokens generated |
| Race condition | Concurrent batch violates an invariant while sequential controls do not | Timing anomaly or several 2xx statuses |
| Quota/rate bypass | Repeated security-sensitive business successes exceed the intended limit, or a paired variant succeeds while the control remains limited | Missing headers, rejected attempts, no HTTP 429 |
| Mass assignment | Target-derived privileged property persists and causes ownership, privilege, financial, or policy effect on a disposable object | 2xx or reflected property without readback |
| Excessive property exposure | Sensitive property is returned to an actor who should not receive it, with role/tenant expectation proven | Extra field name with no sensitivity/denial context |
| Old version/parser bypass | Same logical operation and actor bypass a current control through the alternate version/parser | Old route is reachable or responses differ |
| Webhook abuse | Attacker callback, unauthorized registration, accepted forged/replayed event, or downstream state change | Endpoint exists or event payload is accepted syntactically |
| Generated-link/host abuse | Attacker-controlled destination appears in the actual delivered/generated link or causes controlled redirect/routing/cache impact | Host reflection |
| Cache poisoning/deception | Separate follow-up request receives poisoned or identity-specific cached content with stable cache evidence | First response or cache headers alone |

## Candidate handling

When proof is incomplete, retain:

- exact operation, actor, object, workflow state, and mutation;
- observed response and why it is ambiguous;
- missing readback, identity, invariant, owner, or side-effect proof;
- safest next validation and whether it requires a disposable environment.

Do not label a candidate confirmed or increase severity based on plausible downstream harm.
