# Webhook Investigation Playbook

Use for missing callbacks, delayed webhooks, duplicate events, signature failures, retries, ordering issues, and receiver-side errors.

## Determine the stage

A webhook can fail at:
1. event generation;
2. enqueue/dispatch;
3. network delivery;
4. receiver acceptance;
5. signature validation;
6. receiver processing;
7. acknowledgement;
8. retry/dead-letter handling.

Find the first stage where observed reality diverges from expected behavior.

## Extract

- event ID;
- event type;
- account/tenant;
- destination identifier/URL domain when safe;
- creation time;
- delivery attempt times;
- HTTP response codes;
- retry count;
- signature validation error;
- request/correlation ID;
- expected ordering;
- affected object/resource.

Do not expose webhook secrets or signing keys.

## Delivery investigation

Check:
- whether event was generated;
- whether it entered dispatch queue;
- exact delivery attempts;
- network/TLS/DNS failures;
- receiver response code and latency;
- timeout threshold;
- retry policy;
- dead-letter state;
- duplicate delivery behavior;
- receiver rate limiting.

## Signature failures

Check:
- secret mismatch/rotation;
- timestamp tolerance;
- exact raw-body canonicalization;
- header name/encoding;
- proxy/body transformations;
- wrong environment secret.

Never request the actual secret. Ask for metadata or verification result.

## Ordering and duplicates

Determine whether ordering is guaranteed by contract.  
For duplicates, check idempotency handling and retry reason.  
Do not label documented at-least-once delivery as a platform defect.

## Customer-safe output

State what is known about generation/delivery without exposing internal infrastructure or private endpoints.
