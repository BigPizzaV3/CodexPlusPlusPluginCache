---
name: top-app-ux-patterns
description: "Use when designing or reviewing the UX of a Shopify app and you want to mirror what the top-grossing apps do (Klaviyo, Gorgias, Judge.me, Loox, Vitals, PageFly). Covers IA, first-30s flow, empty states, setup data collection, the aha moment, pricing presentation, listing page conventions, and the 20 reusable UX patterns common across top apps. Triggers: 'what do top shopify apps do', 'best in class shopify ui', 'klaviyo ux', 'gorgias ux', 'modern shopify app pattern', 'shopify app ia', 'app store screenshot pattern', 'polaris convention'. MUST trigger when designing first-run, dashboard, settings, or pricing screens."
---

# Top App UX Patterns — What the Best-in-Class Shopify Apps Actually Do

A teardown-driven playbook for designing or reviewing Shopify app UX. Built from a live analysis of six top-grossing apps (Klaviyo, Gorgias, Judge.me, Loox, Vitals, PageFly) representing an estimated $70M–$110M of combined Shopify-channel MRR. Use this skill to lift the converged patterns instead of inventing UX from scratch.

---

## 1. When to use

Trigger this skill whenever you are:

- Designing or reviewing a Shopify App Store **listing page** (hero, gallery, description, pricing cards, "Works with")
- Designing the **first-run / install / OAuth → first value** flow
- Designing **empty states** for any in-app screen (dashboard, settings, builder, etc.)
- Designing the **pricing page** or choosing a pricing structure (flat / tiered / slot-based / usage-based)
- Picking the **single addictive metric** for the merchant's dashboard
- Reviewing UX for **install→activate→pay** conversion leaks
- Comparing a competitor's UX against the converged best-practice set
- Auditing copy on the listing or in-app for "outcome vs feature" framing
- Choosing how to handle theme integration (theme code edits vs App Blocks / OS 2.0)
- Deciding what onboarding data to collect at install vs. defer

Do not use this skill for: backend architecture, billing implementation details (use `shopify-app-builder:app-billing`), or scope minimization (use `shopify-app-builder:audit-scopes`). This skill is purely about **what merchants see and feel.**

---

## 2. The six case studies

Each case study compresses the teardown into the patterns worth stealing. Numbers are estimates from the source teardown dated 2026-05-15.

### 2.1 Klaviyo — Email Marketing & SMS

- **Rating / scale:** 4.6 (2,731 reviews). Est. $35M–$50M MRR from Shopify channel.
- **BFS badge:** No (legacy).
- **Pricing entry:** Free to install. Email from $20/mo (251–500 contacts). SMS from $15/mo.
- **Primary job:** Turn anonymous traffic + one-time buyers into a list to re-monetize across email + SMS + WhatsApp.

**Key takeaways:**

1. Lead the tagline with **outcome + AI**, not feature — "AI marketing… to grow faster" beats "Send emails."
2. **Permanent free tier** (250 contacts forever) is the install hook. Reduces friction to near-zero.
3. **Defer credential friction** — DNS records / sender domain asked only at first send, not install.
4. **Bury complexity behind "See all pricing options"** — three clean cards on the listing, full matrix one click away.
5. The aha moment is the **Abandoned Cart attributed revenue** widget within 72 hours of install.

### 2.2 Gorgias — AI Helpdesk & Chat

- **Rating / scale:** 4.3 (635 reviews — lowest 5-star share in this set). Est. $14M–$20M MRR.
- **BFS badge:** No.
- **Pricing entry:** $10/mo Starter (3 agents, 50 tickets) → $900/mo Advanced. Per-ticket overage.
- **Primary job:** Replace a tangle of inboxes (email + chat + social + voice + SMS) and auto-resolve the repetitive 60% with AI.

**Key takeaways:**

1. **"View demo store"** secondary CTA — uniquely powerful for complex / abstract apps. Lets prospects feel it before installing.
2. **Minimal gallery (2 images)** + bet on the demo + description.
3. **Tiered overage that gets cheaper per unit at higher tiers** is a clean upgrade-pressure mechanic.
4. The aha is the **first AI auto-resolved ticket** with a green "saved ~3 min of agent time" banner.
5. The addictive dashboard metric is **deflection rate.**

### 2.3 Judge.me — Product Reviews

- **Rating / scale:** 5.0 (39,203 reviews — largest absolute review count in this set). Est. $4M–$6M MRR.
- **BFS badge:** Yes — also 2025 Build Award winner.
- **Pricing entry:** **Forever Free** (unlimited reviews, widgets, rich snippets). $15/mo "Awesome" unlocks AI + integrations.
- **Primary job:** Get reviews on the store yesterday without Yotpo prices, with star snippets in Google.

**Key takeaways:**

1. **Stack trust badges visibly** — BFS + Build Award + 5.0 + 39k reviews within the first 200 pixels.
2. **Flat $15 pricing** is a structural moat against per-contact / per-impression competitors.
3. **Win the migration market** — one-click import from CSV, AliExpress, Loox, Yotpo, Stamped, Amazon, Etsy.
4. **Auto-place widgets via OS 2.0 theme blocks** — zero theme editing.
5. Auto-send the first review request 7 days after first fulfilled order. Aha = first photo review live on a product page.

### 2.4 Loox — Visual Product Reviews

- **Rating / scale:** 4.9 (7,854 reviews). Est. $8M–$12M MRR.
- **BFS badge:** Yes.
- **Pricing entry:** Free Beginner (100 emails/mo) → Convert $49.99 → Unlimited $299.99. Order-volume gated.
- **Primary job:** Photo + video reviews for visual product categories (apparel, beauty, decor).

**Key takeaways:**

1. **Longest gallery in this set (8+ slides)** — for visual products, more is more.
2. **Psychology lede** opens the description — "Visual reviews are the strongest form of social proof."
3. **Pick-a-widget empty state** — first action is a low-stakes visual choice with live preview.
4. **Order-volume pricing** aligns billing with merchant success.
5. **Outcome-named tiers** — Beginner / Convert / Unlimited. The tier name is part of the pitch.

### 2.5 Vitals — All-in-One CRO Suite

- **Rating / scale:** 4.9 (2,598 reviews — 97% five-star). Est. $4M–$7M MRR.
- **BFS badge:** Yes.
- **Pricing entry:** Flat $29.99/mo. One plan. 7-day free trial.
- **Primary job:** Replace 10+ apps in a CRO stack with a single $30 bundle.

**Key takeaways:**

1. **Bundling is positioning-as-product** — "replace 10 apps for $30" is the entire pitch.
2. **40+ tile grid empty state** — surface every feature visually, let merchant choose, no forced flow.
3. **Lazy setup beats front-loaded questionnaires** when the value surface is exploratory.
4. **One price, one tier, one decision** — eliminates pricing paralysis.
5. **Visible storefront changes within 5 minutes** drive retention (sticky ATC, trust badges, etc.).

### 2.6 PageFly — Landing Page Builder

- **Rating / scale:** 4.9 (5,703 reviews). Est. $6M–$10M MRR.
- **BFS badge:** Yes.
- **Pricing entry:** Free (1 slot) → Builder $24 → Optimize $39 → Accelerate $99 / $990/yr. Slot-gated.
- **Primary job:** Build conversion-ready landing pages without theme limitations, no code.

**Key takeaways:**

1. **"What do you want to build?" picker empty state** — the single best onboarding flow in this teardown.
2. **Slot-based metering** is the cleanest predictable scaling unit for builder-style apps.
3. **Frame the app as additive, not replacement** — "Go beyond themes" defuses fear of rebuilding the store.
4. **Editor screenshot IS the hero shot** — when the product is a UI, show the UI.
5. **24/7 live chat on every tier including Free** — a moat against bootstrapped competitors.

---

## 3. Convergent patterns — what they all do

These are the patterns that appear in 5 of 6 or 6 of 6 listings. Treat as baseline, not differentiation.

### Hero anatomy (every listing follows this six-line stack)

1. App icon + name
2. Built for Shopify badge (if earned) + award ribbon (if earned)
3. Star rating + review count
4. "Free trial / Free plan / Pricing from $X" label
5. Region trust signal ("Based in United States" — all six)
6. Single primary CTA: **Install** (sometimes paired with "View demo store")

### Gallery anatomy

- **4–11 images, always benefit-named.** Every alt text sells one job. Never "Dashboard view." Always "Collect unlimited reviews automatically from email, SMS, QR code."
- Gallery is the pitch deck. Read more often than the description.
- For visual products: 8+ slides. For utility apps: 4–6.

### Description anatomy

- Two-paragraph block, **duplicated** (visible + after "more"). 5 of 6 apps lean into this Shopify quirk as repetition reinforcement.
- 5 bold capability bullets directly under the gallery — each is a **benefit statement**, not a feature.

### "Works with" curation

- **All 6** list complements; **none** list direct competitors. Klaviyo lists Gorgias. Judge.me and Loox never list each other. Curated trust.

### Pricing presentation

- **Tier-banded with anchoring.** Free → entry paid → mid → premium. Middle tier always carries the visual weight.
- **5 of 6 stack Free Plan + Free Trial** — belt-and-suspenders friction removal.
- Annual discount of **17%** is the App Store norm (Gorgias, PageFly).

### Reviews surface

- Star-distribution **histogram** + Shopify Magic's **"What merchants think"** AI summary. Even with 1-star outliers, the central tendency is the first thing the merchant sees.

### BFS badge leverage

- 4 of 6 (Judge.me, Loox, Vitals, PageFly) display BFS adjacent to the title. Functions as a meta-trust signal that overrides skepticism. Apply for it.

### Single primary CTA

- One Install button. Optional "View demo store" secondary. No competing CTAs, no newsletter signup, no "Learn more" button cluttering the hero.

---

## 4. Differentiators that drive install → activate → pay

What separates the top-1% apps from the merely good. These are the asymmetric bets to consider for a new entrant.

1. **Judge.me's flat $15** in a per-contact / per-impression category. **Pricing model is the differentiator.** If competitors meter usage, go flat. If competitors are flat, go usage-based. Pick the opposite axis.

2. **Vitals' bundle thesis** — "replace 10 apps for $30" is positioning-as-product. The differentiator is the meta-decision, not any individual feature.

3. **PageFly's "what do you want to build?"** picker. No competitor cracks the empty state this cleanly.

4. **Loox's gallery-as-pitch-deck** (8+ slides) for visual products. Most competitors ship 3-image galleries and lose the storytelling battle before the merchant clicks Install.

5. **Klaviyo's permanent free tier** vs. Mailchimp / Omnisend's trials. Merchants can stay free until they scale.

6. **Gorgias' "View demo store"** link. Uniquely useful for complex / abstract apps where screenshots fail to convey value.

7. **BFS badge + Build Award stacked** (Judge.me). A trust signal competitors literally cannot copy without earning the same badges. Plan for both.

8. **24/7 live chat on the Free tier** (PageFly, Loox). A bootstrapped competitor can't afford this — it's a structural moat.

9. **One-click migration from named competitors** (Judge.me, Loox). Switching cost approaches zero.

10. **Outcome-named pricing tiers** (Loox: Beginner / Convert / Unlimited). The tier name sells the merchant's destination at the pricing decision moment.

---

## 5. Twenty reusable UX patterns

Tagged with example apps + a Polaris / Shopify implementation hint. Steal liberally.

### Listing-page patterns

**1. Stack three trust signals in the hero.**
Examples: Judge.me, Loox, PageFly.
Polaris hint: This is App Store metadata, not Polaris. Plan the BFS application early, drive 100+ five-star reviews in the first 90 days, set up a Build Award submission once you cross 1k installs.

**2. Lead the tagline with the outcome verb.**
Examples: Judge.me ("Sell more"), Loox ("Convert more shoppers"), PageFly ("Go beyond themes").
Polaris hint: Listing copy field. Start with Sell / Convert / Save / Grow / Replace / Automate / Recover. No feature nouns first.

**3. Every gallery image is a job statement.**
Examples: All 6.
Polaris hint: Write the alt text first, design the screenshot second. The alt text is the slide.

**4. Use 6–9 gallery images, not 2–3.**
Examples: Loox (8+), Vitals (9+), Judge.me (6+).
Polaris hint: Budget for a full pitch-deck-in-screenshots during launch — not a minimal gallery. Gorgias' 2-image listing is the exception, not the model, and they offset it with the demo store.

**5. The editor UI is the hero shot for builder-style apps.**
Examples: PageFly.
Polaris hint: If you use AppProvider, embed a real Polaris UI screenshot, not a marketing illustration.

**6. Add "View demo store" alongside Install.**
Examples: Gorgias, Judge.me, Loox, Vitals.
Polaris hint: Spin up a development store with your app pre-installed, populate sample data, link it from the listing. Use Shopify's free dev store program.

**7. Curate "Works with" to feature complements, not competitors.**
Examples: All 6.
Polaris hint: List 6–10 named integrations weighted toward popular complements (Klaviyo, Judge.me, PageFly, Gorgias, Shop App, Meta).

**8. Open the description with a psychology lede.**
Examples: Loox ("Visual reviews are the strongest form of social proof").
Polaris hint: 1–2 sentences reframing the merchant's problem before listing capabilities. Reframe → then features.

**9. Duplicate the description block.**
Examples: 5 of 6.
Polaris hint: This is a Shopify App Store template quirk — lean in. Visible block sells, expanded block reinforces.

### Pricing patterns

**10. Free plan + free trial stacked.**
Examples: Klaviyo, Judge.me, Loox, PageFly.
Polaris hint: Use `appSubscriptionCreate` with `trialDays`. Pair with a feature-gated Free plan that doesn't require billing.

**11. Flat pricing as positioning moat (or usage-based when competitors are flat).**
Examples: Judge.me $15, Vitals $29.99.
Polaris hint: Recurring `appSubscriptionCreate` with a fixed `price.amount`. Avoid `cappedAmount` unless you're going usage-based.

**12. Slot-based metering for predictable scaling.**
Examples: PageFly (1 / 5 / 20 / unlimited slots).
Polaris hint: Meter by a countable, predictable unit ("slots," "stores," "active campaigns") — not abstract API calls or contacts the merchant cannot count in their head.

**13. Outcome-named tiers.**
Examples: Loox (Beginner / Convert / Unlimited).
Polaris hint: Set `name` on each `appSubscription` plan to a destination noun, not "Pro" / "Plus" / "Enterprise."

**14. Bury full pricing matrix behind "See all pricing options."**
Examples: Klaviyo, Loox.
Polaris hint: Show 3–4 clean tier cards on the listing. Link to a deep matrix page on your marketing site for the long tail.

**15. Annual discount = 17%.**
Examples: Gorgias, PageFly.
Polaris hint: Use the App Store norm. `appSubscriptionCreate` with `interval: ANNUAL` priced at 0.83 × (12 × monthly).

### In-app onboarding patterns

**16. Picker-first empty state.**
Examples: PageFly ("What do you want to build?"), Loox (widget picker), Vitals (40-tile grid).
Polaris hint: Polaris `EmptyState` is wrong here. Build a custom card grid (`Layout` + `Card` + `MediaCard` tiles). Never ship a blank canvas as the first screen.

**17. Auto-place widgets via Online Store 2.0 theme blocks.**
Examples: Judge.me, Loox.
Polaris hint: Use Theme App Extensions (`shopify app generate extension --type=theme_app_extension`). Define App Blocks in `blocks/*.liquid`. Skip Asset API and theme code edits entirely — they are the #1 abandon point.

**18. Defer credential friction.**
Examples: Klaviyo (DNS at first send), PageFly (Pixel at first publish).
Polaris hint: At install ask only for Shopify OAuth scopes. Ask for everything else at the exact JIT moment using a Polaris `Banner` with action, or a `Modal` triggered by the relevant CTA.

**19. One-click migration from named competitors.**
Examples: Judge.me, Loox.
Polaris hint: Build a Settings → Import wizard with named tabs per competitor. CSV upload + API import + screenshot-based fallback. List every competitor by name — it converts.

**20. Pick one addictive dashboard metric and show it daily.**
Examples: Gorgias (deflection rate), Klaviyo (attributed revenue), Loox (photo reviews this week).
Polaris hint: Build a hero `Card` with a single big number, a delta vs. last 7 days, and a sparkline. Wire the same metric into a weekly digest email. Pick ONE — not three.

---

## 6. Listing-page patterns (deep dive)

The same teardown reveals consistent listing-page choices worth codifying separately, because the listing converts strangers before they ever see your in-app UX.

### Above-the-fold checklist

- App icon (1024×1024, recognizable at favicon size — most icons fail this)
- App name (≤30 chars; merchants scan)
- BFS badge (apply early)
- Award ribbon (if applicable)
- Star rating + count
- "Free plan available. Free trial available." label
- Single Install CTA
- Optional "View demo store" secondary

### Gallery sequencing rule

Order the slides as the merchant's purchase journey:
1. Connect / setup ("Connect [App] and Shopify in minutes")
2. Core value moment (the screenshot of the product doing its job)
3. Outcome metric / dashboard
4. Differentiator (AI / migration / mobile / speed)
5. Multi-channel reach (Google / Meta / TikTok if applicable)
6. Support / trust / migration
7. (Optional, visual products) lifestyle / before-after

### Description structure

```
[1-2 sentence psychology lede — reframe the problem]

[Capability paragraph — what it does in plain English]

[5 bold benefit bullets, each starting with a verb]

[Optional CTA repeat: "Get started in minutes"]
```

### "Works with" picks

Weight toward popular complements. Always include: Shop App, Checkout, Customer Accounts, Shopify Flow, the dominant ESP (Klaviyo), the dominant reviews app (Judge.me), the dominant page builder (PageFly), the dominant helpdesk (Gorgias) — wherever applicable. Never list direct competitors.

### Pricing card composition

Each card carries:
- Tier name (outcome-noun)
- Monthly price + annual savings
- Included usage unit (slots / contacts / tickets / orders)
- 3–5 included features (benefit-named, not feature-named)
- Trial length on paid tiers
- Single CTA: "Install" or "Start free trial"

### Reviews region

- Histogram + Magic AI summary appear automatically — do not fight Shopify on this.
- Reply to every 1-star review with a fix and a follow-up CTA. The reply is visible to future merchants and converts.

---

## 7. Decision tree: "I'm building X screen"

Use this lookup to jump straight to the right case study.

**I'm building the listing-page hero** → look at **Judge.me**. Stack BFS + Build Award + 5.0 + review count. Tagline starts with "Sell more."

**I'm building the listing-page gallery for a visual product** → look at **Loox**. 8+ slides, each a benefit statement, screenshot is the proof.

**I'm building the listing-page gallery for a utility / multi-feature app** → look at **Vitals**. 9+ slides, each slide is one sub-feature, closing slide is the kill shot ("Replace 10+ other apps").

**I'm building the listing-page gallery for a builder / UI-heavy app** → look at **PageFly**. Lead with the editor screenshot itself. Don't abstract.

**I'm writing the listing description** → look at **Loox** for the psychology lede, **PageFly** for the additive framing.

**I'm building the pricing page (simple flat)** → look at **Vitals** ($29.99 single tier) or **Judge.me** (flat $15 paid).

**I'm building the pricing page (tiered, predictable units)** → look at **PageFly**'s slot-based 1/5/20/unlimited.

**I'm building the pricing page (usage-based)** → look at **Loox** (orders-included) or **Gorgias** (tickets-included with per-unit overage that gets cheaper at higher tiers).

**I'm building the pricing page (named tiers)** → look at **Loox** (Beginner / Convert / Unlimited).

**I'm designing the install / OAuth flow** → look at **Judge.me**. Ask for the minimum at install (sender email + brand color, both pre-filled). Defer everything else.

**I'm designing the first-run empty state for a builder** → look at **PageFly**. "What do you want to build?" picker → 8 tiles → template gallery filtered by choice.

**I'm designing the first-run empty state for a feature-pickable suite** → look at **Vitals**. 40-tile grid with toggles, recommended starter set, no forced linear flow.

**I'm designing the first-run empty state for a widget-driven app** → look at **Loox**. Choose a widget style → live preview on the storefront → approve.

**I'm designing the onboarding checklist** → look at **Klaviyo** (5-step persistent checklist with green checkmarks) or **Gorgias** ("Get started" widget tracking 5 tasks).

**I'm designing the dashboard hero metric** → look at **Gorgias** (deflection rate), **Klaviyo** (attributed revenue), **Loox** (photo reviews this week). Pick ONE number that grows daily.

**I'm designing the migration / import wizard** → look at **Judge.me**. Named tabs per competitor (CSV, AliExpress, Loox, Yotpo, Stamped, Amazon, Etsy). Make switching cost zero.

**I'm designing theme integration** → look at **Judge.me** / **Loox**. Theme App Extensions + App Blocks. Never edit theme code.

**I'm designing a settings page** → look at **Gorgias**. Sectioned by channel (email, chat, social, voice) with a status indicator per channel.

**I'm designing the "first value" moment** → look at the app whose pattern matches your category:
- Re-monetization → Klaviyo (attributed revenue widget within 72h)
- Support → Gorgias (first AI auto-resolved ticket banner)
- Reviews → Judge.me / Loox (first photo review live on a product page)
- CRO suite → Vitals (3 features enabled, visible storefront changes in 5 minutes)
- Pages → PageFly (publish first page, see live URL within 15 minutes)

---

## 8. Anti-patterns observed in top apps

Even category leaders ship friction. Don't copy these.

**1. Hidden scaling curves on the listing.**
Klaviyo's headline price ($20) hides the steep climb for a 10k-contact merchant (~$150/mo). The listing never reveals this. Result: surprise-bill 1-star reviews.
**Don't do this** — surface a representative scaling example on the listing or in the upgrade modal. An honest curve converts better than the bait-and-switch.

**2. Implausibly low entry-tier limits.**
Gorgias' $10 Starter (3 agents, 50 tickets) is a trojan horse. Loox's Free (100 emails/mo) forces upgrade within weeks.
**Don't do this** for the free tier — Judge.me proves a genuinely useful free tier converts better long-term. Entry paid tiers can have caps, but make them realistic.

**3. Opaque add-on pricing.**
Gorgias' "Automation add-on" is the load-bearing AI feature, sold separately on a sales call, with no pricing on the listing.
**Don't do this** — if the feature is the differentiator, price it on the listing. Sales-call pricing leaks merchants to competitors with self-serve pricing.

**4. Vague enterprise asterisks.**
Vitals' "Additional charges apply as your store generates revenue and impact" — no thresholds disclosed.
**Don't do this** — disclose the threshold ("After $X GMV/month, custom pricing applies").

**5. Beta-labeled headline features.**
PageFly's "AI conversion rate optimization (Beta)" is on two tiers. Beta lowers expectations but undercuts the buying argument.
**Don't do this** — either ship the feature or don't sell it on the pricing page.

**6. Crippled free tiers when a real free tier is on-brand.**
Loox's 100 emails/mo Free is so limited it feels punitive next to Judge.me's genuinely useful Free.
**Don't do this** — if you offer Free, make it good enough to retain. The free tier is your acquisition engine, not your upsell trap.

**7. Two-image galleries.**
Gorgias gets away with it because of the demo store. Most apps cannot.
**Don't do this** — ship 6+ slides.

**8. Skipping the region trust signal.**
Apps based outside the US sometimes fail to display a "Based in [country]" line and lose merchants worried about support hours.
**Don't do this** — always surface your region.

**9. Front-loaded questionnaires before any value.**
Forces a merchant to answer 6 questions before seeing the product. Vitals' lazy / on-demand setup beats this.
**Don't do this** — if you need data for personalization, ask only what's needed for the next 60 seconds of value.

**10. Theme code edits as install step.**
Any app that asks the merchant to paste code into theme.liquid loses 30%+ at that step.
**Don't do this** — Theme App Extensions and App Blocks are non-negotiable for any new app in 2026.

---

## Closing principle

The six apps in this teardown represent $70M–$110M of combined Shopify-channel MRR. They share more than they differ because the App Store has converged on a tight set of patterns. The conservative path is to **adopt every converged pattern as baseline** and **place 1–2 differentiator bets** from section 4. Resist the urge to be different on the things merchants don't care about (hero layout, pricing card structure, BFS badge) and concentrate originality on the empty-state moment and the pricing model — the two surfaces where the leaders are still beatable.
