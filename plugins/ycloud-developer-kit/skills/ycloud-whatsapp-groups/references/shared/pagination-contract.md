# YCloud pagination response contract

Evidence checked on 2026-09-01 against the current YCloud Docs:

- [Pagination](https://newdocs.ycloud.com/en/api-reference/guides/api-fundamentals/pagination)
- [List contacts](https://newdocs.ycloud.com/api-reference/contacts/list-contacts)
- The current public OpenAPI at `/openapi/endpoints/ycloud-api-v2.yaml`

The pinned OpenAPI remains the operation-level contract. This reference makes
wire response adaptation explicit where OpenAPI `allOf` composition otherwise
hides inherited page fields in generated models.

## Page-number envelope

For endpoints that declare `page`, `limit`, and `includeTotal`, the request uses
1-based `page`; it does not send response metadata such as `offset` or `length`.
The successful response is an object, not a bare array:

```json
{
  "offset": 0,
  "limit": 100,
  "length": 1,
  "total": 239447,
  "items": []
}
```

`offset`, `limit`, and `length` are required Page fields. `total` is optional and
is present only when requested with `includeTotal=true`. `items` is the selected
operation's resource array. Adapters must merge the shared `Page` properties
with the resource-specific `*Page` properties defined through `allOf`; never
discard inherited fields, unwrap a nonexistent `data` property, or treat
`offset` as a request parameter merely because it appears in the response.

For page-number traversal, preserve filters and request the next 1-based page
while `length == limit`; stop when `length < limit`, including an empty first
page. Apply a project-owned page/item budget for background traversals. Do not
use `total` as a continuation requirement because it may be absent.

## Cursor envelopes

Use cursor pagination only when the exact operation declares it.

- Contacts uses the same Page envelope plus optional `cursor.after`. Start with
  `pageAfter=0`, then pass the returned Contact ID cursor unchanged. In cursor
  mode `offset` is response metadata fixed at `0`; stop when `cursor.after` is
  absent.
- Unsubscribers uses the same Page envelope plus optional opaque
  `cursor.after`; pass it unchanged as `pageAfter` and stop when absent.
- WhatsApp Groups and group join requests do not use the common Page envelope.
  Their response is `{data: [...], paging?: {before?, after?}}`; pass opaque
  `before`/`after` values only through the matching query parameter.

Do not silently convert between page-number and cursor strategies. Add guards
for repeated cursors, empty pages, and configured traversal budgets.

## Non-page list responses

Do not wrap or reinterpret list operations whose exact schema differs:

- WhatsApp Flows returns `{items: [...]}` with no common Page metadata.
- Contact attributes and contact notes return arrays.
- Unsubscribers-by-customer returns an array.

## Adapter and UI evidence

A list capability is implemented only when a synthetic no-network test passes a
provider-shaped body through the HTTP client, service, handler, and UI-facing
DTO without losing envelope or item fields. At minimum test:

- required Page fields and optional `total`;
- a non-empty resource item with unknown properties preserved;
- empty-page behavior;
- the endpoint's next-page signal and termination condition;
- exact separation of request pagination parameters from response metadata.

The UI may derive a page number for display, but it must retain the provider
envelope as evidence and must not rename or drop resource fields before the
domain mapper has consumed them.
