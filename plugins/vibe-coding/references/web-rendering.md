# Web rendering boundaries

Establish the installed framework version, router, rendering mode and hosting/runtime from the repository. Check version-matched documentation for cache defaults and server/client APIs; do not apply Next.js Cache Components rules to a project using its previous caching model, or infer one framework's rules for another.

Trace the full document request, client navigation and mutation separately. They may use different loaders, caches, serialized payloads and authorization paths.

- **Initial render:** server output and the first client render must agree. Look for time, randomness, locale/timezone, browser storage, invalid nesting and external DOM changes. Fix the owning initial-state contract; broad hydration suppression, client-only rendering or delayed mounting can hide the symptom while changing behavior.
- **Serialization:** data sent in HTML, bootstrap JSON, RSC payloads and client props is readable by the client even if no visible component renders it. Keep secrets and unauthorized fields out of every serialized channel.
- **Identity and cache:** distinguish request-local memoization, persistent data caches, rendered-route caches, client router caches and shared/CDN caches. Trace user/tenant/locale variation and invalidation to the cache that actually serves the stale or exposed value. An authenticated page guard does not make a shared response cache private.
- **Server mutations:** authorize each reachable handler/action against the authenticated principal and current object ownership. Hidden buttons, opaque action IDs, client-supplied roles and a parent layout are not authorization. Preserve validation and the framework's origin/CSRF protections.
- **Navigation and streaming:** loading/error boundaries, redirects, not-found status, aborted requests and back/forward navigation must preserve the intended URL and state. A mutation followed by client navigation must not silently restore pre-mutation data.

For React, use the [hydration contract](https://react.dev/reference/react-dom/client/hydrateRoot). For Next.js, select the configured [caching model](https://nextjs.org/docs/app/getting-started/caching) and check [data security boundaries](https://nextjs.org/docs/app/guides/data-security). Use equivalent official documentation when the repository has another framework.
