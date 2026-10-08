# Idempotency record

Minimum fields commonly include tenant/principal scope, operation kind, key hash, request fingerprint, status, result reference, provider identity, attempt owner/lease, created/updated/expiry time, and version.

The unique index must cover the full semantic scope. Concurrent callers either observe the committed result or a defined in-progress response. A failed validation before effect initiation may be retryable; a provider timeout after transmission is ambiguous, not a clean failure.

Take over abandoned work with compare-and-swap or fencing. Elapsed local ownership does not prove the provider did nothing; reconcile the stable provider operation before any repeat.
