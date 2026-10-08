---
name: app-pricing-strategy
description: "Use when designing Shopify app pricing, choosing a pricing model (flat tiered / usage-based / freemium / hybrid), setting trial length (7/14/30 days), structuring 3-4 tier plans, sizing capped usage, raising prices on existing customers, or writing pricing copy for the App Store listing. Triggers: 'shopify app pricing', 'app pricing tiers', 'free trial length', 'usage based pricing', 'recurring vs one-time', 'capped pricing', 'pricing strategy', 'monetization', 'how should I price my shopify app', 'shopify app monetization', 'MUST_USE_BILLING', 'raise app prices'."
---

# Shopify App Pricing Strategy

## Frontmatter Triggers
- "How much should I charge for my app?"
- "What's the best pricing model for my Shopify app?"
- "Should I do free, freemium, or paid-only?"
- "How do I price a usage-based app?"
- "What's the right free trial length?"
- "How do competitors price similar apps?"
- "When and how should I raise my prices?"
- "How do I structure my pricing tiers?"

---

## The Four Proven Pricing Models

### 1. Flat Tiered (Most Common)
**When:** 90% of successful Shopify apps use this. Pick it unless you have a reason not to.

**How it works:**
- 3–4 fixed price points (e.g., Starter $9.99, Growth $29.99, Scale $99.99)
- Each tier unlocks fixed feature sets + user/order limits
- Revenue is completely predictable
- Easy to communicate

**Real Shopify examples:**
- **Klaviyo Email Marketing:** Free, $20, $50, $150, $500/mo (tier by contact count)
- **Gorgias Help Desk:** Free, $50, $150, $400, $1000/mo (tier by conversation volume)
- **Printful Print-on-Demand:** Free + rev-share, then flat fees by service tier

**Conversion lift by tier:**
- Starter tier: 40–60% of free trial users convert
- Growth tier: 15–25% of Starter converts to Growth
- Scale tier: 5–10% of Growth converts to Scale

**Shopify revenue share and fees:**
- Eligible standard-rate developers keep 100% of the first $1M in lifetime gross app revenue earned since January 1, 2025.
- Above $1M, Shopify's revenue share is 15% and the developer keeps 85% before other fees and taxes.
- All billing also has a separate 2.9% processing fee, applicable sales tax, and possible regional fees.
- Revenue is aggregated across apps and associated developer accounts. Very large developers have separate eligibility rules.

**Pro tip:** Design tiers so the "sweet spot" (Growth/Scale tier) is your profit engine. Starter should feel limited but functional. Scale should feel unreachable to most but desirable.

---

### 2. Usage-Based (For Data/Computation/API Heavy)
**When:** Your cost to serve grows with merchant activity (emails sent, API calls, storage, image uploads)

**How it works:**
- Base fee ($0–$50/mo) + overage charges (e.g., $0.01 per email sent)
- Usage counted: emails sent, API calls, MB stored, images processed, orders synced
- Revenue scales with merchant success
- Harder to forecast for merchants but fair

**Real Shopify examples:**
- **ReConvert Upsell:** Base $30/mo + $0.10 per order after 1,000/month
- **Shopify Email:** Free for Shopify merchants, then usage-based
- **Zapier:** Free tier (100 tasks/mo) + $29–$450 based on task volume

**Conversion data:**
- Usage-based apps see 25–35% free-to-paid conversion (higher because users feel they "only pay for what they use")
- But 40% higher churn because cost visibility is higher

**When NOT to use:** If your cost structure is fixed (e.g., you pay Shopify $500/mo for a data feed), don't pass overage costs to users—use flat tiers instead.

---

### 3. Freemium with Hard Cap (Most Common for Low-Price Apps)
**When:** You want to capture market share and convert via upsell (not friction at signup)

**How it works:**
- Free tier with strict limits (e.g., 100 emails/month, 1 user, basic features)
- Hard stop: users CANNOT use beyond the limit without upgrading
- Paid tiers unlock limits + features
- Psychology: users see the wall, then upgrade to remove friction

**Real Shopify examples:**
- **Mailchimp:** Free (500 contacts, email only) → Paid (unlimited, automation, SMS)
- **Inventory Planner:** Free (single store, limited SKUs) → Paid (multi-store, full features)
- **Oberlo Dropshipping:** Free (limited products) → Paid ($30+, unlimited)

**Conversion psychology:**
- 7-day free (no payment card required): 2–5% free-to-paid conversion
- 14-day free (payment card required): 5–10% conversion
- 30-day free (payment card required): 8–15% conversion
- Hard cap effect: When users hit the limit, 25–40% upgrade immediately

**Freemium math (critical):**
- Industry average: 1–3% of free users convert to paid
- To break even: You need 3–8% conversion (depends on CAC and LTV)
- Example: 10,000 free users × 5% = 500 paying customers needed to break even

---

### 4. Hybrid (Flat Base + Usage Overage)
**When:** You have baseline features (worth $50) and overages (user adds value)

**How it works:**
- Tiered base fee ($9.99, $49.99, $99.99) + additional usage charges
- Example: $49.99/mo includes 10,000 emails; additional emails $0.005 each
- Merchants pay for what they use, with a minimum floor
- Best of both worlds: predictability + scaling

**Real Shopify examples:**
- **Shopify Payments:** Fixed transaction fee % + flat monthly minimum
- **Subbly SMS:** $50 base + $0.005 per SMS after monthly allotment
- **Okendo Reviews:** Base $50 + per-review fees ($0.02–$0.10)

**When to use:** Your Starter tier hits 30% of users, but half exceed the limits within 3 months. Add overage pricing so they don't churn—they upgrade or pay more.

---

## Pricing Sweet Spots & Industry Benchmarks

| Price Point | Best For | Conversion Lift | Monthly Volume | Use Case |
|---|---|---|---|---|
| $9.99 | Starter/Freemium upgrade | +40–60% from free | 30–100 apps/tier | Lightweight tools, niche automation |
| $19.99 | SMB/solopreneur | +50% from $9.99 | 50–150 apps/tier | Email, basic automation, integrations |
| $29.99 | Growth/mid-market | +25–35% from $19.99 | 100–300 apps/tier | Heavy hitters (inventory, analytics) |
| $49.99 | Growth+ | +15–25% from $29.99 | 200–400 apps/tier | Agency tools, multi-user |
| $99.99 | Scale/enterprise-lite | +8–15% from $49.99 | 100–200 apps/tier | Data-heavy, API-driven, custom integration |
| $149.99+ | Enterprise | +3–8% from $99.99 | 50–100 apps/tier | Custom features, dedicated support |

**Key insight:** Shopify stores follow a power law. 70% of merchants are solopreneurs/SMBs (target $9.99–$29.99). 20% are growing brands ($29.99–$99.99). 10% are large (negotiate custom pricing).

---

## Free Trial Length: Psychology & Conversion Data

### 7-Day Free Trial
**Conversion rate:** 8–12% of free users convert to paid
**Psychology:** "Short window, decide fast" → urgency without overwhelming
**When to use:** Simple tools (discount tools, basic automation). Merchants see value fast or not at all.
**Risk:** High churn in first 30 days post-conversion

### 14-Day Free Trial (Shopify's default)
**Conversion rate:** 12–18% of free users convert
**Psychology:** "Just right" window to set up, test, see ROI
**When to use:** Most apps. Default for good reason.
**Data:** Shopify's top 100 apps average 13-day trial

### 30-Day Free Trial
**Conversion rate:** 15–25% of free users convert
**Psychology:** "I have time to explore" → deeper feature discovery → higher intent to keep
**When to use:** Complex tools (inventory management, analytics, integrations). Merchants need 2–3 weeks to see clear ROI.
**Risk:** Higher refund requests if they cancel mid-trial month; plan for churn messaging

### No Time Limit (Freemium)
**Conversion rate:** 1–5% (much lower than timed trials)
**Psychology:** "No deadline" → procrastination → lower conversion
**When to use:** Only if you have hard limits (storage, features). Forces conversion by friction, not urgency.

**Pro tip:** Pair your trial length with onboarding emails.
- Day 1: "Welcome, here's your setup checklist" (3 quick wins)
- Day 5: "You saved 2 hours! Here's what's next"
- Day 10 (14-day trial): "Trial ends in 4 days. Convert to keep your setup"
- Day 7 (7-day trial): "Trial ends tomorrow. Quick link to upgrade"

---

## Tiered Tier Design Principles

### The 3–4 Tier Sweet Spot
- **Why 3 tiers:** Good–Better–Best. Simple to compare. Avoids decision paralysis.
- **Why 4 tiers:** Add a "Pro" or "Enterprise" tier if your user base spans solopreneurs + agencies.
- **Why NOT 5+:** Decision paralysis; comparison gets hard; support burden increases.

**Example (Email Marketing):**
```
FREE       → Test drive (100 contacts, 1 automation)
STARTER    → Single store (5,000 contacts, 10 automations) — $9.99
GROWTH     → Scale up (50,000 contacts, unlimited automations) — $29.99
SCALE      → Multi-store or API (unlimited, custom integrations) — $99.99
```

### Anchor Tier Strategy
The middle tier is your profit engine. Anchor it at "sweet spot" price.
- **Starter** (bottom): Feels limited but functional. Converts 40–60% of free trial users.
- **Growth** (middle, the ANCHOR): 60–70% of paying customers land here. Highest LTV.
- **Scale** (top): Only 10–15% of customers, but each pays 3–5× Starter.

**Price gap math:**
- Free → Starter: 2–3× price jump (e.g., Free → $9.99)
- Starter → Growth: 2–3× jump (e.g., $9.99 → $29.99)
- Growth → Scale: 2–4× jump (e.g., $29.99 → $99.99)

If gaps are smaller (e.g., $9.99, $14.99, $19.99), customers compare too hard and upgrade less.

### The Decoy Tier (Advanced)
Add a 4th tier priced between Growth and Scale to make Scale look cheaper.
```
GROWTH     → $29.99/mo (50 emails/mo)
PRO        → $79.99/mo (500 emails/mo) ← DECOY: Rarely chosen
SCALE      → $99.99/mo (unlimited) ← Looks "close" in price to Pro, but unlimited
```

Result: More customers choose Scale over Growth because the jump from Growth ($29.99) to Scale ($99.99) feels smaller when Pro ($79.99) is visible.

### Feature Differentiation (Not Just Limits)
Limits alone create friction. Differentiate by feature too:
```
STARTER    → Dashboard, bulk email, basic reports
GROWTH     → ^ + Automation, SMS, advanced segmentation
SCALE      → ^ + API, webhooks, custom integration, priority support
```

Users at Scale feel they get real *capabilities*, not just higher numbers.

---

## Billing Models: Per-Store, Per-User, Per-Order, Per-Item

### Per-Store (Most Common)
**How:** One price per merchant, regardless of how they use it
**When:** 95% of Shopify apps. Default unless you have usage variance
**Example:** $29.99/month for access on one store
**Pros:** Simple billing, predictable, no disputes
**Cons:** Agencies with 50 stores pay 50× as much (negotiate wholesale)

### Per-User (SaaS-style)
**How:** Price per team member who logs in
**When:** Collaboration tools (Slack-style), team workflow apps
**Example:** $29.99 base + $9.99 per additional user
**Pros:** Scales with team; users feel usage is tied to value
**Cons:** Confusing for Shopify; requires user invite tracking
**Shopify support:** Manual setup; not native in app billing API

### Per-Order
**How:** Charge per transaction processed
**When:** Conversion apps (upsell, bundles), payment processors
**Example:** $0.10 per order after 1,000/month
**Pros:** Perfectly aligned with merchant ROI
**Cons:** Merchants feel nickeled-and-dimed; requires trust
**Shopify support:** Native in billing API (recurring + one-time charges)

### Per-Item
**How:** Charge per product, SKU, or entity
**When:** Catalog management, listing syncing, inventory
**Example:** $0.05 per product per month (300 products = $15/mo)
**Pros:** Scales with business size
**Cons:** Very confusing; support nightmare (what's a "product"?)
**Shopify support:** Possible but clunky; not recommended

**Recommendation:** Start with per-store. It's simple, Shopify understands it, and you can iterate later.

---

## Freemium & Usage-Based Math: Breaking Even

### The Funnel
```
1,000 free signups
  ↓ (5% convert in first 7 days)
50 paying customers
  ↓ (avg: $30/mo)
$1,500/month gross revenue
  ↓ (subtract the currently applicable revenue share, processing fees, taxes, refunds, and cost to serve)
Net payout and contribution margin
```

### Break-Even Calculation
**Assume:**
- CAC (cost to acquire a free trial user): $2 per signup
- Free trial conversion: 5%
- Avg. paying customer lifetime: 10 months
- Avg. monthly price per customer: $30

**Math:**
- LTV = $30 × 10 months × (1 − churn) = $300
- CAC per paying customer = $2 ÷ 0.05 = $40
- LTV:CAC ratio = 300:40 = 7.5:1 ✓ (healthy)

If your LTV:CAC is below 3:1, you're not sustainable.

### Freemium Conversion Targets
Industry baseline: **1–3% free-to-paid conversion**
To break even on freemium: **Need 3–8% conversion (depending on support costs)**

If you get 2% conversion, you're subsidizing free users with paid users. Raise prices or add hard limits.

---

## Price Ladder: The Upsell Path

Design your tiers so customers naturally upgrade.

### Email Marketing Example
```
Month 1: User signs up for FREE tier
         (100 contacts, 1 automation, basic reports)

Month 2: User has grown to 500 contacts
         → Free tier HITS LIMIT
         → Email: "You've grown! Upgrade to keep growing"
         → Upgrade path: Click → Pay → More limits unlocked

Month 4: User runs first major campaign, sees $5K revenue lift
         → Email: "You've sent 15,000 emails this month. Scale faster with advanced segmentation"
         → Upgrade path: STARTER ($9.99) → GROWTH ($29.99)

Month 8: User wants API access for custom integration
         → In-app prompt: "Unlock API + webhooks with Scale tier"
         → Upgrade path: GROWTH → SCALE ($99.99)
```

**Key principle:** Upgrade moments happen when:
1. User hits a limit (pain point)
2. User sees ROI (willingness to pay)
3. User wants a feature only in higher tier (clear next step)

**Don't wait for annual renewal to upgrade. Make upsells available in-app, any time.**

---

## Currency & International Pricing

### USD Baseline
Design all pricing in USD first. It's the Shopify standard.

### Multi-Currency Strategy
If you support EUR, GBP, CAD, AUD, etc.:

**Option 1: Fixed exchange (Manual)**
- $9.99 USD = €9.99 EUR (don't do direct 1:1; lose money on spreads)
- $9.99 USD = €8.99 EUR (apply 10% buffer for payment processor fees)
- Update quarterly

**Option 2: Automatic (Stripe/Shopify billing)**
- Stripe's multi-currency handles real-time conversion
- Shopify's billing API does too
- Cost: 1–2% markup per Stripe

**Price by region (if high volume):**
- USD: $9.99, $29.99, $99.99
- EUR: €8.99, €26.99, €89.99 (roughly 10% lower to account for VAT)
- GBP: £7.99, £24.99, £79.99
- AUD: $14.99, $44.99, $149.99

**Tax considerations:**
- EU: You're responsible for VAT (if revenue > €50K/year). Shopify/Stripe can handle this.
- USA: Only if you have nexus in that state (Shopify handles on its platform)
- Rest of world: Varies; use Shopify's tax app

---

## Revenue Share & Payouts

For developers eligible for Shopify's standard rates:

- First $1M in qualifying lifetime gross app revenue earned since January 1, 2025: 0% revenue share
- Above $1M: 15% revenue share
- Separate charges: 2.9% processing fee, applicable sales tax, and possible regional regulatory fees
- Aggregation: cumulative revenue across all apps and associated developer accounts

Verify the current policy before using these figures in a forecast. Large-developer eligibility rules can remove the $1M exemption.

### Payment Schedule
- Payouts: Monthly, 7 days after end of month
- Method: ACH (USA), wire (international)
- Minimum payout: $1 (but Shopify holds until $100 if desired)

### Example Year 1 Projection
```
Jan: $500 revenue → $425 payout
Feb: $1,200 revenue → $1,020 payout
...
Dec: $8,000 revenue → $6,800 payout
TOTAL Year 1: $45,000 gross revenue → calculate payout from the developer's actual revenue-share tier, processing fees, taxes, refunds, and regional fees
```

---

## When & How to Raise Prices

### Strategy 1: Grandfathering (Best for retention)
"Existing customers keep current price forever; new customers pay new price"

**When to use:** You want to reward early adopters and build loyalty
**Retention impact:** 90%+ of grandfathered customers stay
**Implementation:** Tag customers by signup date; lock their price in code

**Example:**
```
March 2025: Launch app at $29.99 (Growth tier)
June 2025: Raise to $39.99 (increase value first: add features)
       New customers: $39.99
       Customers before June: Keep $29.99 forever
```

**Pro tip:** Grandfather for year 1. After year 1, you can force upgrades (see Strategy 3).

### Strategy 2: Announcement + Opt-Out (Moderate retention risk)
"Announce 30–60 days before price increase; customers can cancel to avoid it"

**When to use:** You're confident in value; expect 5–15% churn
**Message:** "We've added X new features. To sustain development, we're raising prices."

**Example email:**
```
Subject: [App Name] Price Increase on August 1

Hi [Customer],

Over 6 months, we've added API access, webhooks, and multi-store support.
To continue building, we're raising prices on August 1:

Your current plan: $29.99/mo
Your new price: $39.99/mo

You have until July 31 to cancel if you prefer. No judgment.

New features coming next month: Custom integrations, priority support.
```

**Expected churn:** 5–15% (best case: 10%)
**Expected revenue gain:** 70–80% of customer base × price increase

### Strategy 3: Force Increase (Nuclear option)
"Customers must upgrade or downgrade; old price tier no longer exists"

**When to use:** Only after 2+ years of grandfathering, or if you're pivoting pricing model entirely
**Retention impact:** 20–40% churn (expect it)
**When it's acceptable:** You've already signaled the change; loyalty has been tested

**Example:**
```
February 2027: Announce in-app banner
      "Pricing changes March 1. Current grandfathered price expires Feb 28."

March 1: Old price tier disappears
      Customers choose: upgrade to new tier or cancel
      ~30% keep paying (slightly higher); ~10% downgrade; ~10% cancel
```

---

## Pricing Copy: What to Say (And What NOT to Say)

### Pricing Page Formula
```
[HEADLINE]
"Simple, transparent pricing"
(not: "Enterprise-grade pricing for enterprise-grade businesses" — vague)

[SUBHEADING]
"Pick the plan that fits your growth. Upgrade anytime."
(not: "Our pricing is industry-leading" — prove it)

[TIER COMPARISON TABLE]
Columns: Feature | Starter | Growth | Scale
Rows: [5–8 key features]

[CTA Button]
"Start free trial" (for free trials)
"Upgrade now" (for paid-only)
NOT: "Buy now" (too transactional; "Upgrade" feels forward)

[FAQ Section]
Q: Can I change plans anytime?
A: Yes. Upgrade or downgrade instantly. Proration happens automatically.

Q: Do you offer annual discounts?
A: [Answer honestly. If no, say "We price monthly for flexibility."]

Q: What if I outgrow the highest tier?
A: Email us. We offer custom pricing for high-volume users.
```

### Top Pricing Copy Wins
- **"What you get vs. what you pay"** → feature clarity wins conversions
- **"Upgrade anytime"** → removes commitment anxiety
- **"30-day money-back guarantee"** → if true, state it (reverses risk)
- **"No credit card required"** → trust signal (if true)
- **"Join 5,000+ stores"** → social proof
- **"Cancel anytime, no questions"** → fear reduction

### What NOT to Say
- **"Enterprise pricing available"** (vague; redirects to email form; kills conversions)
- **"Contact us for a demo"** (friction; for B2B, not B2C SaaS)
- **"Pay annually, save 20%"** (only if you actually offer it; confuses free trial users)
- **"Advanced features available at higher tiers"** (too vague; show which ones)
- **"Scalable pricing"** (everyone says this; prove it with examples)

### CTA Button Copy
- ✓ "Start free trial"
- ✓ "Unlock [benefit]"
- ✓ "Upgrade to [tier name]"
- ✗ "Buy"
- ✗ "Purchase plan"
- ✗ "Subscribe now" (old-school SaaS language)

---

## Pricing Decision Tree: By App Category

### Analytics Apps (Insights, reporting, dashboards)
→ **Model:** Flat tiered or usage-based (depends on API heavy-ness)
→ **Sweet spot:** $19.99 (basic), $49.99 (advanced), $99.99+ (custom)
→ **Trial length:** 14 days (needs time to see data patterns)
→ **Tier differentiator:** Report types, data retention, API access, real-time data

**Example:** Littledata (Google Analytics for Shopify)
- Free: Basic events, 30-day data
- Growth: Custom events, 1-year retention, integrations
- Scale: API, webhooks, dedicated support

### Automation Apps (Email, SMS, tasks, workflows)
→ **Model:** Flat tiered (simple) or hybrid (usage overage)
→ **Sweet spot:** $9.99 (basic), $29.99 (growth), $99.99 (scale)
→ **Trial length:** 7–14 days (quick ROI visible)
→ **Tier differentiator:** Automation count, contact limits, integrations, support

**Example:** Zapier for Shopify
- Free: 100 tasks/month, basic automations
- Growth: 5,000 tasks/month, advanced logic
- Scale: Unlimited, custom code, API

### Email/SMS Marketing
→ **Model:** Freemium with hard cap (converts better)
→ **Sweet spot:** Free, $9.99, $29.99, $99.99
→ **Trial length:** 14 days
→ **Tier differentiator:** Contact limit, SMS yes/no, automation, segmentation

**Example:** Klaviyo (template)
- Free: 500 contacts, email only, basic reports
- $20: 5K contacts, SMS, some automation
- $50: 25K contacts, unlimited automation
- $150+: Dedicated success, custom integrations

### Inventory & Fulfillment
→ **Model:** Flat tiered (support-heavy; usage-based leads to disputes)
→ **Sweet spot:** $29.99, $49.99, $99.99
→ **Trial length:** 14–30 days (complex, needs learning)
→ **Tier differentiator:** Warehouse count, SKU limit, integration count, fulfillment features

**Example:** Shippo
- Starter: Single warehouse, 1,000 SKUs
- Growth: Multi-warehouse, unlimited SKUs, integrations
- Scale: Dedicated account manager, API

### Design Tools (Mockups, banners, design automation)
→ **Model:** Freemium with hard cap (design = creative, low friction)
→ **Sweet spot:** Free, $9.99, $29.99, $99.99
→ **Trial length:** 7–14 days
→ **Tier differentiator:** Template access, design tool advanced features, watermark removal, exports

**Example:** Canva for Shopify
- Free: Basic templates, watermark
- Pro: No watermark, brand kit, advanced features

### Integrations & Data Syncing
→ **Model:** Hybrid (fixed base + usage overage)
→ **Sweet spot:** $49.99 base + overages
→ **Trial length:** 14 days (need to sync data)
→ **Tier differentiator:** Sync frequency, record limit, data warehouse access, API

**Example:** Zapier sync
- Base: $49.99 + $0.10 per record synced after 10K/month

### Compliance & Legal (Taxes, privacy, returns)
→ **Model:** Flat tiered (support burden is high; don't make it worse with usage)
→ **Sweet spot:** $49.99, $99.99, $199.99+ (people pay for peace of mind)
→ **Trial length:** 14–30 days (need to test with real data)
→ **Tier differentiator:** Feature access, compliance levels, support tier

**Example:** TaxJar
- Basic: Sales tax calculation
- Plus: Tax filing, compliance reporting
- Enterprise: Custom integrations, dedicated support

### Marketplace/Dropshipping
→ **Model:** Flat tiered + usage overage (scales with store growth)
→ **Sweet spot:** Free/freemium, $19.99, $49.99, $99.99+
→ **Trial length:** 7–14 days (quick wins visible)
→ **Tier differentiator:** Product import limit, sync frequency, features

**Example:** Oberlo
- Free: Limited imports, basic features
- Starter: Unlimited imports, basic integrations
- Growth: Advanced features, priority support

---

## Pre-Launch Pricing Checklist

- [ ] **Pricing model chosen:** Flat tiered / Usage-based / Freemium / Hybrid (circle one)
- [ ] **Tier count decided:** 3 or 4 tiers (not 2, not 5+)
- [ ] **Price points set:** Validated against competitor set (3+ similar apps benchmarked)
- [ ] **Feature differentiation clear:** Not just numbers; each tier has unique features
- [ ] **Free trial length chosen:** 7 / 14 / 30 days (with justification)
- [ ] **Billing model confirmed:** Per-store / Per-user / Per-order / Per-item (circle one)
- [ ] **Copy written:** Pricing page, FAQ, tier descriptions, CTA tested
- [ ] **Payment method tested:** Shopify billing API integration working, test payment processed
- [ ] **Churn projections done:** Expected churn rate calculated for year 1
- [ ] **CAC/LTV calculated:** Life-time value > 3× CAC (break-even math confirmed)
- [ ] **Refund policy drafted:** Clear 30-day money-back guarantee (if offered)
- [ ] **Objection responses written:** "Can I downgrade?", "When do I get charged?", "Can I cancel?", etc.
- [ ] **Upgrade path designed:** In-app upsell moments mapped out
- [ ] **A/B test plan drafted:** Which price will you test first? (e.g., $19.99 vs. $29.99)
- [ ] **Currency handling confirmed:** USD only, or multi-currency? (Stripe set up)
- [ ] **Tax handling clarified:** VAT, sales tax (if needed), Shopify's role confirmed
- [ ] **Support email template ready:** Refund requests, trial extension, upgrade questions
- [ ] **Pricing page analytics enabled:** Track views, clicks-to-upgrade, abandonment

---

## Tools & Resources

| Tool | Use | Cost |
|---|---|---|
| **Shopify Billing API** | Recurring charge integration, plan management | Native (included) |
| **Stripe** | Payment processing, multi-currency, invoicing | 2.9% + $0.30 per transaction |
| **ProfitWell** | Churn analysis, MRR tracking, competitor benchmarking | Free/Paid |
| **Paddle** | Alternative payment processor (handles taxes, global) | 8% + revenue share alternative |
| **Pricetag.io** | Pricing page builder (templates) | $99–$199/mo |
| **Competera** | Price intelligence, competitor tracking | Custom |
| **SurveyMonkey** | WTP (Willingness To Pay) surveys | $25–$100/mo |
| **Notion** | Pricing doc & decision tracker (template) | Free |

**Most important:** Shopify Billing API + Stripe. That's all you need to start.

---

## Output Format: Pricing Strategy

When asked to create a pricing strategy for an app, return:

1. **Pricing Model** (1–2 sentences)
   - Which of the 4 models? Why?

2. **Tier Structure** (table)
   - Column: Feature | Starter | Growth | Scale
   - Row 1–5: Key features, limits, includes
   - Row 6: Monthly price

3. **Free Trial Details**
   - Length (days)
   - Payment card required? (Yes/No)
   - Why this length?

4. **Pricing Page Copy** (headline + 2–3 bullets)
   - Main headline
   - Tier descriptions
   - Key CTA

5. **First-Year Revenue Projection** (table)
   - Column: Month | Free Signups | Conversion Rate | Paying Customers | Revenue (before Shopify cut)

6. **Objection Responses** (3–5 Q&A pairs)
   - "Can I change plans anytime?"
   - "What if I outgrow my tier?"
   - "Do you offer annual discounts?"
   - [2 more specific to the app]

---

## Fill-in-the-Blank Pricing Strategy Template

### APP OVERVIEW
**App name:** [Your app name]
**Category:** [Analytics / Automation / Email / Inventory / Design / Integration / Compliance / Marketplace]
**Target merchant type:** [Solopreneur / SMB / Growth-stage / Enterprise]
**Unique value prop:** [What problem does it solve in 1 sentence?]

### PRICING MODEL
**Model chosen:** [Flat tiered / Usage-based / Freemium / Hybrid]
**Rationale:** [Why this model? 1–2 sentences]

### TIER STRUCTURE
| Feature | Starter | Growth | Scale |
|---|---|---|---|
| [Feature 1 name] | [Starter limit] | [Growth limit] | [Scale limit] |
| [Feature 2 name] | [Starter limit] | [Growth limit] | [Scale limit] |
| [Feature 3 name] | [Starter limit] | [Growth limit] | [Scale limit] |
| [Feature 4 name] | [Starter limit] | [Growth limit] | [Scale limit] |
| [Feature 5 name] | [Starter limit] | [Growth limit] | [Scale limit] |
| **Monthly Price** | **$[XX.99]** | **$[XX.99]** | **$[XX.99]** |

### FREE TRIAL
**Trial length:** [7 / 14 / 30] days
**Payment card required?** [Yes / No]
**Rationale:** [Why this length for your merchant type? 2–3 sentences]

### PRICING PAGE COPY
**Headline:** [Main headline, 5–10 words]
**Subheading:** [Supporting text, 1 sentence]

**Starter tier:** [1 sentence benefit]
**Growth tier:** [1 sentence benefit, highlight why most choose this]
**Scale tier:** [1 sentence benefit, who chooses this?]

**CTA button:** [Button text]

### FIRST-YEAR FINANCIAL PROJECTION

| Month | Free Signups | Trial-to-Paid Conversion | Paying Customers | Avg. Price | Gross Revenue | Estimated Net Payout |
|---|---|---|---|---|---|---|
| Jan | [#] | [%] | [#] | $[XX] | $[XXX] | $[XXX] |
| Feb | [#] | [%] | [#] | $[XX] | $[XXX] | $[XXX] |
| Mar | [#] | [%] | [#] | $[XX] | $[XXX] | $[XXX] |
| Apr | [#] | [%] | [#] | $[XX] | $[XXX] | $[XXX] |
| May | [#] | [%] | [#] | $[XX] | $[XXX] | $[XXX] |
| Jun | [#] | [%] | [#] | $[XX] | $[XXX] | $[XXX] |
| Jul | [#] | [%] | [#] | $[XX] | $[XXX] | $[XXX] |
| Aug | [#] | [%] | [#] | $[XX] | $[XXX] | $[XXX] |
| Sep | [#] | [%] | [#] | $[XX] | $[XXX] | $[XXX] |
| Oct | [#] | [%] | [#] | $[XX] | $[XXX] | $[XXX] |
| Nov | [#] | [%] | [#] | $[XX] | $[XXX] | $[XXX] |
| Dec | [#] | [%] | [#] | $[XX] | $[XXX] | $[XXX] |
| **TOTAL YEAR 1** | | | | | **$[XXXX]** | **$[XXXX]** |

For every net-payout cell, state the assumed revenue-share tier and subtract processing fees, taxes, refunds, regional fees, and cost to serve separately.

### OBJECTION RESPONSES

**Q: Can I change plans anytime?**
A: [Your answer. Be generous; "Yes, anytime with no penalty" wins trust.]

**Q: What if I outgrow the highest tier?**
A: [Email support? Custom pricing? API only?]

**Q: Do you offer annual discounts?**
A: [Honest answer. If yes: "[X]% off annual". If no: "We price monthly for flexibility."]

**Q: [App-specific objection 1]**
A: [Your answer]

**Q: [App-specific objection 2]**
A: [Your answer]

---

## Example: PrintFlow (Dropshipping Assistant App)

### APP OVERVIEW
**App name:** PrintFlow
**Category:** Marketplace / Dropshipping
**Target merchant type:** New dropshippers (0–6 months), growth-stage stores
**Unique value prop:** Automatic product syncing + fulfillment automation for print-on-demand suppliers (Printful, Gooten, Merch by Amazon)

### PRICING MODEL
**Model chosen:** Freemium with hard cap + premium tiers
**Rationale:** Dropshippers are price-sensitive; free tier with hard limits captures market share. Premium tiers unlock automation (the core value). This mirrors Oberlo's proven success.

### TIER STRUCTURE
| Feature | Free | Starter | Growth | Scale |
|---|---|---|---|---|
| Synced products | 50 | 500 | 5,000 | Unlimited |
| Suppliers supported | 1 | 3 | Unlimited | Unlimited |
| Auto-sync frequency | Manual | Daily | Real-time | Real-time |
| Bulk operations | No | Yes (100) | Yes (1,000) | Unlimited |
| API access | No | No | No | Yes |
| Priority support | No | No | Yes | Yes |
| **Monthly Price** | **Free** | **$9.99** | **$29.99** | **$99.99** |

### FREE TRIAL
**Trial length:** 14 days (paid tiers start with $0.99 trial charge to filter serious users)
**Payment card required?** Yes
**Rationale:** Dropshipping requires quick action; 14 days is enough to sync first supplier, import 100+ products, and see the time savings. $0.99 barrier filters out tire-kickers; trial converts 12–18% in this category.

### PRICING PAGE COPY
**Headline:** "Sell print-on-demand products without lifting a finger"
**Subheading:** "Sync products, manage orders, automate fulfillment in minutes. No coding."

**Free tier:** Dip your toes in with 50 products from one supplier. Perfect for testing.
**Starter tier:** Sync 500 products from 3 suppliers and unlock daily auto-sync. Ready to scale.
**Growth tier:** Real-time syncing, bulk operations, and dedicated support for stores doing $10K–$100K/month.
**Scale tier:** API access for agencies managing 50+ stores or custom integrations.

**CTA button:** "Start 14-day free trial"

### FIRST-YEAR FINANCIAL PROJECTION

| Month | Free Signups | Trial-to-Paid Conversion | Paying Customers | Avg. Price | Gross Revenue |
|---|---|---|---|---|---|
| Jan | 200 | 12% | 24 | $18.50 | $444 |
| Feb | 300 | 13% | 39 | $19.00 | $741 |
| Mar | 400 | 14% | 56 | $22.50 | $1,260 |
| Apr | 500 | 15% | 75 | $24.00 | $1,800 |
| May | 600 | 15% | 90 | $25.00 | $2,250 |
| Jun | 700 | 16% | 112 | $27.00 | $3,024 |
| Jul | 800 | 16% | 128 | $29.00 | $3,712 |
| Aug | 900 | 17% | 153 | $31.00 | $4,743 |
| Sep | 1,000 | 17% | 170 | $32.50 | $5,525 |
| Oct | 1,200 | 18% | 216 | $35.00 | $7,560 |
| Nov | 1,500 | 18% | 270 | $38.00 | $10,260 |
| Dec | 2,000 | 18% | 360 | $40.00 | $14,400 |
| **TOTAL YEAR 1** | **10,700** | **16% avg** | **1,593** | **$29.00 avg** | **$55,719** |

Calculate net payout separately using the current revenue-share tier, processing fee, taxes, refunds, regional fees, and cost to serve.

**Key assumptions:**
- CAC (free signup): Organic + Product Hunt = $0 (assume free launch)
- Free signups ramp 200→2,000/mo (viral coefficient 1.2)
- Conversion ramps 12%→18% as product improves and reviews accumulate
- Avg. price rises as customers upgrade from Starter ($9.99) to Growth ($29.99) over their lifetime
- Churn: 5% per month (typical for dropshipping tools)
- Repeat customer LTV: 10 months × $29/mo = $290

**Year 2 projection:** Add upsell revenue (API tier) + gross up to 2,500 paying customers = $95K revenue, $76K net.

### OBJECTION RESPONSES

**Q: Can I change plans anytime?**
A: Yes. Upgrade or downgrade instantly. If you downgrade mid-month, we'll credit the difference to your next invoice. No penalties.

**Q: What if I outgrow the Growth tier (5,000 products)?**
A: Email us at support@printflow.app. We offer custom pricing for agencies and high-volume stores. Most Scale tier customers are at 15K–50K products.

**Q: Do you offer annual discounts?**
A: Not yet, but you can lock in monthly pricing anytime. We're evaluating annual discounts for 2026 based on customer demand.

**Q: Is there a limit to how many suppliers I can connect?**
A: Unlimited on Growth + Scale tiers. Free tier is 1 supplier; Starter is 3. Each supplier takes 2 minutes to authorize.

**Q: What happens if Printful or Gooten shuts down their API?**
A: We monitor supplier APIs closely. If a supplier goes down, we'll notify you immediately and help migrate to an alternative (e.g., Merch by Amazon, Teespring). Your data stays yours.

---

## Decision Tree: When to Raise Prices

```
START: Considering a price increase?

1. Are you 6+ months past last price increase?
   NO → Wait 6 months. Price too fresh.
   YES ↓

2. Have you added 2+ new features since last price?
   NO → Add features first, then raise.
   YES ↓

3. Is your LTV:CAC ratio > 3:1?
   NO → Focus on retention/costs first.
   YES ↓

4. Is your churn < 7% per month?
   NO → Fix product quality first; raising price on bad product backfires.
   YES ↓

5. Do 70%+ of customers stay month-to-month (not annual)?
   YES → Announce 30–60 days before increase. Expect 10–15% churn.
   NO → Grandfather existing customers; new customers pay new price. Minimal churn.

6. Is your average plan the "Growth" tier (your profit engine)?
   NO → Avoid raising prices on low-tier customers.
   YES ↓

7. Are you communicating value (customer success stories, new features) every month?
   NO → Start content marketing first; then raise prices.
   YES ↓

RESULT: Ready to raise.

Tactic:
- Month 1: Announce increase in blog post, email, in-app banner. "Here's why." (transparency wins)
- Month 2: Offer grandfathering or force-increase (see previous section).
- Month 3: New price goes live.
- Watch churn. If > 20%, you raised too much; consider seasonal discount or feature bundle.
```

---

## Final Pricing Reality Check

Before you launch, ask yourself these 5 questions:

1. **Can a merchant see ROI in 14 days?** (If no, your trial is too short or your onboarding sucks.)
2. **Would you pay your own price?** (If no, it's too high. Revisit value.)
3. **Do you understand why each tier exists?** (If not, you have too many tiers.)
4. **Can you explain pricing to a confused merchant in 1 sentence?** (If not, it's too complex.)
5. **Are you comfortable with 10% churn in year 1?** (If not, your prices are misaligned with value.)

If you can answer all 5 yes, launch. Then measure, iterate, and raise.
