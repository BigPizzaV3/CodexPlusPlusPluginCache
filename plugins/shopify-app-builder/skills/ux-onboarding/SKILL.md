---
name: ux-onboarding
description: "Use when designing the first-run/onboarding experience of a Shopify embedded app. Covers the first-30-second rule, required-vs-optional setup, checklist vs wizard vs deferred-config vs sample-data, time-to-value targets, the 'aha moment' pattern, personalization using shop's currency/language/niche, activation events to instrument, and 15 onboarding pattern recipes built on Polaris components. Triggers: 'shopify app onboarding', 'first run', 'first time experience', 'app activation', 'onboarding checklist', 'wizard', 'empty state first install', 'time to value', 'aha moment', 'shopify app welcome screen', 'guide merchant'."
---

# Shopify Embedded App: First-Run Onboarding UX

Onboarding is the single highest-leverage screen in your app. A merchant who never reaches "aha" within their first session uninstalls inside 7 days at rates of 40-60% across the App Store. The goal of this skill is to get every merchant to one observable, on-store value moment in under 5 minutes, with zero theme code edits and zero credit-card friction.

This skill is opinionated. It is built on (1) the Shopify Built for Shopify requirements, (2) the Polaris onboarding guidance, (3) a teardown of 6 top-grossing apps (Klaviyo, Gorgias, Judge.me, Loox, Vitals, PageFly).

---

## 1. When to use

Pull this skill in when you are:

- Designing the welcome screen / first-run flow of a brand new Shopify embedded app
- Reworking an existing app's activation funnel because installs are not converting to paid
- Adding a "setup guide" or "getting started checklist" to an existing dashboard
- Deciding whether to gate the app behind a wizard or drop merchants into a tile-grid
- Pursuing the Built for Shopify badge (which has explicit onboarding requirements)
- Writing the empty state for the merchant's first visit before any data exists
- Auditing your own app and asking "why is our 7-day retention so bad"

Skip this skill if you are working on a public storefront (Hydrogen/Liquid) - that is a different audience and a different onboarding model.

---

## 2. The "first 30 seconds" rule

When a merchant clicks Install on the App Store and approves your scopes, your app loads inside an iframe in the Shopify admin. The first thing they see is yours to design. Built for Shopify reviewers grade this screen. Real merchants decide whether to keep your app based on what they see in roughly 30 seconds.

**What must be visible in the first 30 seconds:**

1. **A clear app title** - use the App Bridge `<ui-title-bar>` web component or Polaris `<Page title>`. The merchant should see your app name and nothing else competing for it.
2. **A one-sentence promise** - the same outcome verb you led with on the App Store listing ("Convert more shoppers", "Replace 10 apps", "Send your first review request in 60 seconds"). Use Polaris `<Text variant="bodyLg" tone="subdued">`.
3. **One primary CTA** - a single Polaris `<Button variant="primary">` that starts the activation path. Never two competing primary actions on the welcome screen.
4. **Proof the app is connected** - a small `<Badge tone="success">Connected to {shop}</Badge>` confirms OAuth worked. Removes the merchant's "did it install correctly" anxiety.
5. **A skip / dismiss option** - per Built for Shopify guidance, onboarding must be dismissible. A "Skip for now" Polaris `<Button variant="plain">` in the top-right.

**What must NOT be in the first 30 seconds:**

- A video that auto-plays
- A modal popup ("Welcome!" interrupting the welcome screen is hostile)
- A form with more than 3 fields
- Any request for credit card, billing, or upgrade
- A request for OAuth scopes you didn't ask for at install
- An external link that opens a new tab (the iframe context dies)

**Iframe-aware loading:**

The embedded app loads inside `https://admin.shopify.com/store/{shop}/apps/{your-app}`. The iframe has constraints: third-party cookies are not guaranteed, the URL has the `shop`, `host`, and `embedded` query params attached. Use App Bridge 4.x via the CDN script tag - do not try to navigate the parent window. For any "open in new tab" link, use `shopify.navigate({ to: '...', newContext: true })` rather than a raw `<a target="_blank">`.

**Skeleton, not spinner:**

If the first paint is gated on a backend call (e.g., fetching the shop's products to populate a picker), render a Polaris `<SkeletonPage>` with `<SkeletonBodyText>` and `<SkeletonDisplayText>` immediately. A spinner says "wait", a skeleton says "your screen is here and almost ready" - the perceived speed gap is significant.

---

## 3. Required vs optional steps

The biggest onboarding mistake is treating every nice-to-have as a required step. Built for Shopify explicitly caps onboarding at **5 steps**. Most apps need 1-3 required steps and should defer the rest.

**Gate (require) only the steps without which the app physically cannot deliver value.** Everything else is optional or deferred.

| Step type | Example | Treat as |
|---|---|---|
| App can't function without this | Connect at least one inbox (Gorgias), Pick a primary product (upsell apps) | **Required** |
| App works but produces poor results without this | Brand color, sender email, business industry | **Optional with smart default** |
| Needed at the moment of action, not install | Email DNS/sender records (Klaviyo), Facebook Pixel (PageFly) | **Deferred** - ask at point of need |
| Helps your analytics, not the merchant | Industry, monthly revenue, current ESP | **Optional, after first value** |
| Risky / scary asks | Credit card, billing, additional scopes | **Never at install** |

**Required step checklist:**

- Each required step has a clear "why we need this" tooltip
- Each required step has a sensible default if any default is possible (e.g., pre-fill sender email from `shop.email`)
- Required steps total no more than 3 fields per screen, no more than 5 steps total
- Each step shows a `<ProgressBar progress={n/total * 100} />` so merchants see they're not in a loop

**Bad: requiring a "How big is your store?" multi-choice before the app does anything.** This is information gathering for you, friction for them.

**Good: deferring the same question to a tooltip on the dashboard after first value, framed as "want better recommendations?"**

---

## 4. The four onboarding patterns

There are four legitimate onboarding patterns. Pick exactly one. Mixing patterns produces incoherent UX.

### A. Checklist (the default - use this 60% of the time)

A persistent card with 3-5 task items, each with a checkbox state, that lives on the dashboard until 100% complete. The merchant can do tasks in any order, dismiss the card, and return to it. Used by Klaviyo (5 tasks), Gorgias (5 tasks), Shopify's own admin home.

**When it fits:**
- App has 3-5 setup tasks that are independent of each other
- Merchant might want to do tasks across multiple sessions
- Some tasks are required, others are optional-but-recommended

**Polaris components:**
- `<Card>` as the container
- `<BlockStack gap="400">` for vertical layout
- `<InlineStack>` for each task row (icon + label + status)
- `<Icon source={CircleTickIcon} tone="success">` for completed, `<Icon source={CircleIcon} tone="subdued">` for pending
- `<ProgressBar progress={pctComplete}>` at the top of the card
- `<Button variant="plain">Dismiss</Button>` in the card header

**Code pattern (sketch):**

```jsx
<Card>
  <BlockStack gap="400">
    <InlineStack align="space-between">
      <Text variant="headingMd">Get started ({completed}/{total})</Text>
      <Button variant="plain" onClick={dismissChecklist}>Skip for now</Button>
    </InlineStack>
    <ProgressBar progress={(completed / total) * 100} />
    {tasks.map(task => (
      <InlineStack key={task.id} gap="200" align="space-between" blockAlign="center">
        <InlineStack gap="200">
          <Icon source={task.done ? CircleTickIcon : CircleIcon}
                tone={task.done ? "success" : "subdued"} />
          <Text>{task.label}</Text>
        </InlineStack>
        {!task.done && (
          <Button onClick={task.action}>{task.cta}</Button>
        )}
      </InlineStack>
    ))}
  </BlockStack>
</Card>
```

### B. Wizard (use sparingly, ~15% of apps)

A linear, multi-step flow where each step blocks until completed. Step 1 of N. Used for apps where the steps must be done in order and where the merchant can't usefully see the dashboard without all data.

**When it fits:**
- Steps have hard dependencies (Step 2 needs answer from Step 1)
- App is unusable until all required data is collected (e.g., a customs-paperwork generator that needs shipping origin, destination, product HS codes before any UI works)
- The total flow is genuinely under 5 steps and under 3 minutes

**When it does NOT fit:**
- You can show useful preview even with partial data
- Merchant wants to explore before committing to setup
- More than 5 steps

**Polaris components:**
- `<Page>` wrapper with `<Page.Header title="Step 2 of 4">`
- `<Card>` containing the step's form
- `<FormLayout>` for fields
- `<InlineStack align="space-between">` footer with `<Button>Back</Button>` and `<Button variant="primary">Continue</Button>`
- `<ProgressBar progress={stepNum / totalSteps * 100} />` at the top

**Critical wizard rule:** A "Skip" button on every step that lets the merchant exit to the dashboard. Built for Shopify requires dismissibility. A wizard that traps users is a Built for Shopify rejection.

### C. Deferred config (~15% of apps)

The merchant lands directly on a working dashboard. Setup tasks are surfaced only at the moment the merchant tries to use a feature that needs them. The app appears to "just work" because all defaults are sensible.

**When it fits:**
- App has many independent features (Vitals model - 40+ sub-features in a tile grid)
- Merchant exploration is the natural first action
- Defaults are genuinely sensible for the median merchant

**Polaris components:**
- Direct rendering of dashboard with `<EmptyState>` cards for empty zones
- `<Banner tone="info">` only when something specific needs setup, e.g., "Connect Klaviyo to enable email triggers" - shown on the feature that needs it
- `<Modal>` triggered when the merchant clicks a feature that requires setup, surfacing the config inline

### D. Sample data (~10% of apps, especially analytics/dashboards)

For apps whose value is visual (charts, recommendations, lists), show the dashboard pre-populated with realistic sample data on first load. The merchant sees what success looks like before they have any real data. A clear "This is sample data - connect your store to see your real numbers" banner makes the swap legible.

**When it fits:**
- App's value is shown through visualizations or lists
- New stores have zero data and would see an empty chart otherwise
- The shape of the data is the product (analytics, recommendations, attribution)

**Polaris components:**
- `<Banner tone="info" onDismiss={...}>` at the top: "You're seeing sample data. Real data appears after your first order."
- Normal dashboard rendering below, with sample values
- A subtle `<Badge tone="info">Sample</Badge>` next to each chart title

**Sample data discipline:**
- Use believable, realistic numbers (not "$1,000,000 revenue" - use $4,247)
- Make sample data match the shop's currency and timezone from the start
- Replace seamlessly with real data the moment it exists - no "switch to real data" button needed

---

## 5. Time-to-value (TTV) targets by app category

Time to value = seconds between app install and the merchant seeing one tangible, on-store or on-dashboard outcome that maps to their reason for installing. Different app categories have different physically achievable TTV ceilings.

| App category | TTV target | Aha moment example |
|---|---|---|
| Reviews | < 7 days for first photo review (auto-send happens after first fulfilled order) | First 5-star photo review goes live on product page |
| Email marketing | < 24h for welcome flow live | Welcome email sent to first new subscriber |
| Page builder | < 15 min to first published page | Merchant pastes their custom page URL into browser and sees it live |
| Helpdesk | < 1h to first inbound ticket centralized | First customer email lands in the helpdesk inbox |
| Upsell / CRO | < 10 min to first widget visible on storefront | Sticky add-to-cart appears on product page |
| Bundles / discounts | < 5 min to first bundle live | Bundle visible on product page |
| Analytics / dashboards | < 60 seconds to first dashboard view | Sample data renders, real data fills in over the next hour |
| Inventory / fulfillment | < 30 min to first sync complete | Inventory levels match storefront |
| Loyalty | < 1 day to first earning event | A customer earns their first point |
| Subscriptions | < 1 hour to first subscription product configured | A product is enabled for subscription on the PDP |

**Rule of thumb:** Whatever your category's TTV target is, your onboarding flow should clear the way to that moment - not gate it behind information collection.

**Instrument TTV as a metric.** For every install, log timestamp_install and timestamp_first_value_event. Aggregate the median and the 75th percentile. Watch them trend after every onboarding change. If median TTV goes up, your last change was a regression.

---

## 6. The "aha moment"

Define one specific, observable event that captures "this app delivered what I came for." Then engineer your onboarding to make that event happen as fast as humanly possible.

**Examples of well-defined aha moments:**

- Klaviyo: First abandoned-cart email attributed revenue dollar appears on dashboard
- Gorgias: First AI-resolved ticket banner appears
- Judge.me: First photo review goes live on a product page
- Loox: First photo review submission appears in moderation queue
- PageFly: First published page URL renders correctly in a browser
- Vitals: Three features enabled and visible on storefront within 5 minutes

**How to engineer toward the aha moment:**

1. Write the aha event as a single sentence with a verb and a subject. "Merchant sees their first review on their product page."
2. List every step the merchant must complete to reach that event. Cut steps until only the irreducible minimum remains.
3. Pre-fill or default every value you possibly can. Use `shop.email`, `shop.currency`, `shop.primary_domain`, `shop.country_code`, `shop.plan_display_name` from the Shopify GraphQL Admin API to skip questions.
4. Auto-trigger the event when possible. Judge.me doesn't ask the merchant to send a review email - it auto-sends 7 days after the first fulfilled order. The merchant takes zero actions and gets the aha event.
5. Push a notification the moment the aha event happens. Polaris `<Toast>` or App Bridge `shopify.toast.show()` works in-app. An email or Slack ping pulls the merchant back if they've closed the tab.

**Instrument:** fire a single analytics event called `aha_moment_reached` with the timestamp delta from install. This is your most important activation KPI.

---

## 7. Personalization at first-run

You get five free, useful values from the Shopify Admin GraphQL API immediately after OAuth. Use them.

**Query at install:**

```graphql
query ShopBootstrap {
  shop {
    id
    name
    email
    currencyCode
    primaryDomain { url host }
    plan { displayName }
    billingAddress { countryCodeV2 }
    ianaTimezone
    contactEmail
  }
  shopLocales { locale primary published }
}
```

**What to do with each value:**

| Value | First-run use |
|---|---|
| `shop.name` | Welcome screen: "Welcome to {App}, {shop.name}!" |
| `shop.email` / `shop.contactEmail` | Pre-fill sender email field - don't ask |
| `shop.currencyCode` | Format all dollar/euro/yen/INR examples in the merchant's currency from screen 1 |
| `shop.primaryDomain` | Show example URLs as `{primaryDomain}/products/example` rather than `your-store.com/products/example` |
| `shop.plan.displayName` | Hide upsells for features the merchant's Shopify plan doesn't support (e.g., don't pitch Shopify Markets features to a Basic merchant) |
| `shop.billingAddress.countryCodeV2` | Default tax/shipping/legal copy to the right jurisdiction. Show "Including GST" in India, "Including VAT" in EU, etc. |
| `shop.ianaTimezone` | All dates/times display in the merchant's timezone, not UTC. "Sent at 2:14 PM your time" |
| `shopLocales` | If the primary locale is not English, load the matching Polaris locale (`@shopify/polaris/locales/fr.json` etc.) and translate your own copy if you support it |

**Niche/category personalization (optional):**

Query the shop's first 50 products with `productType` and `tags`. Infer the niche (apparel, beauty, home goods, electronics, B2B). Use the inference to pick the best onboarding sample / template / recommendation. Loox does this to pick a default widget style; PageFly does this to filter the template gallery.

**Anti-pattern:** asking the merchant "What do you sell?" when their store already says it. The Shopify Admin API is your form-fill engine.

---

## 8. 15 onboarding recipes

Each recipe is a tested pattern with Polaris components and a concrete use case. Mix and match - most apps use 4-7 of these.

### Recipe 1: Welcome banner with a single CTA

A dismissible `<Banner tone="info">` at the top of the dashboard on first load. One sentence promise + one button. Disappears after dismissed once (persist state to your DB keyed by shop).

```jsx
<Banner tone="info" onDismiss={dismissWelcome}
  action={{ content: 'Start setup', onAction: startSetup }}>
  Welcome to {appName}, {shopName}. Set up takes about 3 minutes.
</Banner>
```

### Recipe 2: Persistent setup-checklist card

The "Recipe A" pattern from section 4. A card with 3-5 tasks, progress bar, dismissible. Klaviyo / Shopify admin home pattern.

### Recipe 3: Sample data toggle

When the dashboard renders for the first time, show realistic sample data with a `<Badge tone="info">Sample</Badge>` next to each metric. Auto-swap to real data the moment any exists.

### Recipe 4: "Skip for now" everywhere

Every onboarding step has a small `<Button variant="plain">Skip for now</Button>`. This is non-negotiable for Built for Shopify. Track skip rates per step - the step with the highest skip rate is the one to redesign or remove.

### Recipe 5: Contextual tooltip with Polaris Popover

Don't explain features upfront. Attach a `<Popover>` to the first usage of each feature. The merchant clicks the small `<Icon source={QuestionCircleIcon}>` next to a field and gets the explanation only if they want it.

```jsx
<Popover active={popoverActive} activator={
  <Button variant="plain" onClick={togglePopover}>
    <Icon source={QuestionCircleIcon} />
  </Button>
} onClose={togglePopover}>
  <Box padding="400">
    <Text>Sender email is the From: address used on review request emails. Defaults to your Shopify account email.</Text>
  </Box>
</Popover>
```

### Recipe 6: Picker-first empty state

Replace any blank canvas with a picker. "What do you want to build?" / "Pick a widget style" / "Choose a template". Use `<InlineGrid columns="3">` with `<Card>` tiles, each tile a choice. Loads a sensible default when clicked. Source: PageFly, Loox.

### Recipe 7: Sandbox / preview mode

Let the merchant try the app on a sample order or sample product before touching real data. A `<Banner tone="info">You're in preview mode</Banner>` makes the state legible. Useful for review apps, email apps, anything destructive.

### Recipe 8: Inline help links on every field

Each form field's `helpText` prop on Polaris `<TextField>` carries a one-line explanation. No separate help docs needed for the common case. Reserve `<Link url="...">Learn more</Link>` for advanced edge cases.

### Recipe 9: Auto-detect and confirm

Detect a value (theme, currency, niche, store size) and show the merchant your guess with a "yes / change" choice. "We detected your store is in INR. Show prices in INR? [Yes] [Use different currency]". Lower friction than asking, higher accuracy than assuming.

### Recipe 10: Theme app extension auto-install

For any storefront-visible widget, use the Theme App Extension (Online Store 2.0 app blocks) and surface a button labeled "Add to your theme" that opens the theme editor at the right block. No code editing required. Polaris `<Button>` linking to the theme editor's deep link URL.

### Recipe 11: Defer the scary ask

DNS records, SMTP setup, billing, additional OAuth scopes, payment methods - none of these belong at install. Ask at the moment the merchant tries to use the feature that needs them. Klaviyo defers DNS to first campaign send.

### Recipe 12: One-click migration from named competitors

If your category has incumbents, list each by name in a "Switching from another app?" card. CSV import, API import, screenshot upload - whatever it takes. Brings switching cost close to zero. Source: Judge.me, Loox.

### Recipe 13: First-day welcome email

Within 1 hour of install, send the merchant a short welcome email. Three lines max: one personal sentence, one link to the setup checklist deep-link, one reply-to address. This pulls back the 30-40% of merchants who close the tab right after install.

### Recipe 14: Dashboard-as-onboarding (deferred config)

Skip the welcome screen entirely. Land the merchant directly on the dashboard with `<EmptyState>` cards filling zones that need setup. Each `<EmptyState>` has a single action button. Source: Vitals.

### Recipe 15: The "aha metric" dashboard tile

Pick the one number you want the merchant to watch every day (deflection rate, attributed revenue, reviews collected this week, sticky-ATC adds today). Make it the biggest visual element on the dashboard with a Polaris `<Text variant="heading2xl">` value and a one-word label. This is the addictive surface that drives retention. Source: Gorgias, Klaviyo, Loox.

---

## 9. Activation events to instrument

You can't optimize what you don't measure. At minimum, instrument these events with timestamps and a shop ID:

| Event | When it fires |
|---|---|
| `app_installed` | OAuth completes |
| `welcome_screen_viewed` | First admin page loads |
| `onboarding_step_completed` | Each step in checklist / wizard, with step name |
| `onboarding_step_skipped` | Each "Skip for now" click, with step name |
| `onboarding_dismissed` | Whole onboarding flow dismissed |
| `feature_first_used` | Per major feature - merchant uses it for the first time |
| `aha_moment_reached` | Your single defined aha event |
| `theme_block_added` | Merchant adds your theme app extension block |
| `external_credential_connected` | E.g., connects Klaviyo / Meta / Google |
| `billing_charge_accepted` | Merchant approves a paid plan |
| `app_uninstalled` | App removed (Shopify webhook) |

**Derived metrics from these events:**

- Median TTV = median(timestamp(aha_moment_reached) - timestamp(app_installed))
- Activation rate D1, D7, D30 = % of installs that reached aha_moment_reached within 1/7/30 days
- Step skip rate by step = skips / (skips + completions)
- Step funnel = step1_completed > step2_completed > step3_completed
- Free-to-paid conversion = billing_charge_accepted / aha_moment_reached

Watch the step skip rate weekly. Any step over 30% skip rate is a candidate to remove, default, or defer.

---

## 10. Anti-patterns

Concrete patterns that look helpful but actively hurt activation. Don't ship these.

- **Auto-playing full-screen welcome video.** Merchants on slow connections see a loading spinner; merchants in coffee shops get audio they can't stop fast enough. If you have a video, make it a thumbnail with a play button, max 90 seconds.
- **Modal popup on first load.** Modals are interruptions. Use a Banner or a Card. Reserve Modal for explicit user actions ("Edit settings", "Delete confirmation").
- **Asking for credit card before any value.** Built for Shopify standard: no payment friction at install. Trial expirations are fine; payment-up-front is not.
- **Multi-step wizard with no skip button.** Built for Shopify rejection. Always-dismissible.
- **More than 5 steps total.** Built for Shopify explicit cap.
- **Asking the merchant what their currency / language / store name is.** You have all of this from the Admin API. Asking signals you didn't bother to integrate properly.
- **Onboarding that resets every visit.** Persist state in your DB keyed by shop. A merchant who completes Step 2 and comes back should see Step 3, not Step 1 again.
- **"Connect Facebook / Klaviyo / TikTok / Google" required at install.** Defer to the moment that integration is actually needed.
- **Generic "Welcome!" with no action.** A welcome screen with no CTA is a wasted screen. Every screen must have exactly one obvious next action.
- **Onboarding copy that brags about your features.** Merchants don't care that you have 40 features. They care about the one outcome they came for. Copy should be in the merchant's voice, not yours.
- **Spinner instead of skeleton screen.** Skeleton screens (Polaris `<SkeletonPage>`, `<SkeletonBodyText>`) feel ~30% faster than the equivalent spinner.
- **"Watch this video" as a step.** Videos are not steps; they're optional context. Don't gate the next button behind watching.
- **Hiding the dismiss button.** Make "Skip for now" visually obvious, not buried in a corner at low contrast.
- **Asking unrelated questions to gather analytics data.** "What size is your store" / "How did you hear about us" - put these in a settings page later or in a post-aha survey, never in install flow.

---

## 11. Decision tree: which pattern do I use?

Walk this tree top-down to pick your onboarding pattern.

**1. Does your app physically require specific configuration to function at all (e.g., must have an inbox / must have a primary product picked)?**
- Yes -> Continue to 2
- No -> Pattern: **Deferred config** (Recipe 14). Drop the merchant on the dashboard.

**2. Are the required configuration steps dependent on each other (Step 2 needs answer from Step 1)?**
- Yes, hard dependencies -> Pattern: **Wizard** (Section 4B). Keep it under 5 steps with a skip on every step.
- No, steps are independent -> Continue to 3

**3. Is the app's value visualized through charts/lists where empty state would look broken?**
- Yes -> Pattern: **Sample data** (Section 4D) + **Checklist** (Section 4A) overlaid. Show sample data while merchant works through a small checklist of setup tasks.
- No -> Pattern: **Checklist** (Section 4A) alone.

**4. Independent of the above, every flow gets these:**
- Personalization at first-run using `shop.*` (Section 7)
- Welcome banner with one CTA (Recipe 1)
- Skip-for-now on every step (Recipe 4)
- Aha metric tile on the dashboard (Recipe 15)
- Activation events instrumented (Section 9)

**5. Optional additions based on category:**
- Storefront-visible widget? Add Theme app extension auto-install (Recipe 10)
- Competitive category with incumbents? Add one-click migration (Recipe 12)
- Complex / visual product? Add sandbox preview mode (Recipe 7)
- Anything destructive or scary? Add contextual Popover tooltips (Recipe 5)
- Want to recapture closed-tab merchants? Add first-day welcome email (Recipe 13)

**6. Test:**
- Install your own app in a new dev store
- Time the seconds from "click Install" to "see the aha moment" with a stopwatch
- If you're over your category TTV target (Section 5), cut steps until you're under

---

## References

- Built for Shopify onboarding requirements: https://shopify.dev/docs/apps/launch/built-for-shopify/requirements
- Polaris onboarding guidance: https://shopify.dev/docs/apps/design/user-experience/onboarding
- Polaris components: https://polaris-react.shopify.com/components
- App Bridge web components: https://shopify.dev/docs/api/app-home/polaris-web-components
- Internal: `research/03_frontend.md` (Polaris component reference)
- Internal: `research2/10_top_app_ux_teardown.md` (top app onboarding teardowns)
