# Serverless and edge runtime boundaries

Identify provider, deployed runtime/version, trigger, execution limits and compatibility configuration from the repository. Do not infer identical behavior across Lambda, Workers, Durable Objects or a framework adapter.

- **Lifetime:** trace work required before responding and intentionally deferred work. An unawaited promise may be abandoned after invocation completion. Use the provider's lifetime mechanism or durable queue for the required guarantee; deferral is not durable delivery and has limits.
- **Reuse:** reuse SDK clients/connections where supported, but never let invocation-specific identity or mutable user state leak into the next invocation. Local memory and temporary files are not authoritative durable stores.
- **Delivery:** distinguish synchronous, asynchronous, queue and scheduled triggers. Check duplicate events, retry ownership, partial-batch acknowledgment and operation identity. Whole-batch retries must not repeat committed non-repeatable effects.
- **Limits:** use actual CPU/wall-time/memory/subrequest/concurrency bounds and cancellation behavior. Preserve downstream capacity during fan-out or scaling. A local emulator does not establish production quotas or scheduling.
- **Compatibility:** inspect available APIs, connections, secrets/bindings, preview/production differences and compatibility date. Do not import unavailable Node APIs or rewrite the platform to satisfy a local test.

Use version-matched provider documentation. [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html) covers environment reuse and duplicates. [Workers context](https://developers.cloudflare.com/workers/runtime-apis/context/) covers request lifetime and `waitUntil`; do not apply the same lifetime advice blindly to Durable Objects.
