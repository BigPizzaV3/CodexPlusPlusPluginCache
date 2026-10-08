# Imperative — dedicated paths

Unlike declarative tools (via form), **imperative** `registerTool` packages a
real path for an AI browsing agent. Design that path with the user **before**
writing registration code.

## Planning ping-pong (required)

For each candidate scenario, agree:

| Question | Example (checkout) |
| --- | --- |
| What human flow exists today? | 4-step tunnel: cart → shipping → payment → review |
| What should the agent call? | One tool `complete_checkout` on step 1 |
| Input | Shipping address, payment method id, … |
| UI outcome | Navigate to last step (review / pay); form fields filled or summary visible |
| State outcome | Cart + shipping persisted; payment not charged until confirm if that’s product policy |

A 4-step checkout as four form tools forces the agent to chain pages. A dedicated
path from step 1 that fills everything and redirects to the last step is usually
what they want — **only if they say so**.

Cap the first ship to the smallest set of dedicated paths (often 1–3). Extra
micro-tools belong in **Declarative** or an existing MCP server (**Bridge**).

## After paths are agreed

1. Map each path to **one** tool that calls existing app logic (stores, APIs,
   router) — not synthetic click scripts.
2. Register only on routes where the path is valid (e.g. checkout step 1);
   abort on leave.
3. Chrome: static registration when always valid; dynamic register/abort when
   availability depends on route or auth.

## Naming

| Good | Why |
| --- | --- |
| `search_docs` | Verb + object, stable |
| `create_event` | Immediate effect |
| `start_event_creation` | Opens / focuses a form flow instead of committing |

| Avoid | Why |
| --- | --- |
| `doStuff` | Opaque to agents |
| `search` vs `find` vs `query` all registered | Overlap |
| Names with spaces or emoji | Invalid / fragile (`[a-zA-Z0-9_.-]` only, ≤128) |

## Descriptions

Write for an agent choosing among tools:

- What the tool does
- When to use it
- What success looks like (implicitly, via return shape)

Use positive language. Encode limits in the schema and errors, not “Don’t use for X”.

## inputSchema

- Top-level `type: "object"`
- Every property has a `description`
- Prefer `enum` / `const` with human titles when the set is closed
- Accept raw user phrasing when possible (e.g. time ranges as strings) instead of
  forcing the model to pre-compute
- `required` only for fields you truly need

Validate again inside `execute`. Schema is a hint; agents can still send junk.
Return actionable errors so the agent can retry.

## Return values

Must survive `JSON.stringify`:

```js
return { ok: true, items };
// or
return "Added todo: Buy milk";
```

Bad: `HTMLElement`, class instances with cycles, `undefined` (becomes failure).

Keep payloads small and structured. Mark `untrustedContentHint: true` when the
payload includes user- or third-party-generated text.

## Annotations

| Field | Set true when |
| --- | --- |
| `readOnlyHint` | No state change (reads, search, status) |
| `untrustedContentHint` | Output may contain untrusted text |

Mis-labeling `readOnlyHint` trains agents to call mutating tools too casually.

## Lifecycle

- Register when the tool is meaningful
- `controller.abort()` when route/auth/UI makes it invalid
- Re-register after abort if the tool becomes valid again (new AbortController)
- Pass `execute`’s `signal` into `fetch` and cancelable work
