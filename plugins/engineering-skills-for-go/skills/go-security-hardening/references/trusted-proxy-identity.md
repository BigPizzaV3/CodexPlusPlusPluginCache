# Trusted proxy identity

Forwarded metadata is a claim about an earlier transport hop. Parsing it successfully does not authenticate the claim. Before using `Forwarded`, `X-Forwarded-*`, `Client-Cert`, or a vendor certificate header for authorization, redirects, tenant selection, audit attribution, or security rate limits, define who produced each value and why the receiving hop can trust that producer.

## Establish the trust ingress

Use a deployment contract with all of these properties:

1. The backend authenticates the immediate proxy connection or is otherwise reachable only through a tightly controlled proxy path.
2. Direct and alternate paths cannot reach the same handler while supplying proxy-only metadata. If a bypass must exist, it uses a separate listener or an explicit mode that ignores those fields.
3. The first trusted ingress removes attacker-supplied provenance fields and reconstructs only the fields it owns from the authenticated connection and verified protocol state.
4. Every later hop either authenticates and preserves the established chain under one documented policy or discards and rebuilds it. A list length or a familiar private address is not authentication.
5. The application converts accepted metadata into one structured internal identity at admission and carries that value. Downstream code does not repeatedly reinterpret raw headers.

An IP allowlist can be one deployment control, but account for spoofable source networks, shared intermediaries, topology changes, and backend exposure. Prefer an authenticated proxy-to-origin channel when the metadata grants authority.

## Own the chain

For a multi-proxy path, specify the ordered proxy set and which element each proxy appends. Select a client element only after validating the trusted suffix or equivalent authenticated chain. Never take the leftmost or rightmost address by convention without proving how untrusted elements are removed and how many trusted hops actually ran.

In Go, `httputil.ReverseProxy.Rewrite` removes `Forwarded` and `X-Forwarded-*` fields from the outbound request before the rewrite function runs. `ProxyRequest.SetXForwarded` can then derive values from the immediate inbound request. Copying an inbound chain before calling it is safe only when this proxy has already authenticated the producer and the deployment contract intentionally preserves that chain. The older `Director` path preserves inbound `X-Forwarded-*` by default and can permit spoofing unless it sanitizes them.

Treat client address as a scoped signal. NAT, carrier networks, privacy relays, and proxy changes make it a poor durable principal. Authorization should normally bind to an authenticated subject and resource; address data can supplement risk, rate-limit, and audit decisions under an explicit false-positive and false-negative policy.

## Convey client certificates

RFC 9440's `Client-Cert` contract is for a TLS-terminating reverse proxy that validated the client certificate. The proxy removes or overwrites every inbound instance, removes the field when client-certificate authentication was not negotiated, and sends it only over a protected proxy-to-origin path. The origin accepts it only from that trusted path. A client-supplied certificate header is not mTLS evidence.

If a certificate-derived response can be cached, bind cache reuse to the authenticated identity or make the response uncacheable. Bound certificate-header size, preserve certificate-validation policy and result, and account for TLS resumption behavior that might omit certificate state.

## Review failure schedules

- An internet client sends a privileged `X-Forwarded-For` or certificate header through a proxy that appends without clearing it.
- A maintenance load balancer reaches the backend directly and inherits the trusted-header mode.
- A proxy is removed or inserted but the application still strips a fixed number of hops.
- One hop authenticates the user while another independently rewrites tenant, scheme, or host.
- Authorization uses certificate metadata, but a shared cache omits identity from its key.

For each schedule, require the request to fail closed or reduce to non-authoritative metadata. Log the authenticated proxy identity, selected source, trust-policy version, and rejection reason without logging certificate material or unnecessary client-address data.

Primary evidence: [Go `net/http/httputil`](https://pkg.go.dev/net/http/httputil), [RFC 7239](https://www.rfc-editor.org/rfc/rfc7239), and [RFC 9440](https://www.rfc-editor.org/rfc/rfc9440).
