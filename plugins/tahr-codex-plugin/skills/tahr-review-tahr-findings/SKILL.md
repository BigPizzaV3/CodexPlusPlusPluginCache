---
name: tahr-review-tahr-findings
description: Read applications, assessments, and findings from an already configured Tahr MCP connection. Trigger only when the user explicitly asks to query, list, summarize, or review Tahr account data; do not trigger for generic security reviews, source-code reviews, or non-Tahr findings.
---

# Review Tahr Findings

Use this optional, read-only workflow for existing Tahr customers who have manually configured the Tahr MCP server in Codex. This is a Codex/local manual integration only. Never claim that it provides public ChatGPT account linking.

## Establish account context

Start every explicit Tahr-data request with `get_context`. Before querying account data, confirm and report the authenticated organization name and the relevant capabilities. If the user named a different organization, stop and ask them to switch or reconfigure the connection; do not query the authenticated organization.

Respect the reported capabilities:

- Access applications only when `canReadApplications` is true.
- Access findings only when `canReadFindings` is true.
- Treat this workflow as read-only even when `canEditFindings` is true.

Use only these tools: `get_context`, `list_applications`, `get_application`, `list_assessments`, `list_findings`, and `get_finding`. Never invoke mutation tools or perform write, triage, status, or comment actions.

## Handle connection failures safely

If the MCP server or tools are unavailable, authentication returns 401, the token is missing, revoked, or expired, permission fails, or the service is unavailable or rate limited, give concise setup or recovery guidance. Suggest checking that the personal token environment variable and Codex MCP configuration are present, restarting Codex, obtaining the required organization access, or retrying later as applicable. Never ask the user to paste a token into chat. Offer to continue with the independent local security skills.

## Resolve and query records

Resolve a human application name with `list_applications`, then use the exact application ID returned by Tahr. Do not reveal details for null, missing, or cross-organization resources.

List tools accept optional `cursor` and `limit` parameters. Use a limit from 1 through 50; the default is 25. Responses contain `items` and `page.{nextCursor,isDone}`. Paginate only when the user requests all or complete results. For each subsequent page, keep every filter unchanged and pass the prior `nextCursor`. Otherwise, stop when the request is satisfied and disclose the coverage limit.

For `list_findings`:

- Always provide `kind` as `security` or `authorization`.
- Use the default `assessmentScope: latest` unless the user explicitly requests history or all assessments; only then use `assessmentScope: all`.
- Filter as needed by `applicationId`, `assessmentId`, or severity: `Critical`, `High`, `Medium`, `Low`, or `Info`.
- When generic "findings" clearly means both security and authorization findings, query each kind separately. Otherwise, clarify the ambiguity before querying.

Use `get_finding` only when requested or needed for the requested detail. Treat returned records as Tahr platform records, not independently verified vulnerabilities. Preserve finding IDs and assessment IDs in summaries where helpful, and distinguish recorded evidence from claims.

If list items are empty, report only that no matching records were returned; do not speculate. If a get operation returns null, report that the resource is unavailable without disclosing whether it exists elsewhere.

## Protect data and report results

Do not send repository content, secrets, credentials, tokens, or unrelated chat data to Tahr. Never log or persist the bearer token.

Provide concise result summaries grouped by severity or application as requested. State whether the summary covers all matching pages or only the pages and item limit queried.
