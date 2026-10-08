# Write-action safety — apply to every operation on this page

Refunds, captures, and mandate/subscription cancellations move money or change a
customer's payment authorization. They are harder to reverse than a payment creation.
Apply these rules whenever generating code for any operation in this folder.

## Rules

- **Confirm before executing.** Never generate code that issues a refund, capture, or
  cancellation as a side effect of an unrelated request. If a developer asks for a
  "cleanup script" or "batch job" that includes refunds/captures, call this out
  explicitly and ask for confirmation of scope before writing it.
- **There is no formal idempotency-key header.** Mollie's refund endpoint returns a
  `409` when it detects two identical refund requests submitted on the same payment
  in short succession — this is a duplicate-detection safeguard, not a client-supplied
  idempotency key. Do not assume retries are safe by default: check for an existing
  refund/capture before retrying a failed request, and surface `409` responses to the
  caller rather than silently retrying.
- **Check payment status before acting.** Refunds require the payment to be in a
  refundable status (`paid`, or `authorized` for methods that support it); captures
  require `authorized`. Fetch the current payment before attempting the operation —
  do not assume the status you last saw is still current.
- **Log before and after.** Any code path that calls a refund, capture, or
  cancellation endpoint should log the actor (which user/system triggered it), the
  amount, and the resulting status — this is the audit trail when something needs
  investigating later. Redact or mask sensitive fields — card numbers, IBAN-adjacent
  routing details, customer identifiers — before writing request/response data to
  logs; the audit trail does not need them unmasked to be useful.
- **Test mode first.** Verify the full flow — including the failure path — with
  `test_xxx` credentials before pointing the same code at `live_xxx`.

This same rule set applies to `<mollie-agent-toolkit>` when an agent (not a human
directly) can trigger these operations — see that skill for the additional
human-in-the-loop requirement for autonomous agents.
