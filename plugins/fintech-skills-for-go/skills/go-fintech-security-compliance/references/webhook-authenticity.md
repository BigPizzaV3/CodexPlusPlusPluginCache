# Financial webhook authenticity

A webhook delivery crosses two boundaries. Cryptographic verification can authenticate the provider-specific delivery under a configured key; it does not prove that the event is new, ordered, authorized for the local tenant or resource, or safe to apply to the current financial state.

## Verify the provider's exact contract

Route the request to an endpoint configuration that fixes provider, account or merchant, environment, webhook identity, algorithm, key generation, payload limit, and schema/API version. Do not select these from unsigned payload fields.

- Stripe verifies the exact raw request body, `Stripe-Signature` header, and secret for that endpoint. Parsing and re-encoding JSON changes the signed bytes. Test and live endpoints and distinct endpoint registrations use distinct secrets. Its signed timestamp and bounded clock-aware tolerance mitigate replay of one delivery, but retries receive new signatures and timestamps.
- Adyen Standard webhooks sign a specified ordered field representation, while some other webhook types sign the raw body in a header. HMAC keys are endpoint- and environment-specific. Key changes can take time to propagate, so a controlled overlap may need to accept the previous and current key generations.
- PayPal verification uses its transmission headers, registered webhook ID, event body, certificate or verification API, and documented algorithm. Treat certificate retrieval or remote verification as an outbound trust and availability boundary; never fetch an arbitrary unsigned URL without validation.

Prefer the provider's maintained library when it implements the active contract. Bound the raw body before retaining it, use constant-time MAC comparison through maintained cryptographic APIs, and keep signature material, secrets, and sensitive payloads out of logs and model or support tools.

## Separate receipt from business effect

Only a verified envelope enters the trusted processing queue. Persist provider, endpoint/account/environment, event and delivery identity, signature/key generation, verification time and result, signed timestamp, payload digest, schema/API version, and protected raw evidence when retention policy permits it.

Timestamp tolerance is not deduplication. Atomically claim a stable event or semantic-effect identity with the local transition so retries, manual resend, regional recovery, and concurrent workers converge. Expect duplicate, late, and out-of-order events. When a provider identity is not sufficient for the business effect, bind it to the provider resource, event type, amount/currency, lifecycle generation, and local operation.

A valid signature is not local authorization. Resolve the configured provider account and tenant, verify the referenced resource and current state, reject cross-tenant or wrong-environment references, and fetch authoritative provider state when the event contract requires convergence rather than trusting a stale event snapshot.

## Rotate and acknowledge deliberately

Version keys and secrets, audit access and rotation, define overlap and revocation, and remove an old generation only after provider propagation, retry windows, queued deliveries, disaster recovery, and rollback no longer need it. Never fall back to unsigned acceptance when verification infrastructure fails.

The acknowledgement contract is provider-specific. Separate fast verified receipt from slow business processing where supported, but make the durable handoff occur before acknowledging. Define invalid-signature, unknown-key, storage-failure, overload, and downstream-failure responses so retry behavior cannot create data loss or an attacker-controlled retry storm. Reconcile verified receipts, deduplicated deliveries, applied transitions, quarantines, acknowledgements, and missing provider effects.
