# Security notes for WebMCP tools

Agents often inherit the **user’s cookies and logged-in session**. Treat every
tool as an authenticated capability.

## Author responsibilities

1. **Least privilege** — only register tools for actions the current user may
   perform; drop tools on logout.
2. **Honest annotations** — `readOnlyHint` / `untrustedContentHint` must match
   reality.
3. **No tool poisoning** — never put “system instructions”, secrets, or
   exfiltration hints in `name`, `title`, `description`, or parameter
   descriptions.
4. **Safe outputs** — sanitize or bound user-generated content in returns; set
   `untrustedContentHint: true` when in doubt.
5. **Validate in code** — do not trust `inputSchema` alone; reject bad input with
   clear errors.
6. **Confirm irreversible actions** — purchases, deletes, sends: require explicit
   parameters and/or in-page confirmation patterns your product already uses.

## Prompt injection vectors

| Vector | Mitigation |
| --- | --- |
| Malicious descriptions | You control metadata — keep it boring and accurate |
| Malicious tool output | Bound/sanitize; mark untrusted; avoid echoing raw HTML |
| Confused deputy via session | Server-side authz on every mutating path tools call |

## Cross-origin

- Default: tools are same-origin only
- Sharing into another frame requires `allow="tools"` + `exposedTo`
- Never expose privileged tools to origins you do not control

## What WebMCP does *not* replace

- Server authorization
- CSRF protections on cookie-authenticated APIs
- Human approval UX for high-risk actions
