---
name: ux-empty-error-states
description: "Use when designing empty states, loading states, error states, and partial-failure states in a Shopify embedded app. Covers Polaris EmptyState, SkeletonPage/SkeletonBodyText, Banner tones (critical/warning/info/success), Toast vs Banner vs Modal decision, optimistic UI in Remix, network-down handling, partial bulk-failure recipes, GraphQL '200 OK with errors' gotcha. Triggers: 'empty state', 'loading state', 'error state', 'polaris banner', 'skeleton', 'toast', 'optimistic ui', 'partial failure', 'network down', 'remix loading ux', 'graphql error handling'."
---

# Empty, Loading & Error State UX for Shopify Polaris Apps

A practical, opinionated reference for the three states that make or break a Shopify embedded app: when there's nothing yet, when something is on its way, and when something went sideways. Pulled from Polaris docs, Remix pending UI docs, and real-world patterns.

---

## 1. EmptyState — when, how, and what to put inside

### What it is

`EmptyState` is Polaris' purpose-built component for "this page/section is empty." It composes a centered illustration, a heading, optional body text, and a primary action (and optional secondary action). It is intended for whole-page-empty experiences, not tiny empty slots inside a card sidebar.

### When to use it

Use `EmptyState` when:

- A list/table/chart has zero rows for first-time merchants (no products, no orders, no campaigns).
- A filtered/searched view returns zero matches (different copy, same component).
- A feature requires setup before it can be used (no connected account, no plan selected).
- A merchant landed on a page that needs onboarding context before they can act.

Do **not** use `EmptyState` for:

- Small empty slots inside a `Card` where a simple "No notes yet" sentence is enough.
- Form fields that aren't filled in — that's just normal state.
- Loading. Use `SkeletonPage` instead.
- Errors. Use a `Banner` (or a full-page error view) instead.

### Anatomy

```tsx
import { EmptyState, Page } from "@shopify/polaris";

<Page>
  <EmptyState
    heading="Manage your inventory transfers"
    action={{ content: "Add transfer", onAction: () => navigate("/transfers/new") }}
    secondaryAction={{
      content: "Learn more",
      url: "https://help.shopify.com/manual/inventory/transfers",
      external: true,
    }}
    image="https://cdn.shopify.com/s/files/.../empty-state.svg"
  >
    <p>Track and receive your incoming inventory from suppliers.</p>
  </EmptyState>
</Page>
```

### Content rules

- **Heading** — a friendly sentence fragment, not a label. "Manage your inventory transfers," not "Transfers."
- **Body** — one or two sentences. Explain the value, not the mechanism.
- **Primary action** — verb-first, the single most important thing they can do. "Add transfer," "Import products," "Connect Stripe."
- **Secondary action** — almost always a "Learn more" link to Shopify docs or your own help article. Use `external: true` and the new-window icon will render.
- **Image** — a Polaris illustration or your own brand-consistent SVG. ~400×250px works well. Polaris recommends ~40px of white space above when nested inside a `Card` or `Modal`.

### Two flavors you must handle

1. **First-run empty** (no data has ever existed). Copy is teaching-oriented. CTA is "Create your first X."
2. **Filtered empty** (data exists, the filter killed it). Copy is "No results match your filters." CTA is "Clear filters" or "Reset search." Do NOT show the onboarding CTA here — it confuses returning users.

Distinguish them in code:

```tsx
const showFilteredEmpty = products.length === 0 && hasActiveFilters;
const showFirstRunEmpty = products.length === 0 && !hasActiveFilters;
```

---

## 2. SkeletonPage / SkeletonBodyText — loading patterns

Polaris ships four skeleton components: `SkeletonPage`, `SkeletonBodyText`, `SkeletonDisplayText`, `SkeletonTabs`, and `SkeletonThumbnail`. The point is **perceived performance**: merchants tolerate a 600ms load that shows shape over a 200ms load that shows a blank screen.

### When to use each

| Component | Use for |
|---|---|
| `SkeletonPage` | Wrap the whole route while the loader runs. Pass `primaryAction` and `title` as booleans to render their skeleton equivalents. |
| `SkeletonBodyText` | Multi-line text blocks. `lines={3}` default — match it to the real content's line count. |
| `SkeletonDisplayText` | One large piece of dynamic text (a product name, an order number). `size="small" | "medium" | "large"`. |
| `SkeletonTabs` | The tab strip on a tabbed page. |
| `SkeletonThumbnail` | Product image placeholders in lists. |

### Anatomy of a skeleton route

```tsx
import {
  SkeletonPage,
  Layout,
  Card,
  SkeletonBodyText,
  SkeletonDisplayText,
} from "@shopify/polaris";

export function ProductsSkeleton() {
  return (
    <SkeletonPage primaryAction title="Products">
      <Layout>
        <Layout.Section>
          <Card>
            <SkeletonBodyText lines={8} />
          </Card>
          <Card>
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={3} />
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <SkeletonBodyText lines={2} />
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}
```

### Skeleton rules

- **Use skeletons for dynamic content only.** A static page title can render its real text immediately; only the changing parts need skeletons.
- **Match the shape.** Don't show 3 skeleton lines when the real card has 8. Merchants notice the jump.
- **Don't combine skeletons with spinners on the same view.** Pick one.
- **Don't skeleton for <300ms loads.** It flashes and feels broken. Use a spinner or just render nothing.
- **Don't skeleton for >10s loads.** That's a slow query — show a progress message ("Importing 4,200 products…").

### Remix integration

In Remix, render the skeleton when `useNavigation().state === "loading"` for the route you're loading into, or use a `<Suspense fallback={<Skeleton />}>` boundary around a deferred loader value.

```tsx
import { useNavigation } from "@remix-run/react";

export default function Products() {
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  return isLoading ? <ProductsSkeleton /> : <ProductsContent />;
}
```

---

## 3. Error banners — tone hierarchy and recovery actions

Polaris `Banner` has five tones, each with semantics, color, icon, and screen-reader behavior:

| Tone | Use for | A11y role | Dismissible? |
|---|---|---|---|
| `critical` | Blocking errors, payment failure, action impossible | `role="alert"` (announced immediately) | No — only if merchant can dismiss safely |
| `warning` | Something needs their attention soon (trial ending, deprecation) | `role="alert"` | Often yes |
| `info` | Status updates, neutral context ("Sync in progress") | `role="status"` (announced after critical) | Yes |
| `success` | Confirmation of a multi-step or async win | `role="status"` | Yes |
| `neutral` | Defaults, low-priority context | `role="status"` | Yes |

### Anatomy

```tsx
<Banner
  tone="critical"
  title="Could not publish 3 products"
  action={{ content: "Retry failed", onAction: retryFailed }}
  secondaryAction={{ content: "View errors", onAction: showLog }}
  onDismiss={() => setDismissed(true)}
>
  <p>
    These products failed validation: <Link url="/products?failed=true">view the list</Link>.
  </p>
</Banner>
```

### Banner content rules

- **Title** — what happened, not what to do. "Could not publish 3 products," not "Please try again."
- **Body** — one sentence explaining cause if you know it. If you don't, say so honestly ("We're not sure why").
- **Primary action** — always include a recovery path when one exists. "Retry," "Reconnect," "Try again."
- **Secondary action** — "View details," "Contact support," "Learn more."
- **Critical banners** for form submission errors should be placed at the top of the form, and focus should be moved to the banner programmatically when the form is submitted with errors.

### Inline errors vs. banner errors

- **Inline error** (`InlineError` or the `error` prop on `TextField`) — for field-level validation. Sits directly below the input. Wire `aria-describedby` to the input.
- **Banner critical** — for form-level summary OR for errors that aren't tied to a single field (API failure, permission denied).

Use both together for long forms: inline errors at each broken field + a critical banner at the top saying "Fix 3 errors below."

---

## 4. 5xx vs 4xx UX — what to show users

### 4xx — the merchant's request was bad

Categories:

- **400 / 422 Validation** — show inline errors on the exact fields. Banner only if there are multiple.
- **401 Unauthenticated** — silently redirect to auth (App Bridge will usually handle this for embedded apps).
- **403 Forbidden / scope missing** — `Banner tone="warning"` with "Reconnect" or "Grant permission" action. Tell them what permission is missing. Never blame them.
- **404 Not found** — full-page empty state with "Back to [parent]" action. Don't apologize, don't be cute.
- **409 Conflict** — modal asking them to choose ("Overwrite" / "Keep both" / "Cancel").
- **429 Rate limited** — `Banner tone="warning"` "Too many requests. Try again in 60 seconds." Show a countdown if you can. Auto-retry in the background.

### 5xx — Shopify or your server is broken

- **500 Generic error** — full-page error view OR `Banner tone="critical"` depending on whether the page rendered. Always include a "Retry" button. Log the request ID and surface it in a `<details>` so support can correlate.
- **502 / 503 / 504 Gateway / unavailable** — retry once or twice in the background, then show a banner: "Shopify is having trouble right now. We'll keep trying." Link to `https://status.shopify.com`.

### GraphQL caveat (Shopify Admin API)

The GraphQL Admin API can return HTTP 200 with errors in the response body. Always check `data.userErrors` (mutation user errors) and the top-level `errors` array (request errors) before treating a response as success. A 200 status is not a green light.

```ts
const res = await admin.graphql(MUTATION, { variables });
const json = await res.json();
if (json.errors?.length) throw new Error(json.errors[0].message);
if (json.data?.productCreate?.userErrors?.length) {
  return { ok: false, errors: json.data.productCreate.userErrors };
}
```

### What to show, by error class

| Class | Page state | Component | Tone | Recovery |
|---|---|---|---|---|
| Validation (400/422) | Form stays, errors inline | `TextField error` + `Banner` summary | critical | Fix inline |
| Auth (401) | Redirect | — | — | App Bridge handles |
| Permission (403) | Page renders, blocked card | `Banner` | warning | "Reconnect" action |
| Not found (404) | Full-page empty | `EmptyState` with `image` | — | "Back to [list]" |
| Conflict (409) | Modal | `Modal` | — | Choice buttons |
| Rate limit (429) | Page renders | `Banner` | warning | Auto-retry, show countdown |
| Server (5xx) | Depends | `Banner` or full-page error | critical | "Retry" + status link |

---

## 5. Toast vs Banner vs Modal

The three feedback patterns are not interchangeable. Pick wrong and merchants miss the message or get blocked unnecessarily.

### Toast

- **Purpose** — brief, non-blocking confirmation of an action. 3-second auto-dismiss.
- **Length** — 3 words ideally, 6 max.
- **Use for** — "Product saved," "Order archived," "Settings updated," "Copied to clipboard."
- **Do NOT use for** — errors that need action, persistent state, anything a merchant needs to remember after they look away.
- **Do NOT use for** — "Internet disconnected" if they need to do something about it. Toast is fine for the moment-of-disconnect; persistent connectivity issues belong in a banner.

```tsx
import { Toast, Frame } from "@shopify/polaris";

<Toast content="Product saved" onDismiss={hide} />
// Error variant:
<Toast content="Could not save" error onDismiss={hide} action={{ content: "Retry", onAction: retry }} />
```

### Banner

- **Purpose** — persistent, in-context message that needs the merchant's attention but doesn't block the page.
- **Use for** — form errors, billing warnings, sync status, partial failures, feature announcements, deprecation notices.
- **Lives at** — top of page or top of section. Stays until dismissed or until the underlying condition changes.

### Modal

- **Purpose** — block all other interaction until the merchant makes a choice.
- **Use for** — destructive confirmations ("Delete 47 products?"), conditional changes that need explicit consent, focused single-task flows (a 1-step wizard).
- **Do NOT use for** — complex multi-step forms (use a dedicated page).
- **Do NOT use for** — anything you could put in a banner. Modals are disruptive — reserve them.

### Decision flow

```
Need to interrupt the user? → Modal
Persistent, needs action or attention? → Banner
Confirmation of a thing they just did, no action needed? → Toast
```

---

## 6. Optimistic update pattern in Remix

Optimistic UI = updating the screen immediately based on what you know the user just submitted, before the server confirms. The merchant sees instant feedback; you reconcile when the response arrives.

### When to do it

- Toggles (publish / unpublish, archive / restore).
- Quick edits with tiny payloads (rename, change tag).
- Add-to-list actions where the new item shape is predictable.

### When NOT to do it

- Anything that returns data only the server knows (auto-generated IDs you display, computed totals, side-effects).
- Anything where rollback would confuse the user (payment confirmation).
- Slow-failing operations (file uploads where you won't know success for 30 seconds).

### The pattern with `useFetcher`

```tsx
import { useFetcher } from "@remix-run/react";

function PublishToggle({ product }: { product: Product }) {
  const fetcher = useFetcher();

  // Optimistic value: if the fetcher is submitting, use what it sent.
  const isPublished =
    fetcher.formData
      ? fetcher.formData.get("published") === "true"
      : product.published;

  return (
    <fetcher.Form method="post" action={`/products/${product.id}/publish`}>
      <input type="hidden" name="published" value={String(!isPublished)} />
      <Button submit pressed={isPublished}>
        {isPublished ? "Published" : "Draft"}
      </Button>
    </fetcher.Form>
  );
}
```

### Handling failure

The fetcher exposes `fetcher.data` once the server responds. If `data.ok === false`, render an inline error or fire a toast and let React revert (the optimistic value derived from `formData` clears when the submission finishes).

```tsx
useEffect(() => {
  if (fetcher.state === "idle" && fetcher.data?.ok === false) {
    showToast({ content: "Could not publish", error: true });
  }
}, [fetcher.state, fetcher.data]);
```

### List add/remove with `useFetchers`

To handle multiple in-flight optimistic actions at once (e.g., bulk publishing), `useFetchers()` returns every active fetcher. You can merge their `formData` into your rendered list to show pending items immediately.

---

## 7. Network-down behavior

### Detection

`navigator.onLine` and the `online`/`offline` window events are your starting point — but `onLine === true` only means the device is on *some* network, not that it can reach your server. Verify with a real ping (a HEAD to your `/healthz` or a cheap GraphQL query) when it matters.

```ts
useEffect(() => {
  const handleOnline = () => verifyAndResume();
  const handleOffline = () => setOffline(true);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}, []);
```

### The three-step UX

1. **Detect and inform** — small persistent banner at the top: "You're offline. Some features won't work."
2. **Queue or block** — for read-only views, let them keep browsing cached data. For writes, disable mutate buttons and show a tooltip ("Save when reconnected"). If you support background queueing (rare in admin apps), tell them: "Changes will sync when you're back online."
3. **Reassure when back** — toast: "Back online." If you queued anything, fire it and show a banner: "Syncing 3 pending changes…" → "All changes saved."

### Rules

- Never use a modal for connectivity. It blocks all interaction including the retry attempt.
- Use a banner (`tone="warning"`) for persistent offline state.
- A toast is appropriate for the moment of disconnect ("Internet disconnected") but not for the persistent condition.
- Don't trigger destructive cleanup on disconnect. The connection might come back in 2 seconds.

---

## 8. Partial failure — "7 of 10 products imported"

This is one of the most under-handled states in Shopify apps. A bulk operation rarely either succeeds completely or fails completely — it almost always succeeds for some items and fails for others. Treat partial success as a first-class state, not an edge case.

### The pattern

```tsx
<Banner
  tone="warning"
  title="Imported 7 of 10 products"
  action={{ content: "Retry failed", onAction: retryFailed }}
  secondaryAction={{ content: "Download error report", onAction: downloadCsv }}
>
  <p>3 products could not be imported. Common cause: missing SKU.</p>
  <List type="bullet">
    <List.Item>Acme Widget — duplicate handle</List.Item>
    <List.Item>Beta Gadget — missing price</List.Item>
    <List.Item>Gamma Tool — invalid weight unit</List.Item>
  </List>
</Banner>
```

### Rules

- **Count the wins first.** "Imported 7 of 10," not "Failed to import 3 of 10." Merchants need to know what worked before they fix what didn't.
- **List the failures with reasons.** Up to 10 inline. Beyond that, offer a CSV download.
- **Single retry action.** Re-process only the failed items, not all 10.
- **Don't auto-dismiss.** This is a persistent banner until merchant acknowledges.
- **Preserve order in retries.** Retried failures should appear in the same place if they succeed on second pass.

### Data shape

Return both arrays from your action so the UI can show both:

```ts
return json({
  succeeded: [{ id, handle }, ...],
  failed: [{ row, reason, payload }, ...],
});
```

---

## 9. Fifteen state UX rules

A condensed cheat sheet to keep next to your editor.

1. **Every page has 5 states.** Empty, loading, partial, error, and full. Design all five before shipping.
2. **First-run empty is different from filtered empty.** Different copy, different CTAs.
3. **Skeleton for dynamic content, not static.** A static title can render immediately.
4. **No skeleton under 300ms.** It flashes.
5. **No spinner over 10 seconds.** That's a slow process — show progress.
6. **Critical banners get screen-reader priority.** Use `tone="critical"` only when it really is.
7. **Toast = confirmation, Banner = condition, Modal = blocker.** Don't mix them up.
8. **Inline errors live with their field.** Banners summarize.
9. **Every error has a recovery action.** "Retry," "Reconnect," "Contact support," "Go back."
10. **A 200 from GraphQL is not a green light.** Check `userErrors` and `errors`.
11. **Optimistic UI only when you can predict the result.** No optimistic IDs.
12. **Failure rollback must be silent unless the user needs to act.** Toast on revert, not a modal.
13. **Partial failure is the default outcome of bulk ops.** Design for it.
14. **Verify connectivity with a fetch, not just `navigator.onLine`.**
15. **Tell merchants what to do, not just what happened.** "Reconnect Stripe" beats "Stripe error."

---

## 10. Concrete recipes

### Recipe A — Empty product list (first run)

```tsx
import { Page, EmptyState } from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";

export function EmptyProductList() {
  const navigate = useNavigate();
  return (
    <Page title="Products">
      <EmptyState
        heading="Start by adding your first product"
        action={{ content: "Add product", onAction: () => navigate("/products/new") }}
        secondaryAction={{
          content: "Import from CSV",
          onAction: () => navigate("/products/import"),
        }}
        image="/empty-products.svg"
      >
        <p>Products you add will show up here. You can also import a CSV.</p>
      </EmptyState>
    </Page>
  );
}
```

### Recipe B — Empty orders (filtered)

```tsx
<EmptyState
  heading="No orders match these filters"
  action={{ content: "Clear filters", onAction: clearFilters }}
  image="/empty-search.svg"
>
  <p>Try widening your date range or removing tags.</p>
</EmptyState>
```

Notice: no onboarding CTA. The merchant has orders — the filter just hid them.

### Recipe C — Failed API call (single action)

```tsx
import { Banner } from "@shopify/polaris";

function ProductSyncCard({ fetcher }: { fetcher: FetcherWithComponents<any> }) {
  const failed = fetcher.state === "idle" && fetcher.data?.error;
  if (!failed) return <SyncButton fetcher={fetcher} />;

  return (
    <Banner
      tone="critical"
      title="Could not sync products"
      action={{ content: "Try again", onAction: () => fetcher.submit(null, { method: "post" }) }}
      secondaryAction={{
        content: "Contact support",
        url: "mailto:support@yourapp.com?subject=Sync%20failed",
      }}
    >
      <p>
        Shopify returned an error. Request ID:{" "}
        <code>{fetcher.data.requestId}</code>
      </p>
    </Banner>
  );
}
```

### Recipe D — Slow query (long-running export)

For operations expected to take more than a few seconds, swap the skeleton/spinner for a progress message and let the merchant leave the page.

```tsx
<Card>
  <BlockStack gap="200">
    <InlineStack gap="200" blockAlign="center">
      <Spinner size="small" />
      <Text as="p">Generating export…</Text>
    </InlineStack>
    <Text as="p" tone="subdued">
      This usually takes 2-3 minutes. We'll email you when it's ready — feel free to navigate away.
    </Text>
    <ProgressBar progress={percent} size="small" />
  </BlockStack>
</Card>
```

For Remix specifically, kick the work off in an action that enqueues a background job, return immediately, and poll status via a `useFetcher` set on a 5-second interval. Don't tie up a request for 3 minutes.

### Recipe E — Bulk import with partial failure

```tsx
function ImportResult({ result }: { result: ImportResult }) {
  if (result.failed.length === 0) {
    return (
      <Banner tone="success" title={`Imported ${result.succeeded.length} products`} />
    );
  }
  return (
    <Banner
      tone="warning"
      title={`Imported ${result.succeeded.length} of ${result.succeeded.length + result.failed.length} products`}
      action={{ content: "Retry failed", onAction: () => retry(result.failed) }}
      secondaryAction={{
        content: "Download error CSV",
        onAction: () => downloadCsv(result.failed),
      }}
    >
      <List type="bullet">
        {result.failed.slice(0, 5).map((f) => (
          <List.Item key={f.row}>
            Row {f.row}: {f.reason}
          </List.Item>
        ))}
        {result.failed.length > 5 && (
          <List.Item>…and {result.failed.length - 5} more</List.Item>
        )}
      </List>
    </Banner>
  );
}
```

### Recipe F — Offline indicator

```tsx
import { Banner, Frame, Toast } from "@shopify/polaris";

function OfflineBanner({ offline }: { offline: boolean }) {
  if (!offline) return null;
  return (
    <Banner tone="warning" title="You're offline">
      <p>Some actions are disabled until you reconnect.</p>
    </Banner>
  );
}
```

Pair with a toast when state flips:

```tsx
useEffect(() => {
  if (justReconnected) showToast({ content: "Back online" });
}, [justReconnected]);
```

### Recipe G — 404 page

```tsx
<Page>
  <EmptyState
    heading="We couldn't find that product"
    action={{ content: "Back to products", onAction: () => navigate("/products") }}
    image="/empty-404.svg"
  >
    <p>It may have been deleted or the link may be wrong.</p>
  </EmptyState>
</Page>
```

### Recipe H — Form with both inline errors and a banner

```tsx
<Form method="post">
  {actionData?.errors && (
    <Banner tone="critical" title="Fix the errors below">
      <p>{actionData.errors.length} fields need your attention.</p>
    </Banner>
  )}
  <TextField
    label="Product title"
    value={title}
    onChange={setTitle}
    error={actionData?.errors?.title}
    autoComplete="off"
  />
  <TextField
    label="Price"
    value={price}
    onChange={setPrice}
    error={actionData?.errors?.price}
    autoComplete="off"
    type="currency"
  />
</Form>
```

Move focus to the banner on submit-with-errors so screen-reader users hear the summary first:

```tsx
const bannerRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (actionData?.errors) bannerRef.current?.focus();
}, [actionData]);
```

---

## Sources

- [Empty state — Shopify Polaris React](https://polaris-react.shopify.com/components/layout-and-structure/empty-state)
- [Skeleton page — Shopify Polaris React](https://polaris-react.shopify.com/components/feedback-indicators/skeleton-page)
- [Skeleton body text — Shopify Polaris React](https://polaris-react.shopify.com/components/feedback-indicators/skeleton-body-text)
- [Skeleton tabs — Shopify Polaris React](https://polaris-react.shopify.com/components/feedback-indicators/skeleton-tabs)
- [Banner — Shopify Polaris React](https://polaris-react.shopify.com/components/feedback-indicators/banner)
- [Error messages — Shopify Polaris React](https://polaris-react.shopify.com/content/error-messages)
- [Inline error — Shopify Polaris React](https://polaris-react.shopify.com/components/selection-and-input/inline-error)
- [Toast — Shopify Polaris React](https://polaris-react.shopify.com/components/deprecated/toast)
- [Modal — Shopify Polaris React](https://polaris-react.shopify.com/components/deprecated/modal)
- [Index table — Shopify Polaris React](https://polaris-react.shopify.com/components/tables/index-table)
- [useFetcher — Remix](https://remix.run/docs/en/main/hooks/use-fetcher)
- [useNavigation — Remix](https://remix.run/docs/en/main/hooks/use-navigation)
- [Pending and Optimistic UI — Remix](https://remix.run/docs/en/main/discussion/pending-ui)
- [Shopify API Response Statuses and Error Codes](https://www.cleverence.com/articles/shopify-dev-documentation/shopify-api-response-status-and-error-codes-5831/)
- [Offline UX design guidelines — web.dev](https://web.dev/articles/offline-ux-design-guidelines)
- [Fixing what's broken: in-product error messages — Shopify Design](https://medium.com/shopify-ux/fixing-whats-broken-how-to-improve-your-in-product-error-messages-f723508055bc)
