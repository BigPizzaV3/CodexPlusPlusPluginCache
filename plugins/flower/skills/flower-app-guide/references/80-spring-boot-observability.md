# Spring Boot Runtime Inspection And Observability

Use this reference only when a Spring Boot host needs operational visibility
into its Flower Engine, Workers, Flows, or Steps. The console and dump endpoint
are optional diagnostics, not required parts of every Flower application.

## Choose The Smallest Inspection Surface

- Use `Engine.dump()` behind an existing protected admin boundary when the host
  already owns its diagnostics surface.
- Enable the starter's JSON dump endpoint when operators need machine-readable
  Engine state.
- Enable the starter's built-in console when a lightweight browser view is
  useful for local development or protected internal operations.
- Use `flower-observability` listeners for application-owned logging, metrics,
  tracing, or exported diagnostics.

`flower-spring-boot-starter` includes `flower-core` and
`flower-observability`. Do not add those artifacts separately unless host code
directly imports an API that should be declared explicitly. The HTTP endpoints
require a Spring MVC servlet application and are disabled by default.

## Engine And Lifecycle Ownership

The starter's console and dump endpoint inspect the application's existing
`Engine` bean. When the application supplies its own `Engine`, Flower
auto-configuration backs off and the diagnostics use that same bean.

The starter normally starts the Engine with the Spring lifecycle. If the
application restores checkpoints and then starts the Engine itself, consider:

```yaml
flower:
  auto-start: false
```

With `auto-start: false`, the application is responsible for calling
`Engine.start()` after recovery. Until then, a dump can legitimately report
`engineState=CREATED`.

## Read-Only Dump Endpoint

```yaml
flower:
  admin:
    dump:
      enabled: true
      path: /internal/flower/dump
      pretty: false
```

The default path is `/internal/flower/dump`. A request may use
`?pretty=true` to override JSON formatting.

## Built-In Console

```yaml
flower:
  admin:
    console:
      enabled: true
      path: /internal/flower/console
      api-path: /internal/flower/console/dump
      poll-interval-ms: 3000
```

The console is read-only. Its Start and Stop buttons control browser polling;
they do not start or stop the Flower Engine.

## Security And Product Boundaries

Engine dumps can expose Flow keys, execution context values, and operational
state. Expose the console and JSON routes only on localhost or through an
authenticated private network, VPN, internal admin gateway, or equivalent
host-owned control. Do not publish them as unauthenticated Internet endpoints.

The console diagnoses Flower execution. It does not replace application UI or
APIs for `action_run`, `agent_run`, approval records, audit history, or
business-domain status.

## Focused Verification

When enabling either endpoint, start the real host and call the configured
routes:

```powershell
$console = Invoke-WebRequest http://localhost:8080/internal/flower/console
$dump = Invoke-RestMethod http://localhost:8080/internal/flower/console/dump

if ($console.StatusCode -ne 200 -or
    $console.Content -notmatch 'Flower Console' -or
    $dump.engineState -ne 'RUNNING') {
    throw 'Flower console verification failed'
}
```

For the standalone dump endpoint, call `/internal/flower/dump` instead. Assert
`engineState=RUNNING` only after the application's intended startup sequence
has completed; with manual startup, `CREATED` before `Engine.start()` is
expected.
