# Provider idempotency contracts

Keep one durable internal operation identity even when the request crosses API versions, endpoints, credentials, regions, gateways, or providers. A provider idempotency key is a scoped attempt identity derived for one external operation; it is not the primary key of the whole financial workflow.

## Record the deployed contract

For every provider operation, version:

- supported method and endpoint or operation type;
- merchant, account, credential, region, and environment scope;
- key length, format, comparison, and parameter-binding rules;
- retention minimum or maximum and behavior after pruning;
- response semantics: first stored response, latest resource state, or re-execution of failed work;
- simultaneous duplicate and in-progress behavior;
- retryable, ambiguous, conflict, and final error classes;
- lookup, webhook, or reconciliation path when no response arrives.

Do not generalize one provider or API version. Stripe API v1 can replay a stored first result and may prune keys after at least 24 hours; current Stripe API v2 documents a different scope, window, and failed-request behavior. PayPal support and retention are API-specific, simultaneous same-ID requests may not both succeed, and replay returns current status. Adyen documents company-account scope, a minimum validity period, explicit transient errors, and no cross-region duplicate check for simultaneous regional endpoints.

## Bind internal and external identity

Store the authenticated tenant/principal, internal operation kind and target, canonical semantic fingerprint, provider and endpoint version, merchant/account/region, provider key, provider resource identity, request attempt evidence, and terminal or ambiguous result.

Use a distinct provider key for distinct external operations such as authorize, capture, refund, and reversal, even when they belong to one internal payment. Link them to the internal workflow; reusing one provider key across operation types can conflict or disclose the wrong response.

Do not derive keys only from amount or customer data. Keep PII and secrets out of keys. Randomness prevents accidental collision but does not supply semantic scope; the durable record and fingerprint do.

## Survive ambiguity and expiry

Persist the attempt before transmission. On timeout or connection loss, reuse the exact provider identity only within the verified contract and reconcile provider state or webhooks. An in-progress conflict from a simultaneous duplicate is not proof that the first attempt failed.

Keep the local record for the longest credible client, queue, webhook, support, disaster-recovery, and provider replay horizon. If the provider may have pruned its key while the financial outcome is still unresolved, a same-key retry may become a new effect. Stop automatic resubmission and reconcile by provider resource, merchant reference, settlement evidence, or manual control.

Regional failover is not automatically safe. If provider deduplication scope is regional, route retries to the original region or reconcile before choosing a new region. Never remove the idempotency key to bypass a provider idempotency-store outage for a money-moving call.

## Replay without leaking authority

Authenticate and authorize every replay before returning a stored response. A key known by another credential, tenant, or former privilege must not grant access to the prior result. Provider behavior can expose previously stored responses within a broad account scope, so isolate credentials and avoid predictable keys.

Provider idempotency does not atomically couple the external effect to the local ledger or workflow. Persist ambiguity, consume webhooks idempotently, and reconcile the provider resource to local postings. Record whether a response is original, stored replay, current provider state, or webhook evidence; they are not interchangeable.

Test simultaneous duplicates, same-key changed payload, operation-type reuse, timeout after provider success, local crash before result persistence, webhook-before-response, provider retention expiry, credential revocation, cross-region retry, and idempotency-service unavailability. The output must name the verified provider contract and residual duplication boundary.
