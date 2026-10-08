# Full WhatsApp operations mode

Use this compatibility mode when the user explicitly requests the `0.5.0` full
WhatsApp operations wave. Requests for all currently supported Developer Kit
capabilities use `full-supported-operations` instead.

- Select exactly 60 API operations: 17 first-wave and 43 second-wave.
- Add `crosscutting:api-authentication` and `crosscutting:webhook-receiver` for
  a total of 62 coverage rows.
- Route every row to its fixed owner from the generated capability summary.
- Require a linked client/service/handler seam and operation-unique behavior
  test for every implemented operation. Cross-domain rows additionally require
  producer/consumer handoff evidence.
- Do not require or generate a dashboard or test console. The default project
  delivery is server-side TypeScript/Fastify seams plus no-network tests.
- Disclose the nonselected 28 third-wave operations as covered by the broader
  `full-supported-operations` mode and the 7 SMS/Verify/Voice/Email operations
  as `excluded-by-product-decision`. Do not describe product exclusion as
  provider deprecation.
- Keep all external calls, credentials, customer data, and remote mutations out
  of generated artifacts and verification.

Completion requires 62 explicit statuses with no silent omissions. A route
label, sample payload, generated type, or shared no-op seam is not operation
evidence.
