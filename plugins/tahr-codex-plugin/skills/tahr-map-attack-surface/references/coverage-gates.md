# Coverage Gates

## Minimum evidence classes

Check each applicable class and record a reason when unavailable:

| Class | Evidence to seek |
|---|---|
| Server | Routes, middleware, handlers, jobs, queues, templates, storage, outbound clients |
| API contract | OpenAPI/Swagger, GraphQL, protobuf/RPC, generated clients, examples |
| Frontend | Client routes, forms, request builders, lazy chunks, source maps, feature flags |
| Public runtime | Pages, endpoints, scripts, redirects, errors, public API behavior |
| Authenticated runtime | Pages and API calls for every supplied validated identity |
| Differential | Public versus authenticated and role/tenant/object visibility differences |

## Gap test

A review is incomplete when any material item lacks a terminal disposition or when:

- a SPA was reviewed without client routes or runtime network calls;
- an API was reviewed without request body fields and content types;
- multiple identities exist but their surfaces were collapsed;
- uploads lack preview/render/download mapping;
- object IDs lost their endpoint, carrier, owner, or tenant provenance;
- source/spec operations were assumed reachable without runtime labeling;
- redirects, WAF blocks, stale sessions, or timeouts were treated as absence.

## Bounded second pass

When counts are unexpectedly low, try one materially different method:

- inspect lazy imports and route configuration;
- parse the formal API contract or generated client;
- expand safe menus, tabs, modals, pagination, or iframes;
- compare another supplied identity;
- inspect an authorized HAR/proxy capture;
- trace source-derived operations to their registration point.

If the gap remains, state what is missing, why, and which downstream security conclusions it limits. A low count is never a clean bill of health.
