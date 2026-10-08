# Full supported operations mode

Use this mode when the user requests all currently supported Developer Kit
capabilities or the `0.6.0` full supported operations wave.

- Select exactly 88 API operations: 17 first-wave, 43 second-wave, and 28
  third-wave.
- Add `crosscutting:api-authentication` and `crosscutting:webhook-receiver` for
  a total of 90 coverage rows.
- Route every row to its fixed owner from the generated capability summary.
- Require a linked client/service/handler seam and operation-unique behavior
  test for every implemented operation. Cross-domain rows additionally require
  producer and consumer handoff evidence.
- Preserve `full-first-wave` at 19 rows and `full-whatsapp-operations` at 62 rows;
  selecting this mode must not redefine either compatibility contract.
- Do not require or generate a dashboard or test console. The default delivery
  remains server-side project seams plus no-network tests.
- Disclose SMS, Verify, Voice, and Email as 7 operations
  `excluded-by-product-decision`. Do not describe product exclusion as provider
  deprecation or claim coverage of all 95 operations.
- Keep credentials, customer data, real provider calls, and remote mutations out
  of generated artifacts and verification.

Completion requires 90 explicit statuses with no silent omissions. A route
label, sample payload, generated type, shared no-op seam, or repeated assertion
is not operation evidence.
