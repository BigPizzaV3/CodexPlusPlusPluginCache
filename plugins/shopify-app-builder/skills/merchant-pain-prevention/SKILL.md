---
name: merchant-pain-prevention
description: "Use when designing, building, reviewing, or shipping a Shopify app to avoid the patterns that get merchants angry (1-2 star reviews, uninstalls, churn). Covers theme injection / leftover code on uninstall, surprise billing, fake urgency, slow scripts, cancel friction, scope creep, bot-only support, broken on platform updates, locale/checkout breakage. Triggers: 'merchant complaint', 'avoid bad app review', 'shopify app uninstall hygiene', 'leftover code in theme', 'surprise charge', 'shopify app dark pattern', 'billing after uninstall', 'cancel friction', 'shopify app churn', '1 star review', 'billed after trial', 'shopify app cleanup'. MUST trigger on any pre-ship review or quality check."
---

# Merchant Pain Prevention

Every 1-star review on the Shopify App Store is a merchant who trusted you and felt betrayed. This skill is the inverse of that experience — a hard-coded inventory of the patterns that cause the betrayal, with the structural fixes.

The merchant pain ecosystem is small and loud. Stores talk. Subreddits index. Community threads outrank the App Store on Google for the phrase "billed for uninstalled app" — there are at least eight active threads on that exact phrase. If you ship a billable app and get one of those patterns wrong, you will not just lose that merchant; you will repel the next 50 who Google your name.

This is not a style guide. It is a survival document. Follow it.

---

## 1. When to use

Invoke this skill whenever you are:

- **Designing** a new Shopify app or extension — before architecture is locked, before scopes are declared, before billing is wired.
- **Reviewing a PR** that touches: theme app extensions, ScriptTag, billing API, webhook handlers, scopes (`shopify.app.toml`), onboarding flow, cancellation flow, email triggers, popups, banners, countdown timers, "social proof" widgets.
- **Pre-ship audit** — the 48 hours before you submit to the App Store or release a new version.
- **Triaging a merchant complaint** — public 1-star, support ticket, refund request, chargeback, BBB complaint, Trustpilot drop, Reddit post that mentions your app by name.
- **Annual reaudit** — quarterly is better. Scopes accrete. Pricing pages drift. Anti-patterns sneak back in when feature flags collide.
- **Investigating churn** — a sudden uninstall spike usually maps to one of the cardinal pains.

If anyone on your team says "merchants will figure it out" or "this is industry standard" or "everyone does it this way" — that is the trigger to run this skill in full. Industry standard on Shopify is what generates 12 BBB complaints a day. Do not aim for industry standard.

---

## 2. The 7 cardinal merchant pains (ranked by anger)

Ranked by how fast they get you a public 1-star review, a chargeback, a Reddit post, and an unrecoverable partner-reputation hit. Each is documented with verbatim merchant quotes.

### Pain 1 — Charged after uninstall

The single most-litigated complaint on the App Store. At least eight active Shopify Community threads use this exact phrase as the title. The complaint compounds because Shopify Support since May 3, 2023 no longer mediates refund requests on behalf of merchants — they tell the merchant to email the developer, who often ghosts.

> "Why am I still billed for an uninstalled app on Shopify?" — verbatim title repeated across at least five threads. [community.shopify.com/t/why-am-i-still-billed-for-an-uninstalled-app-on-shopify/191216](https://community.shopify.com/t/why-am-i-still-billed-for-an-uninstalled-app-on-shopify/191216)

> "Why am I still being charged for POS after uninstalling? I don't use it and uninstalled the app months ago." — the Shopify-owned POS app does it too. [community.shopify.com/t/why-am-i-still-being-charged-for-pos-after-uninstalling/286967](https://community.shopify.com/t/why-am-i-still-being-charged-for-pos-after-uninstalling/286967)

> "Why is a merchant that uninstalled our app seeing charges two months later?" — developer-side version of the same complaint. [community.shopify.dev/t/why-is-a-merchant-that-uninstalled-our-app-seeing-charges-two-months-later/23625](https://community.shopify.dev/t/why-is-a-merchant-that-uninstalled-our-app-seeing-charges-two-months-later/23625)

**Root cause:** recurring app charges are generated on the **first day of the app's billing cycle**, not Shopify's. Uninstalling stops future cycles but does NOT cancel an already-generated invoice. If the merchant uninstalls one day after install, an invoice is still pending.

### Pain 2 — Trial → silent auto-charge

> "I canceled my free trial in time, and still got charged." [community.shopify.com/c/shopify-discussions/i-canceled-my-free-trial-in-time-and-still-got-charged/td-p/2282529](https://community.shopify.com/c/shopify-discussions/i-canceled-my-free-trial-in-time-and-still-got-charged/td-p/2282529)

> "Tried to cancel subscription after free trial was charged." [community.shopify.com/c/shopify-discussions/tried-to-cancel-subscription-after-free-trial-was-charged/td-p/851254](https://community.shopify.com/c/shopify-discussions/tried-to-cancel-subscription-after-free-trial-was-charged/td-p/851254)

> "Privy continued charging for nearly six years on an inaccessible second account, with the user only discovering this in 2025. After providing full documentation, Privy refunded only six months of charges out of 70+ months and refused to refund the remainder." [apps.shopify.com/privy/reviews](https://apps.shopify.com/privy/reviews)

### Pain 3 — Leftover code in theme after uninstall

> "Left over code from app." — verbatim title; the Site Speed sub-forum is full of these. [community.shopify.com/c/site-speed/left-over-code-from-app/td-p/1581837](https://community.shopify.com/c/site-speed/left-over-code-from-app/td-p/1581837)

> "Leftover code from uninstalled app — how do I remove it from my website?" [community.shopify.com/t/leftover-code-from-uninstalled-app-how-do-i-remove-it-from-my-website/294871](https://community.shopify.com/t/leftover-code-from-uninstalled-app-how-do-i-remove-it-from-my-website/294871)

> "After uninstalling the Translate & Adapt app, a language selector dropdown remained embedded in the storefront — with no notification that theme elements persist after uninstall." — even Shopify's own app does this.

### Pain 4 — Slowing the store / killing Core Web Vitals

The #1 functional complaint that maps to lost revenue.

> "This app loads incredibly slow — takes about 30–40 sec. after clicking on items." — PageFly 1-star, cited in Reddit "lightweight builder" recommendations.

> "Why is my store speed slowing down and how can I improve it?" — the answer 9 times out of 10 is "look at your apps." [community.shopify.com/c/shopify-discussions/why-is-my-store-speed-slowing-down-and-how-can-i-improve-it/m-p/2221261](https://community.shopify.com/c/shopify-discussions/why-is-my-store-speed-slowing-down-and-how-can-i-improve-it/m-p/2221261)

The math reviewers quote: every 1-second delay → 7% conversion drop. 53% of mobile visitors leave if a page does not load in 3 seconds. Average Shopify store: 6–12 apps installed, adding 2–5 seconds to page load.

### Pain 5 — Cancel friction / can't cancel inside the app

> "Cannot cancel inside the app. Have to email support, then ask again the next month when I'm charged anyway." — Justuno reviewer pattern.

> "Asked to cancel three times. Each time they confirm cancellation and the next month I'm charged again." — Spocket / general subscription cancellation.

The FTC's Click-to-Cancel rule (in force since 2025) requires cancellation to be at least as easy as signup. Apps that violate it expose Shopify AND the merchant to legal risk.

### Pain 6 — Support is a bot loop with no human exit

> "Each question took 6 hours+ to get a response on their own chat function." — Gorgias review widely cited by Reddit merchants comparing helpdesks. [apps.shopify.com/helpdesk/reviews](https://apps.shopify.com/helpdesk/reviews)

> "How can I reach support when the AI bot keeps timing out?" [community.shopify.com/t/how-can-i-reach-support-when-the-ai-bot-keeps-timing-out/413511](https://community.shopify.com/t/how-can-i-reach-support-when-the-ai-bot-keeps-timing-out/413511)

> "Bug reports submitted a month ago. No fix. They told me publicly on the App Store that I haven't been ignored. I have." — Willdesk reviewer.

> "Their support replied with a script three times. Same words. Different agent name. The bug is still there." — Bold Subscriptions reviewer.

### Pain 7 — Breaks on the next Shopify platform update

> "The app has taken money from our account without authorization, approximately $1600 in unauthorized charges. The app became useless after Shopify's November checkout app update." — ReConvert 1-star. [apps.shopify.com/reconvert-upsell-cross-sell/reviews](https://apps.shopify.com/reconvert-upsell-cross-sell/reviews)

> "Some merchants unable to access and apply Checkout Blocks App functions — checkout blocks has been broken for about 12 hours, with all functions on stores being wiped and the blocks while still in the app being removed from the checkout." [community.shopify.dev/t/some-merchants-unable-to-access-and-apply-checkout-blocks-app-functions/27602](https://community.shopify.dev/t/some-merchants-unable-to-access-and-apply-checkout-blocks-app-functions/27602)

> "Sync stopped working when Shopify moved off REST. App kept saying everything was synced. We oversold for two weeks." — Inventory Planner reviewer.

---

## 3. Theme injection hygiene

### The rule

**App Embeds and App Blocks only. Never ScriptTag. Never write to `theme.liquid`.**

ScriptTag-injected scripts:
- Cannot be disabled by the merchant without contacting you.
- Persist (sometimes) after uninstall.
- Load on every page including `/policies/*`, `/account/*`, cart, checkout — pages your widget doesn't need.
- Count against the merchant's Lighthouse score forever.

App Embeds:
- Default OFF — the merchant must enable in Theme Editor → App embeds.
- One-click toggle off without touching code.
- Loaded from Shopify's CDN with performance budgets.
- **Disappear automatically when the app is uninstalled.**

Shopify removed `theme.liquid` write scope access from third-party apps in April 2023 specifically because of abuse. If your onboarding still says "paste this snippet into your theme code," you are building for a platform that no longer exists.

### Concrete prohibitions

- Do NOT use `ScriptTag` API for new apps. Period.
- Do NOT instruct merchants to paste code into `theme.liquid` manually.
- Do NOT use ScriptTag as a "fallback" when the merchant disables your App Embed.
- Do NOT auto-enable App Embeds via any API trick. They must be off until the merchant toggles them on.
- Do NOT inject anything into checkout via legacy methods. Use Checkout UI Extensions.

### App Embed scaffold (Theme App Extension)

```toml
# extensions/storefront-widget/shopify.extension.toml
api_version = "2026-01"
name = "Your Widget"
type = "theme"

[[extensions.targeting]]
target = "section"
```

```liquid
{# extensions/storefront-widget/blocks/widget.liquid #}
{% schema %}
{
  "name": "Your Widget",
  "target": "section",
  "settings": [
    { "type": "checkbox", "id": "enabled", "label": "Enable widget", "default": false }
  ]
}
{% endschema %}

{% if block.settings.enabled %}
  <div id="your-widget" data-shop="{{ shop.permanent_domain }}"></div>
  <script src="{{ 'widget.js' | asset_url }}" defer></script>
{% endif %}
```

### Webhook handler — uninstall cleanup

Even though App Embed extension assets disappear automatically, you still own all the other side effects: ScriptTag rows (if a legacy version of your app created any), metafield definitions, metaobjects, billing records, cached customer data. The uninstall webhook is non-optional.

```typescript
// app/routes/webhooks.app.uninstalled.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { db } from "../db.server";

export async function action({ request }: ActionFunctionArgs) {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`[webhook] ${topic} for ${shop}`);

  if (!session) {
    // Already uninstalled or token revoked — proceed with cleanup using stored data only
  }

  await Promise.all([
    // 1. Remove any legacy ScriptTags (only if you ever shipped a version with them)
    removeLegacyScriptTags(shop, session?.accessToken).catch(logSafe),

    // 2. Delete metafield definitions you created under your reserved namespace
    deleteAppMetafieldDefinitions(shop, session?.accessToken).catch(logSafe),

    // 3. Delete metaobjects you created
    deleteAppMetaobjects(shop, session?.accessToken).catch(logSafe),

    // 4. Cancel any external billing (you shouldn't have any — see Section 4)
    cancelExternalBilling(shop).catch(logSafe),

    // 5. Mark the shop record for data deletion in 48h grace window
    db.shop.update({ where: { shop }, data: { uninstalledAt: new Date(), pendingDeletionAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } }),

    // 6. Send the goodbye email with one-click data-export link
    sendGoodbyeEmailWithExport(shop),
  ]);

  return new Response();
}

function logSafe(err: unknown) {
  console.error("[uninstall cleanup partial failure]", err);
}
```

### Provide a "clean up theme code" button

For apps that have ever shipped a ScriptTag version, expose a dashboard button: *"Scan and remove app code from theme."* Detect any tag you've ever added (track by `src` substring matching your CDN), offer one click to remove, with a diff preview. This single feature converts angry uninstallers into neutral ones.

---

## 4. Billing trust

### The structural Shopify "developer-discretion refund" trap

Read this twice. It is the most-misunderstood part of the Shopify billing model and it is responsible for hundreds of 1-star reviews.

1. Shopify generates recurring app charges on the **first day of the app's billing cycle for that shop**, not on Shopify's monthly billing day.
2. Uninstalling the app **stops future billing cycles but does NOT cancel an already-generated invoice for the current cycle.**
3. Shopify Support **since May 3, 2023** no longer mediates refund requests on behalf of merchants for third-party app charges. The merchant must email the developer.
4. The developer can issue a credit via the Billing API — but it is at developer discretion.

**Result:** a merchant who installs on day 1, uninstalls on day 3, will receive an invoice for the full month. When they contact Shopify, Shopify says "contact the developer." When they contact the developer, the developer can choose to refund or not. If the developer ignores them, the merchant has no platform-level recourse. They write a 1-star review and post on Reddit.

### How to never trip the trap

1. **All billing through Shopify Billing API.** No external Stripe. No PayPal. No Paddle. No exceptions. External billing means uninstall does not automatically cancel — and you become responsible for the months-later-charge story.

2. **Pro-rate / credit partial billing cycles on uninstall.** Use the `appSubscriptionCancel` mutation with `prorate: true`. Yes, you eat some margin. You also stop the chargeback wave and the public 1-stars. The math always works out positive.

3. **Send a billing-cycle reminder email 3 days before the next charge.** And another the day of. Include direct uninstall link with a one-click confirmation.

4. **No trial-to-paid surprise.** Email at install + trial-end-minus-3 + trial-end day. Require an active confirmation to convert, or charge $0 until first measurable usage event.

5. **One-click cancel inside the app.** Not via support email. Not behind 6 confirmation modals. Single button → confirm → done. Optional exit survey appears AFTER the cancel processes, fully skippable.

6. **Subscribe `app/uninstalled` webhook with retry logic.** A silent webhook failure is the root cause of the "charged two months later" complaint pattern. Set up a dead-letter queue.

7. **Auto-pause on usage cap breach. Never auto-upgrade.** A merchant who exceeds 1000 events on a 1000-event plan should be paused with a prompt to upgrade — NOT silently upgraded to the $99 tier.

### Sample appSubscriptionCancel with proration

```graphql
mutation CancelSubscriptionWithRefund($id: ID!) {
  appSubscriptionCancel(id: $id, prorate: true) {
    appSubscription {
      id
      status
      currentPeriodEnd
    }
    userErrors {
      field
      message
    }
  }
}
```

### Pre-charge warning email template

```
Subject: Heads up — your [App Name] trial ends Friday

Hi [merchant first name],

Your 14-day trial of [App Name] ends in 3 days, on [date].

On [date], your card will be charged $X for the [plan name] plan.

If [App Name] isn't working for you, you can cancel in one click:
https://[app-admin-url]/billing/cancel

You won't be charged anything if you cancel before [date].

Questions? Reply to this email and a real human will respond in under 24h.

[Founder name]
[App Name]
```

### Billing checklist (must all be true before ship)

- [ ] All billing routed through `appSubscriptionCreate` / `appUsageRecordCreate`. Zero external billing.
- [ ] `appSubscriptionCancel` is called with `prorate: true` on merchant-initiated cancel.
- [ ] `app/uninstalled` webhook is subscribed AND has a dead-letter queue.
- [ ] Three-email trial-ending sequence is automated (install + T-3 + T-0).
- [ ] Pricing page on the App Store listing matches the in-app billing screen exactly (same tier names, same prices, same cycle).
- [ ] One-click cancel inside the app, no support email required.
- [ ] Annual plans (if offered) display a clickable "non-refundable" disclosure at checkout.
- [ ] Usage caps show a real-time meter + warning at 80% / 90% / 100%.

---

## 5. Performance discipline

### Hard targets

These are the Built for Shopify 2026 thresholds. Miss any of them and you lose BFS status and slide down the App Store ranking algorithm.

- **LCP impact ≤ 200ms**
- **CLS impact ≤ 0.02**
- **INP impact ≤ 50ms**
- **Lighthouse score reduction ≤ 10 points (target ≤ 5)**
- **API p95 < 500ms**
- **API failure rate < 0.1%**
- **Storefront JS bundle ≤ 50KB gzipped per surface**

### What "third-party app scripts" look like in aggregate

The average Shopify store has 15–20 apps with 5–10 injecting frontend scripts. Cumulatively, third-party app scripts can add **1–3MB of JavaScript** — 3 to 10 times the size of the theme itself. Chat widgets are the worst single offenders:

- Tidio: ~350KB on every page
- Zendesk Chat: ~300KB
- Intercom: ~400KB
- Drift: ~380KB
- Hotjar: ~120KB + persistent DOM tracking
- Lucky Orange: ~180KB
- FullStory: ~200KB+

Loaded on every page whether anyone opens the widget or starts a session. Page builders are next — PageFly adds 300–600ms to load time and drops mobile Lighthouse ~35 points vs native Shopify 2.0 sections.

### What never to include

- **No bundled jQuery, React, Vue, or Lodash** in your storefront script. Use platform-native primitives.
- **No render-blocking scripts in `<head>`.** Every script tag gets `defer` or `async`.
- **No always-on widgets.** Chat bubbles, popups, "social proof" toasts — all default OFF. Frequency cap once per visitor per 7 days minimum.
- **No analytics SDK loaded on every page.** Use Web Pixels API — it is sandboxed and off the main thread.
- **No synchronous server calls during checkout.** Use Checkout UI Extensions only.

### Lazy-load patterns

```html
<!-- Right -->
<script src="/widget.js" defer></script>

<!-- Better — load only when the user is likely to interact -->
<script>
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => loadWidget(), { timeout: 3000 });
  } else {
    window.addEventListener('load', () => setTimeout(loadWidget, 2000));
  }

  function loadWidget() {
    const s = document.createElement('script');
    s.src = '/widget.js';
    s.async = true;
    document.head.appendChild(s);
  }
</script>

<!-- Best for chat-like widgets — load nothing until the user clicks the launcher -->
<button id="chat-launcher" aria-label="Open chat">Chat</button>
<script>
  document.getElementById('chat-launcher').addEventListener('click', () => {
    if (window.widgetLoaded) return openWidget();
    const s = document.createElement('script');
    s.src = '/widget-full.js';
    s.onload = () => { window.widgetLoaded = true; openWidget(); };
    document.body.appendChild(s);
  }, { once: false });
</script>
```

### Performance budget in CI

Enforce it. If your PR drops Lighthouse 5 points, the PR is rejected. Use `@shopify/web-pixels-extension` lint, Lighthouse CI on a canonical test theme, and reject builds where the gzipped storefront bundle exceeds 50KB.

> "Made the entire store much slower than it should be." — Searchanise reviewer.

> "Their app loads incredibly slow — takes about 30–40 sec. after clicking on items." — PageFly 1-star.

---

## 6. Support promise

### The merchant trust math

A broken feature is forgivable. A broken feature plus no reply is a 1-star review and a public Reddit post. Support is not a cost center; it is the single most leveraged trust signal you have.

### Hard commitments

- **First-touch reply from a human within 24 hours** on every paid plan. Tag bots as bots. No exceptions for weekends.
- **A named contact** — a real person's name, not "the team." Reviewers consistently call out "the team will email you" as a stalling pattern.
- **In-app contact button** on every primary screen. Not a help-center maze. One click, opens a ticket, captures the shop URL and current screen automatically.
- **Public status page** at a fixed URL, linked from the app dashboard. Use a real status page (Statuspage, Atlassian, Better Stack) — not a blog post.
- **Public changelog** at a fixed URL, also linked from the app dashboard. Every breaking change announced 30 days ahead with a migration path.
- **Tier-1 support agents have refund authority** for amounts under $50. A $9 dispute should not require three handoffs.
- **No "we've escalated to the team" without a name and an ETA.** Merchants screen-shot this phrase and post it as evidence of stalling.
- **Public reply to every 1-star review within 48 hours.** Acknowledge, apologize if appropriate, offer offline contact. Never reply with "you have not been ignored" when the merchant said they were ignored.

> "Bug reports submitted a month ago. No fix. They told me publicly on the App Store that I haven't been ignored. I have." — Willdesk reviewer. The gaslighting reply drove the rating further down.

> "Asked for a refund. They ghosted me. The ticket was deleted from the system." — Jotform AI Chatbot reviewer.

### Negative-review reply template

```
Hi [merchant first name],

Thanks for taking the time to write this — and I'm sorry [App Name] hasn't worked the way you expected.

You're right that [specific thing they said]. We [shipped the fix / are shipping the fix on X date / are investigating now]. I've sent you an email at [email] with the current state — happy to get on a call too.

For anyone reading: if you've hit the same issue, email [founder@app.com] directly and I'll personally make it right.

[Founder name]
```

---

## 7. Scope minimization

### The principle

Request the **least privilege required**. For every scope in `shopify.app.toml`, you must be able to point at a specific line of code that requires it. If you can't, drop it.

### What "over-scoping" costs you

1. Merchants get scared at install. A "simple banner app" asking for `write_customers` is a red flag visible to anyone who reads the install prompt. Conversion drops.
2. Built for Shopify reviewers explicitly flag over-scoping. You lose BFS status.
3. If your app is breached, the blast radius is everything you scoped. The 2020 Shopify HackerOne privilege-escalation report ($50K+ bounty) traced back to overly broad token scopes — endpoint-specific scoping would have prevented unauthorized admin account creation.
4. Shopify Trust & Safety scrutinizes scope justification during app review. Slow reviews mean slow time-to-market.
5. The Consentik plugin breach in 2025 exposed **Shopify Personal Access Tokens that could give attackers full administrative control over a store**, Meta Ads tokens, and live analytics through an unsecured Kafka server for 100+ days. The app had a Built-for-Shopify badge, 4.9 stars, and 4,180 stores at the time of the breach. ([cybernews.com/security/shopify-plugin-consentik-data-leak](https://cybernews.com/security/shopify-plugin-consentik-data-leak/))

### Scope justification doc

Maintain `docs/scopes.md` in your repo. Update it on every release.

```markdown
# Scope justification

## read_products
- Used in: `app/services/product-fetch.ts:42` — displays product titles in the widget config screen.
- Could be reduced to: optional scope, requested only when the merchant enables the widget.

## read_customers
- Used in: `app/services/customer-segment.ts:88` — required for segment-based widget display rules.
- Could be reduced to: optional scope. Currently always-on; should move to optional in v2.3.

## write_products
- Not currently used. Removed in v2.1.
```

### Optional scopes pattern

Use **optional scopes** for features only some merchants need. Request at the moment they enable the feature, not at install.

```graphql
mutation RequestScopes {
  appRequestAccessScopes(scopes: ["read_orders", "read_customers"]) {
    grantedAccessScopes {
      handle
    }
    userErrors {
      field
      message
    }
  }
}
```

### Hard rules

- **No `write_*` scope where `read_*` will work.**
- **No `read_all_orders` unless absolutely required** — for most apps `read_orders` is sufficient (returns orders from the last 60 days).
- **Never store the Shopify access token anywhere reachable from the public internet.** No public Kafka servers (Consentik). No keys in client bundles. Run SAST quarterly.
- **Document scope rationale in your app listing.** "We request `read_customers` because [specific feature]." This builds install-time trust.
- **Re-audit on every major release.** If a scope hasn't been called by any code path in 90 days, drop it.

---

## 8. Locale safety

Translation and locale-handling apps generate a special category of pain because they touch everything: URL structure, hreflang tags, theme markup, customer language preferences, checkout localization. The damage radius is huge and the cleanup is hard.

### Documented locale carnage

- **Langify's "switch back to original language" bug** — customers see the storefront flip back mid-session.
- **Transcy** generates 743 hreflang conflicts on a single store, leaves "markup junk" after deactivation.
- **Translate & Adapt** (Shopify's own app) leaves a language dropdown embedded in the theme after uninstall, with no notification.
- **T Lab** swaps translated product URL handles between products, sending shoppers to wrong product pages.
- **Locales.ai** produces half-translated pages where some sections render in the source language and others in the target.

### Rules

1. **Never write hreflang tags directly into theme files.** Use Shopify's `linkedDomains` and the Markets API.
2. **Never override the merchant's primary locale silently.** If you detect a mismatch (merchant default is `en`, customer browser is `de`), surface a banner in the storefront and let the customer choose — don't force-redirect.
3. **Test the full uninstall path on a multi-locale store.** Watch for: orphaned dropdown widgets, broken hreflang tags, swapped URL handles, stale `Accept-Language` cookies, persistent translation metafields.
4. **Never block the merchant from editing their own translations.** If your AI translates a product title, the merchant must be able to overwrite it. Reviews consistently call this out as the breaking point.
5. **Don't proxy customer requests through your translation server.** Latency adds up; your CDN is slower than Shopify's; merchants notice.
6. **Document the conflict matrix** — which themes you've tested, which other locale apps you coexist with, which checkout configurations break.

### Half-translated page check

Before shipping a translation update, run the storefront through:
- A native-speaker spot check on 5 random pages.
- Hreflang validator (e.g., `hreflang.org`).
- A diff against the source locale: any `<h1>`, `<title>`, `<meta name="description">` in the source language is a P0 bug.

---

## 9. Pre-ship merchant-pain self-audit (40 items)

Run this checklist 48 hours before submission to the App Store or any major release. Every "no" is a potential rejection or post-launch fire.

### Theme + storefront (8)
- [ ] No code writes to `theme.liquid` or other theme files.
- [ ] All storefront UI uses Theme App Extensions (App Blocks or App Embeds).
- [ ] App Embeds are deactivated by default.
- [ ] Storefront JS bundle is < 50KB gzipped per surface.
- [ ] No synchronous scripts in storefront `<head>`.
- [ ] Storefront Lighthouse score impact ≤ 5 points (target ≤ 2).
- [ ] LCP impact ≤ 200ms, CLS impact ≤ 0.02, INP impact ≤ 50ms.
- [ ] Checkout integration uses Checkout UI Extensions — no DOM injection.

### Permissions + security (6)
- [ ] Each requested scope maps to a specific line of code (documented in `docs/scopes.md`).
- [ ] No `write_*` scopes where `read_*` would suffice.
- [ ] No `read_all_orders` unless absolutely required.
- [ ] Optional scopes requested at moment-of-use, not install.
- [ ] OAuth tokens stored encrypted at rest. HMAC verification on all webhooks.
- [ ] No customer PII sent to third parties without DPA + disclosure.

### Billing + trials (8)
- [ ] All billing through Shopify Billing API — no external Stripe / PayPal.
- [ ] Pricing page in listing matches in-app billing screen exactly.
- [ ] Free trial behavior clearly disclosed before card request (if any).
- [ ] Email sent 3 days before trial converts to paid.
- [ ] Usage meter visible in admin with real-time updates + warnings at 80/90/100%.
- [ ] No auto-upgrades to higher plans — auto-pause instead.
- [ ] One-click cancel inside Shopify admin. No "email support" requirement.
- [ ] Cancellation triggers immediate billing stop with proration.

### Uninstall hygiene (5)
- [ ] `app/uninstalled` webhook handler implemented, tested, dead-letter-queue protected.
- [ ] All app-reserved metafields deleted on uninstall.
- [ ] All app metaobjects deleted on uninstall.
- [ ] All storefront code removed on uninstall (extensions auto-clean; ScriptTag cleanup runs if you ever shipped a legacy version).
- [ ] Merchant data exportable before uninstall (GDPR Article 20).

### Reviews + marketing (5)
- [ ] Review prompt fires at most once, after 30 days + active use.
- [ ] Review prompt is dismissible permanently — no nagging.
- [ ] No incentives tied to reviews (zero. none.).
- [ ] No fake reviews purchased, ever.
- [ ] No threats or doxing in responses to negative reviews.

### Support (4)
- [ ] In-app contact button on every primary screen.
- [ ] Support SLA published on the install page and met.
- [ ] Public status page and changelog at fixed URLs, linked from app dashboard.
- [ ] Tier-1 agents have refund authority under $50.

### Storefront UI honesty (4)
- [ ] No fake countdown timers (server-validated end times only).
- [ ] No fake stock numbers ("Only X left" reads real inventory).
- [ ] No fake "X people viewing" — real session data or remove the widget.
- [ ] No deceptive checkbox defaults (e.g., pre-checked subscriptions).

---

## 10. Decision tree — "merchant says X" → "diagnose Y" → "fix Z"

### "I uninstalled your app and was still charged this month."
**Diagnose:** Recurring app charge generated on day 1 of the app's billing cycle. Uninstall stops future cycles but the current invoice already exists.
**Fix:** Issue a credit via `appSubscriptionCancel` with `prorate: true` within 24 hours. Reply publicly to any review thanking them and confirming the credit. Audit your `app/uninstalled` webhook — if it failed, that's why the timing felt arbitrary.

### "Your app slowed down my store."
**Diagnose:** Probably one of: ScriptTag on every page, bundled jQuery/React, render-blocking script in `<head>`, no `defer`/`async`, widget loading above the fold.
**Fix:** Migrate to Theme App Extensions. Lazy-load with `requestIdleCallback`. Run Lighthouse against the merchant's store and post the before/after to them. Promise a performance budget in your next release.

### "There's leftover code from your app in my theme."
**Diagnose:** Either you used ScriptTag historically, or you're using ScriptTag now. App Embed assets disappear on uninstall; ScriptTag entries do not always.
**Fix:** Migrate to App Embeds in your next release. Ship a "clean up theme code" button immediately in the dashboard that scans for and removes any tag with your CDN URL. For the merchant complaining, send a custom Liquid removal script with their shop URL pre-filled.

### "I canceled my trial and still got charged."
**Diagnose:** Either (a) the trial-end email never fired, (b) the cancel button is buried, or (c) the cancel was processed but didn't propagate to the Billing API.
**Fix:** Refund first. Then audit: trial-ending email job, in-app cancel button placement (must be on the main settings screen), Billing API webhook subscription.

### "Your AI bot keeps timing out / I can't reach a human."
**Diagnose:** Support chat without a human-exit path.
**Fix:** Add "Talk to a human" as the always-visible top option in the chat. Route directly to a real agent. Publish your SLA.

### "Your app broke after the Shopify checkout update."
**Diagnose:** You're using a deprecated checkout API or hard-coded REST.
**Fix:** Migrate to Checkout UI Extensions (for checkout) or GraphQL Admin 2026-01 (for everything else). Subscribe to Shopify Dev Changelog. Test in CI against the latest checkout extensibility release.

### "Your app charges fees the merchant didn't expect."
**Diagnose:** Usage-based charges without a real-time meter, or transaction fees buried in fine print.
**Fix:** Surface usage in the admin home screen with a clear meter. Warning emails at 80/90/100%. Disclose transaction fees on the pricing page in the same font size as the base price.

### "My reviews disappeared after I paused the app."
**Diagnose:** Data hostage pattern — pausing the app hides UGC content even though the merchant still owns it.
**Fix:** Pause should never delete or hide data. Provide CSV / JSON export at all times. Show review counts even on free / paused plans.

### "Your popup appears on every page even with frequency caps."
**Diagnose:** Two injection mechanisms (App Embed + ScriptTag fallback), or session storage is not being respected, or the cap is being reset on navigation.
**Fix:** Single injection path. Cap stored in `localStorage` keyed by shop + visitor ID. Respect `prefers-reduced-motion`. X-button hit area minimum 44×44px.

### "Your translation app left a language dropdown in my theme after I uninstalled."
**Diagnose:** Translation app wrote a custom snippet into the theme that the uninstall hook didn't clean.
**Fix:** Migrate to App Embeds (which clean automatically). For affected merchants, ship a one-click theme cleanup. Add a pre-uninstall warning surfacing what code will be removed.

### "Your app shows 100% optimized but nothing changed in my HTML."
**Diagnose:** Booster SEO pattern — writing values to your own database but never pushing them to the front end via metafield / theme.
**Fix:** Stop reporting success that you cannot verify against the storefront HTML. Add a "verify in storefront" check that fetches the live page and asserts the change is present.

---

## 11. 30 verbatim merchant quotes — preserved with URL citations

These are the words real merchants used. Reading them is the cheapest pain-prevention exercise you will ever do.

1. **"Why am I being overcharged on Shopify for subscriptions?"** — [community.shopify.com/t/why-am-i-being-overcharged-on-shopify-for-subscriptions/314115](https://community.shopify.com/t/why-am-i-being-overcharged-on-shopify-for-subscriptions/314115)

2. **"Apps on Shopify used to be reasonable. You could justify $5 to $10 a month for features. If you do even a little business you are going to be at the top tier of an app."** — [community.shopify.com/t/the-price-of-apps-is-completely-out-of-control/419098](https://community.shopify.com/t/the-price-of-apps-is-completely-out-of-control/419098)

3. **"They held my store and subscriptions hostage for weeks before I was able to migrate away from them, uninstall the app, report them to Shopify, and file chargebacks."** — Bold Subscriptions 1-star. [apps.shopify.com/bold-subscriptions/reviews](https://apps.shopify.com/bold-subscriptions/reviews)

4. **"Why am I still billed for an uninstalled app on Shopify?"** — [community.shopify.com/t/why-am-i-still-billed-for-an-uninstalled-app-on-shopify/191216](https://community.shopify.com/t/why-am-i-still-billed-for-an-uninstalled-app-on-shopify/191216)

5. **"Why is a merchant that uninstalled our app seeing charges two months later?"** — developer-side. [community.shopify.dev/t/why-is-a-merchant-that-uninstalled-our-app-seeing-charges-two-months-later/23625](https://community.shopify.dev/t/why-is-a-merchant-that-uninstalled-our-app-seeing-charges-two-months-later/23625)

6. **"I canceled my free trial in time, and still got charged."** — [community.shopify.com/c/shopify-discussions/i-canceled-my-free-trial-in-time-and-still-got-charged/td-p/2282529](https://community.shopify.com/c/shopify-discussions/i-canceled-my-free-trial-in-time-and-still-got-charged/td-p/2282529)

7. **"Tried to cancel subscription after free trial was charged."** — [community.shopify.com/c/shopify-discussions/tried-to-cancel-subscription-after-free-trial-was-charged/td-p/851254](https://community.shopify.com/c/shopify-discussions/tried-to-cancel-subscription-after-free-trial-was-charged/td-p/851254)

8. **"Why am I still being charged for POS after uninstalling? I don't use it and uninstalled the app months ago."** — [community.shopify.com/t/why-am-i-still-being-charged-for-pos-after-uninstalling/286967](https://community.shopify.com/t/why-am-i-still-being-charged-for-pos-after-uninstalling/286967)

9. **"Anyone else getting screwed by Klaviyo's pricing?"** — [community.shopify.com/t/anyone-else-getting-screwed-by-klaviyos-pricing/561275](https://community.shopify.com/t/anyone-else-getting-screwed-by-klaviyos-pricing/561275)

10. **"Left over code from app."** — [community.shopify.com/c/site-speed/left-over-code-from-app/td-p/1581837](https://community.shopify.com/c/site-speed/left-over-code-from-app/td-p/1581837)

11. **"Leftover code from uninstalled app — how do I remove it from my website?"** — [community.shopify.com/t/leftover-code-from-uninstalled-app-how-do-i-remove-it-from-my-website/294871](https://community.shopify.com/t/leftover-code-from-uninstalled-app-how-do-i-remove-it-from-my-website/294871)

12. **"I paused the Loox Application and all my Reviews are gone."** — [community.shopify.com/c/shopify-apps/i-paused-the-loox-application-and-all-my-reviews-are-gone/m-p/2029071](https://community.shopify.com/c/shopify-apps/i-paused-the-loox-application-and-all-my-reviews-are-gone/m-p/2029071)

13. **"Despite settings to display the popup only once per session and to stop showing it once the popup window closed or email address submitted, the popup would still appear after every newly loaded page which is very annoying for customers."** — [community.shopify.com/t/recurring-discount-popup-by-popup-smart-app/412559](https://community.shopify.com/t/recurring-discount-popup-by-popup-smart-app/412559)

14. **"Is Shopify ever going to take fake app store reviews seriously?"** — [community.shopify.com/t/is-shopify-ever-going-to-take-fake-app-store-reviews-seriously/569409](https://community.shopify.com/t/is-shopify-ever-going-to-take-fake-app-store-reviews-seriously/569409)

15. **"Common issues seem to repeat across apps, but they're buried under noise and generic feedback."** — [news.ycombinator.com/item?id=46897012](https://news.ycombinator.com/item?id=46897012)

16. **"How can I reach support when the AI bot keeps timing out?"** — [community.shopify.com/t/how-can-i-reach-support-when-the-ai-bot-keeps-timing-out/413511](https://community.shopify.com/t/how-can-i-reach-support-when-the-ai-bot-keeps-timing-out/413511)

17. **"Each question took 6 hours+ to get a response on their own chat function."** — Gorgias. [apps.shopify.com/helpdesk/reviews](https://apps.shopify.com/helpdesk/reviews)

18. **"After a recent app update requiring reconfiguration, support was unresponsive, the team was pleasant but unwilling to take responsibility, and the user was given confusing instructions while being stuck in a continuous support loop."** — ReConvert 1-star. [apps.shopify.com/reconvert-upsell-cross-sell/reviews?page=2&ratings%5B%5D=1](https://apps.shopify.com/reconvert-upsell-cross-sell/reviews?page=2&ratings%5B%5D=1)

19. **"The app has taken money from our account without authorization, approximately $1600 in unauthorized charges. The app became useless after Shopify's November checkout app update."** — ReConvert 1-star. [apps.shopify.com/reconvert-upsell-cross-sell/reviews](https://apps.shopify.com/reconvert-upsell-cross-sell/reviews)

20. **"Some merchants unable to access and apply Checkout Blocks App functions — checkout blocks has been broken for about 12 hours, with all functions on stores being wiped and the blocks while still in the app being removed from the checkout."** — [community.shopify.dev/t/some-merchants-unable-to-access-and-apply-checkout-blocks-app-functions/27602](https://community.shopify.dev/t/some-merchants-unable-to-access-and-apply-checkout-blocks-app-functions/27602)

21. **"Custom Checkout Apps Not Working with Shop Pay — some custom checkout apps that allow customers to enter VAT numbers and add product cross-sells are no longer available when a customer with a Shop Pay account enters the checkout."** — [community.shopify.dev/t/custom-checkout-apps-not-working-with-shop-pay/11181](https://community.shopify.dev/t/custom-checkout-apps-not-working-with-shop-pay/11181)

22. **"This app isn't compatible with your store."** — [community.shopify.com/t/this-app-isnt-compatible-with-your-store/298151](https://community.shopify.com/t/this-app-isnt-compatible-with-your-store/298151)

23. **"Why is my store speed slowing down and how can I improve it?"** — [community.shopify.com/c/shopify-discussions/why-is-my-store-speed-slowing-down-and-how-can-i-improve-it/m-p/2221261](https://community.shopify.com/c/shopify-discussions/why-is-my-store-speed-slowing-down-and-how-can-i-improve-it/m-p/2221261)

24. **"Too Many Shortcomings Requiring Too Many Apps."** — [community.shopify.com/t/too-many-shortcomings-requiring-too-many-apps/181229/6](https://community.shopify.com/t/too-many-shortcomings-requiring-too-many-apps/181229/6)

25. **"Shopify Personal Access Tokens that could give attackers full administrative control over a store, Facebook/Meta Ads tokens that allowed fraudulent ad campaigns, and real-time site analytics events offering reconnaissance data for targeted attacks."** — Consentik plugin breach (Built-for-Shopify badged, 4.9 stars, ~4,180 stores). [cybernews.com/security/shopify-plugin-consentik-data-leak](https://cybernews.com/security/shopify-plugin-consentik-data-leak/)

26. **"Booster SEO showed everything as 100% optimized when in reality none of the changes were actually being applied to their store — product images had no alt text and meta tags were never pushed to the frontend."** — [apps.shopify.com/booster-apps-seo-optimizer/reviews](https://apps.shopify.com/booster-apps-seo-optimizer/reviews)

27. **"Privy continued charging for nearly six years on an inaccessible second account, with the user only discovering this in 2025. After providing full documentation, Privy refunded only six months of charges out of 70+ months and refused to refund the remainder."** — Privy 1-star. [apps.shopify.com/privy/reviews](https://apps.shopify.com/privy/reviews)

28. **"After uninstalling the Translate & Adapt app, a language selector dropdown remained embedded in the storefront — with no notification that theme elements persist after uninstall."** — Translate & Adapt (Shopify-built).

29. **"You install an app to solve one problem, then another for a different feature, and before you know it, you're paying $200+ per month in app subscriptions, your site loads slowly, and some apps don't work well together."** — [painonsocial.com/blog/shopify-problems-reddit](https://painonsocial.com/blog/shopify-problems-reddit)

30. **"Bug reports submitted a month ago. No fix. They told me publicly on the App Store that I haven't been ignored. I have."** — Willdesk reviewer. The gaslighting reply made the rating worse.

---

## Closing principle

Every anti-pattern in this skill exists because someone, at some point, optimized for a short-term metric (installs, conversion-to-paid, revenue per install, review count) at the cost of merchant trust. The Shopify ecosystem is small enough that reputation compounds — both ways.

Merchants who hate your app will tell other merchants on Reddit, in Slack groups, in agency Discords, on Trustpilot, on the BBB, in App Store reviews that outrank your listing on Google. Merchants who love your app will tell other merchants in exactly the same channels.

You do not get to opt out of the feedback loop. You only get to choose which loop is feeding.

Build the app a thoughtful merchant would forgive when something breaks. That's the bar.
