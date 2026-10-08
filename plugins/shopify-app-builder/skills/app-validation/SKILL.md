---
name: app-validation
description: "Validate a Shopify app idea before writing code. Runs a 7-question pre-build framework, facilitates 5-merchant interview protocol, guides landing page + waitlist test, and identifies kill criteria early. Outputs a prioritization matrix and yes/no decision. Triggered on: 'validate app idea', 'should I build this app', 'MVP scope', 'app validation framework', 'problem-solution fit', 'customer interview', 'is my shopify app idea good', 'validate my idea'"
---

## When to Use This Skill

Call this when:
1. **You have an app idea** and need confidence before 4 weeks of build time
2. **You want to avoid false starts** with market validation first
3. **You need to prioritize** which app idea to build if you have multiple
4. **You're mid-build** and getting customer feedback signals

**Do NOT use this if:**
- You've already shipped and have paying customers (use metrics instead)
- You're in execution mode and decided to build (stay focused)

---

## The 7-Question Pre-Build Validation Framework

Answer all 7 questions with your best estimate. Score each 1-5 (5 = strong yes, 1 = strong no).

### Question 1: Problem Severity (Does it hurt bad enough?)

"On a scale of 1-5, how much pain do merchants have right now?"
- **5:** Merchants spend 5+ hours/week on this; lose money if unsolved; manual workaround fails 50%+ of the time
- **4:** Spend 2-5 hours/week; workaround exists but tedious; minor money loss
- **3:** Spend <2 hours/week; annoying but manageable workaround
- **2:** Nice-to-have improvement; low time cost
- **1:** Merchants don't really complain about this

**Validation method:** Ask 5 merchants "How many hours/week does [problem] cost you?" If 4/5 say >2 hours, you're at 4-5.

**Red flag:** If score <3, problem is aspirational, not acute. Merchants won't pay.

---

### Question 2: Willingness-to-Pay Signal (Will they actually pay?)

"Would a typical merchant in your target market pay $X/month for this?"
- **5:** Multiple merchants have said "Yes, I'd pay $50+/month for this"
- **4:** 3+ merchants said "Maybe $25-30/month" unprompted
- **3:** Merchants said "Maybe I'd try it if free" or "Could work at $10/month"
- **2:** "I'd use it if free but wouldn't pay"
- **1:** "Not worth paying for"

**Validation method:** Ask in interviews: "What's the maximum you'd pay monthly for this? What's minimum to make it worth your time?" If 4/5 say >$15, score 4-5.

**Red flag:** If score <3, problem is real but not monetizable.

---

### Question 3: Retention Plausibility (Will they stick around?)

"If merchants start using this, will they stay for 6+ months?"
- **5:** Solution is sticky by design (required for operations every day)
- **4:** Daily/weekly usage; low switching cost to alternatives
- **3:** Bi-weekly usage; some switching cost
- **2:** Monthly usage; high switching cost (easy to stop)
- **1:** One-time use; merchants will abandon after task completes

**Validation method:** Ask: "Once you solve this problem, will you need to keep using it weekly?" If yes, score 4-5. If it's a one-time setup, score 1-2.

**Red flag:** If score <3, churn will be >30%/month, killing unit economics.

---

### Question 4: Build Complexity vs Founder Skill (Can you actually ship?)

"How complex is this to build relative to your experience?"
- **5:** You've built 3+ similar apps; <4 weeks for MVP
- **4:** Similar to past projects; 4-6 weeks with learning
- **3:** Requires 1-2 new technologies; 6-8 weeks
- **2:** Requires deep learning in unfamiliar domain; 8-12 weeks
- **1:** Requires ML/distributed systems/real-time data processing; >12 weeks

**Validation method:** Sketch MVP: "What are the 3 core features?" If all are API-integration or dashboard, score 4-5. If you need to learn new framework, score 3. If it requires ML, score 1-2.

**Red flag:** If score <3 and you're solo, you won't finish in 90 days. Adjust scope or team up.

---

### Question 5: Distribution Path (How will they find you?)

"Do you have a distribution channel to reach 100+ merchants in 90 days?"
- **5:** Existing audience (email list 500+, Twitter 2k+ followers, partnership ready)
- **4:** Can reach niche community easily (Facebook group, subreddit, forums with active presence)
- **3:** Can cold-email 50+ prospects per week; willing to do manual outreach
- **2:** App Store search only; no warm channel
- **1:** No plan to reach customers; hoping App Store ranking appears

**Validation method:** List 5 specific ways you'll reach first 100 customers. If 3+ are warm (email, partnerships, existing audience), score 4-5. If all cold, score 2-3.

**Red flag:** If score <3, you'll take 6+ months to hit $1k MRR. Okay if you have runway, risky if bootstrapping.

---

### Question 6: Defensibility (Will competitors copy you?)

"How easy is this for a competitor to replicate in 3 months?"
- **5:** Network effects, data moat, or exclusive partnership (hard to copy)
- **4:** Requires specific domain expertise or customer relationships
- **3:** Process/product differentiation; smart execution wins
- **2:** Copyable but slower (competitor could match in 4-6 months)
- **1:** Trivially copyable; first-mover advantage only lasts 2-3 months

**Validation method:** Could Shopify build this natively? Could Klaviyo or Recharge add it as a feature? If yes, score 1-2. If requires specialized knowledge, score 4-5.

**Red flag:** If score <2 and you're bootstrapping, be prepared to sell or partner before a big competitor enters.

---

### Question 7: Gross Margin Math (Does the unit economics work?)

"Will you make money on each customer, accounting for payment processing, support, hosting?"
- **5:** Pricing >$50/month; COGS <20%; unit margins 70%+
- **4:** Pricing $25-50/month; COGS 20-30%; unit margins 50-70%
- **3:** Pricing $10-25/month; COGS 30-40%; unit margins 40-50%
- **2:** Pricing <$10/month or COGS >40%; unit margins <40%
- **1:** Pricing <$5/month or will require heavy support; unprofitable

**Validation method:**
- Payment processing: 3.5% (Stripe)
- Hosting/database: Estimate per customer
- Support: $1-5/month per customer
- Margins = (Price - COGS) / Price
- Rule: If <40% margin, you need 10k+ customers to be sustainable. Risky.

**Red flag:** If score <3, you're building a lifestyle business (not a venture). Know what you're signing up for.

---

## The 5-Merchant Interview Protocol

### Interview Script (20 minutes)

**Intro (2 min):**
"Hi [Name]. Thanks for 20 minutes. I'm researching how [niche] merchants solve [problem]. I'm not selling anything—just learning. Honest feedback helps me most."

**Problem Understanding (5 min):**
1. "How do you currently solve [problem]?"
2. "What's frustrating about your current approach?" (Listen for pain signals)
3. "How much time do you spend on this per week?"

**Willingness-to-Pay (5 min):**
4. "If an app solved this, how much would you pay monthly?" (Don't anchor; let them answer)
5. "What features would it need to be worth that price?" (Listen for must-haves)

**Retention Signal (4 min):**
6. "Would you need this app indefinitely, or is it one-time?" (Score retention here)
7. "Would you switch from [current solution] if this was 50% cheaper?" (Switching costs)

**Outro (4 min):**
8. "Can I send you a waitlist link in 2 weeks? I'll give early customers 50% off first year." (Pre-sale signal)
9. "Who else should I talk to in your niche?" (Warm intros > cold email)

### Interview Scoring Rubric

| Signal | Strong (5) | Moderate (3) | Weak (1) |
|---|---|---|---|
| Problem severity | Spends 5+ hrs/week; lost money | 2-4 hrs/week | <1 hr/week |
| Current solution fit | "It's broken, I hate it" | "Works but tedious" | "I'm fine with it" |
| Willingness-to-pay | "I'd pay $50/month" | "Maybe $20-25" | "Only if free" |
| Stated features needed | 2-3 specific, detailed | 1-2 generic features | Vague answers |
| Retention likelihood | "I'd need this forever" | "Maybe 6-12 months" | "One-time fix" |
| Switching cost | "Pain to change now" | "Could switch if easy" | "No switching cost" |
| Pre-sale signal | "Yes, send waitlist" | "Maybe, depends on price" | "Not interested" |

**Scoring:** Sum scores for all interviews. Target: 28+/35 (80%+) to proceed with build.

---

## Landing Page + Waitlist Test

### The Template (Webflow, no-code, <1 day to build)

```
# Headline: [Problem Result] in [Timeframe]

[Subheading: Benefit statement]

## The Problem
[2-3 sentences: How merchants currently lose money/time]

## The Solution
[Your app name]: [What it does]

### What You Get:
- Feature 1: [What it does + benefit]
- Feature 2: [What it does + benefit]
- Feature 3: [What it does + benefit]

## FAQ

**Q: How long does onboarding take?**
A: <5 minutes. Install, connect, start.

**Q: Can I try it free?**
A: Yes. [30-day free trial] with full features.

**Q: What if I don't like it?**
A: Cancel anytime. No questions asked.

## Join the Waitlist
Early access: 50% lifetime discount + priority support
[Email input + "Notify Me" CTA]

Launching: [Date 4 weeks from now]
```

### Waitlist Test Success Metrics

- **Goal:** 100 signups in 30 days (indicates strong demand)
- **Minimum:** 50 signups (problem is real, but demand is moderate)
- **Red flag:** <25 signups (either problem is unknown or niche is tiny)

### How to Drive Traffic (Organic)

1. **Reddit r/shopify** (2-3 posts per week)
   - Share specific problem you're solving
   - Never hard-sell; let conversation emerge
   - Goal: 5-10 signups per post

2. **Shopify Community Forums** (1-2 relevant thread responses)
   - Add to existing threads about the problem
   - Link to waitlist only if on-topic
   - Goal: 3-5 signups per thread

3. **Twitter** (Daily, if you're active)
   - Share merchant pain points
   - Ask for feedback on solution direction
   - Link to waitlist in bio
   - Goal: 2-3 signups per day if you have audience

4. **Cold email** (Optional, high-touch)
   - 20 relevant store owners per week
   - Subject: "Question for you: [problem]?"
   - Goal: 10-20% reply rate, 5-10% signup rate

### Conversion Math
- 500 landing page visits → 50 signups = 10% conversion (strong)
- 500 visits → 25 signups = 5% conversion (okay)
- 500 visits → <10 signups = 2% conversion (rethink value prop)

---

## Pre-Sale Test (Highest Confidence Signal)

**Email to waitlist after 2 weeks:**

Subject: "50% lifetime discount ends soon [Your App Name]"

Body:
"We're launching [App Name] in 2 weeks. I'm offering the first 50 waitlist members 50% off forever as a thank you.

[Problem]: [2-sentence description]
[Solution]: [2-sentence description]

Pricing: $29/month ($14.50 with this offer)
[Link to pre-order/purchase]

No refunds needed—we'll set up your trial first."

### Pre-Sale Scoring
- **5+** customers commit = Demand is confirmed. Build it.
- **2-4** customers commit = Demand is moderate. Adjust positioning or pricing.
- **0-1** customers commit = Problem doesn't justify price. Kill idea or pivot.

---

## MVP Scope Definition (4-Week Target)

### Cut Ruthlessly

**REMOVE from MVP:**
- Multi-language support
- Admin dashboard analytics
- Webhooks to 5+ platforms
- Advanced permission systems
- Mobile app (web-responsive okay)
- Email notifications (basic only)
- API documentation
- Custom integrations

**KEEP for MVP:**
- Core workflow: 1 painful step, fully solved
- Core integrations: 1-2 essential APIs only
- Authentication: Shopify OAuth only
- Database: Simple schema, no complex queries
- UX: Functional, not beautiful
- Support: Email only

### Example MVP Scope: Dropshipping Order Reconciliation

**What to build:**
1. Dashboard showing all orders from connected supplier APIs (3 integrations: AliExpress, Shopee, Supplier 1)
2. Order status sync (manual refresh + 12-hour auto-sync)
3. Tracking number capture + auto-update to Shopify
4. Export orders as CSV

**What NOT to build:**
- Margin calculator
- Supplier rating system
- Batch order management
- Real-time webhooks
- Mobile app
- Advanced analytics

**Realistic 4-week timeline:**
- Week 1: Shopify OAuth + database schema + UI layout
- Week 2: AliExpress API integration
- Week 3: Status sync + tracking capture
- Week 4: Testing + Shopify review submission

---

## Kill Criteria: When to Abandon

**Stop if ANY of these are true:**

1. **Interview Score <20/35**
   - Fewer than 3/5 merchants willing to pay at target price
   - Action: Pivot to different problem or niche

2. **Waitlist Score <25 signups in 30 days**
   - Insufficient demand signal
   - Action: Either rethink marketing or kill idea

3. **Pre-Sale Score 0 commits in 2 weeks**
   - Merchants won't pre-pay even with discount
   - Action: Abandon or find different angle

4. **Build complexity >8 weeks solo**
   - You can't ship in 90-day window
   - Action: Simplify MVP or team up

5. **Gross margins <35%**
   - Unit economics don't work at any reasonable scale
   - Action: Raise prices or cut COGS; if neither possible, kill

6. **5+ competitors all with 4.5+ ratings**
   - Market is won; differentiation is nearly impossible
   - Action: Move to different niche

7. **Shopify is shipping this feature natively in Q2/Q3**
   - You will be undercut before profitability
   - Action: Kill and find different problem

8. **Churn will likely be >15%/month**
   - Problem is nice-to-have, not must-have
   - Action: Find stickier problem

---

## Prioritization Matrix (If You Have Multiple Ideas)

Score each idea 1-5 on each axis. Plot on matrix.

```
                High Defensibility
                       ^
                       |
     LOW BUILD    LOW BUILD      HIGH BUILD    HIGH BUILD
     LOW DEMAND   HIGH DEMAND    LOW DEMAND    HIGH DEMAND
                       |
      __________|__________|__________
     |                    |           |
HIGH |        [MAYBE]     |   [BUILD] |
     |        Build only  |   Build   |
     |        if funded   |   first   |
     |                    |           |
MARGIN|_____________________|___________|_________
     |                    |           |
LOW  |      [KILL]        | [CONSIDER]|
     |      No point      | If you    |
     |                    | have time |
     |_____________________|___________|
               [Build Complexity / Niche Size]
```

**Placement logic:**
- **High demand + Low build complexity + High defensibility** = BUILD FIRST
- **High demand + Low complexity + Low defensibility** = BUILD FAST (before copied)
- **High demand + High complexity + Low margins** = SKIP (unit economics fail)
- **Low demand** = KILL (waste of time)

---

## Output Format for Claude

When validating an idea, return this structure:

```
# App Idea Validation Report

## 7-Question Framework Scores

| Question | Score (1-5) | Evidence |
|---|---|---|
| Problem severity | [X] | [Quote from interviews / time spent] |
| Willingness-to-pay | [X] | [Price points mentioned] |
| Retention likelihood | [X] | [Usage frequency signal] |
| Build complexity vs skill | [X] | [Time estimate + experience] |
| Distribution path | [X] | [5 specific acquisition channels] |
| Defensibility | [X] | [Competitive advantage / moat] |
| Gross margin math | [X] | [Price - COGS calc] |
| **TOTAL SCORE** | **[X]/35** | **[% of max]** |

## Interview Summary
- **Merchants interviewed:** [Names/types]
- **Interview score:** [X/35]
- **Key pain signal:** [Most common complaint]
- **Willingness-to-pay:** $[Min]-$[Max]/month (median: $X)
- **Pre-sale commitment:** [X customers] at [Price]

## MVP Scope & Timeline
- **Core workflow:** [One sentence]
- **Essential integrations:** [1-2 APIs]
- **Realistic timeline:** [Weeks]
- **Build complexity vs your skill:** [Match/Gap]

## Recommendation

**[BUILD / PIVOT / KILL]**

**Reasoning:**
- [If BUILD] This scores [X/35]. Problem is acute ($[money]/week loss), merchants will pay $[price], and you can ship in 4 weeks. Proceed with MVP.
- [If PIVOT] Problem severity is low, but willingness-to-pay for angle [X] is stronger. Suggest pivoting to [alternative angle].
- [If KILL] [Reason: interview score / waitlist performance / build complexity / margin math / competition]. Recommend moving to idea [Next priority].
```

---

## Decision Tree: Should You Build This App?

```
START: You have an app idea
  ↓
Step 1: Run 5-question interviews with target merchants
  Result: Interview score [X/35]

  [Score >24] → Continue
  [Score 15-24] → Consider pivoting problem angle
  [Score <15] → KILL, move to next idea

  ↓
Step 2: Launch landing page + waitlist
  Result: [X signups in 30 days]

  [>50 signups] → Continue
  [25-50 signups] → Proceed but expect slower traction
  [<25 signups] → Rethink positioning or kill

  ↓
Step 3: Run pre-sale test
  Result: [X customers pre-commit]

  [>2 pre-sales] → BUILD
  [0-1 pre-sales] → Either kill or pivot pricing/positioning

  ↓
Step 4: Validate MVP scope & timeline
  Can you ship in 4 weeks? Build complexity vs skill match?

  [YES] → BEGIN BUILD
  [NO] → Simplify MVP or add co-founder
```

---

## Key Metrics Throughout Validation

- **Interview conversion:** (Willing to pay) / 5 merchants = demand %
- **Willingness-to-pay median:** Ask 5 merchants, find median price point
- **Waitlist conversion:** Signups / traffic = demand signal
- **Pre-sale conversion:** Pre-commits / waitlist = monetization confidence
- **Build time estimate:** Weeks to MVP (target: <4 weeks)
- **Churn prediction:** Daily/weekly/monthly usage = monthly retention rate
- **Gross margin:** (Price - COGS) / Price (target: >40%)

---

## Validation Timeline

**Week 1:** Recruit 5 merchants + run interviews
**Week 2:** Build landing page + start driving waitlist traffic
**Week 3:** Analyze waitlist conversion; if >50, launch pre-sale
**Week 4:** Decision: BUILD, PIVOT, or KILL

**Total validation time:** 4 weeks (before writing one line of code)

If validation passes all gates, you enter MVP build phase with 90+ days of runway.
