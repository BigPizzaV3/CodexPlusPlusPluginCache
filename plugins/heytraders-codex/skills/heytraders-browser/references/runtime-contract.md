# Runtime contract

## Ownership

| Concern | Authoritative owner |
| --- | --- |
| Commands, schemas, readiness, and application state | Live Frontend command catalogs and Domain Gateways |
| Backend-backed content and policy | Backend services reached through those Domain Gateways |
| Authentication and account controls | Existing authenticated HeyTraders UI, controlled by the user |
| Browser exposure | Page-defined `heytraders_cli` WebMCP tool, with a bundled Browser CLI transport when WebMCP is not advertised |

The plugin must not duplicate any of these registries.

## Plugin entry

New product or sign-in tabs use `https://hey-traders.com/?ht_client=codex`. An existing canonical tab keeps its current URL, including workspace parameters and fragment. The adapter only dispatches commands; it does not reload the tab, add client fields to command arguments, or rewrite marketing UTMs. The entry marker is an untrusted client observation processed by the application's consent-aware acquisition owner, not identity or authorization evidence. An untagged reused tab does not establish a new Codex acquisition observation.

## Public plugin scope

The public plugin uses the generic request router only for navigation, documentation, read-only market and account information, chart operations, backtests, and strategies whose described request and returned mode are explicitly simulated paper. Runtime discovery does not authorize real orders, live-mode strategies, exchange or wallet connection, credentials, or venue permissions. A historical command name that contains `live` does not expand this boundary: the command is usable only when its contract requires an explicit mode and the call is fixed to `paper`. The skill must stop when an operation's effect or mode is ambiguous.

## Discovery and readiness

Use live `help list` and `help describe` when the selected command's current contract is unknown, stale, or rejected by schema validation. Reuse current contracts already available in the task. Readiness, route requirements, identifiers, and follow-up discovery are all returned by the application; the plugin does not maintain a parallel domain or route registry.

When an operation requires user action, the user owns the visible UI step. Rediscover state after the user confirms completion rather than treating navigation or dialog closure as success.

## Compatibility

Facade version 7 uses domain-prefixed command selectors and result actions. Both the WebMCP tool and bundled Browser adapter use `window.__bridge.request`. The adapter requires a numeric safe-integer version of at least 7; missing, nonnumeric, fractional, and infinite versions fail closed. The plugin must not probe or call removed flat aliases.

The installed adapter accepts only the canonical `https://hey-traders.com` origin, decodes command payloads as UTF-8, and returns structured bridge errors without falling back to legacy flat members.

Browser runtimes that do not advertise WebMCP may use the bundled CDP adapter through the same facade.

## Cancellation and retries

WebMCP's execution signal is a separate trusted option, forwarded to the app command context; it is never an args field or an authority override. Queued application mutations check it before dispatch. Cancellation does not roll back an accepted server operation or an already dispatched UI effect. The CDP adapter has no application cancellation channel and makes one request per call.

Only reuse a retry identifier when the selected live schema and documented semantics support it. Resolve an unknown backtest or simulated-paper outcome through application state instead of automatically starting the operation again.
