# Source-to-Sink Matrix

## Sources

Cover every source used by the application, not only query parameters:

- path, query, JSON/XML/form bodies, nested objects, arrays, headers, cookies, and duplicate parameters;
- multipart file bytes, filename, content type, archive member name, and metadata;
- GraphQL variables/input objects, WebSocket/SSE messages, RPC fields, queues, and jobs;
- database-stored user content, imported documents, third-party API data, webhook events, and cached values;
- browser query/hash, postMessage, local/session storage, cookies, window name, opener/referrer, BroadcastChannel, and realtime messages.

## High-risk sinks and questions

| Sink family | Trace and challenge |
|---|---|
| SQL/NoSQL/search | Is structure separated from data? Are sort/filter/field names allowlisted? Does type coercion or object/array input change query semantics? |
| Command/code/template | Can input select executable text, arguments, expression language, template source, class/type, or deserialization gadget path? |
| Outbound request | Are scheme, hostname, credentials, redirects, DNS resolution, IP ranges, ports, and every hop validated server-side? |
| XML/document/archive | Are external entities, network access, includes, macros, archive traversal, decompression limits, and parser features disabled? |
| File/path/upload | Is the name server-generated? Are canonical path, type, size, magic bytes, storage isolation, processing, and served content controlled independently? |
| HTML/DOM/script | Is encoding appropriate to HTML, attribute, JS, URL, CSS, and DOM context? Is a safe DOM API used after sanitization? |
| Redirect/header/cache | Can input control a trusted destination, generated link, routing decision, header boundary, or shared cache entry? |
| Cross-origin/message | Is the exact origin, source window, message schema, action, and credentialed data sensitivity enforced? |

## Path record

For each path retain:

1. source and attacker precondition;
2. exact entrypoint/operation and identity context;
3. decode/parse/canonicalize/type-coercion sequence;
4. validations and their order;
5. transformations, persistence, service hops, and asynchronous triggers;
6. sink and execution context;
7. proof surface and negative control;
8. variants found by repository-wide search;
9. static confidence, runtime status, and missing proof.

Do not collapse multiple parser, role, content-type, or second-order paths into one generic observation.
