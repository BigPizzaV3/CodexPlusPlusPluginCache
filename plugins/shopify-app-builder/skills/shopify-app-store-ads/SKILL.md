---
name: shopify-app-store-ads
description: "Research, plan, launch, and optimize Shopify App Store ads for a Shopify app. Use when asked to advertise an app in the Shopify App Store, create an App Store Ads campaign, choose keywords or bids, estimate paid acquisition economics, diagnose ad performance, or turn Reddit/community research into a testable campaign. Require explicit approval of the daily and total spend before creating or enabling any paid campaign."
---

# Shopify App Store Ads

Use App Store ads to test qualified merchant acquisition, not to buy superficial installs. Treat the Shopify Partner Dashboard and current Shopify documentation as the authority for eligibility, available placements, bid behavior, billing, and reporting.

## Ground Rules

1. Verify that the app is publicly published and eligible before proposing launch. An active development version is not evidence of a public App Store listing or advertising eligibility.
2. Research live platform rules before acting. Start with Shopify's [App Store ads documentation](https://help.shopify.com/en/partners/marketing-and-promotions/app-store-ads), then verify the visible Partner Dashboard controls for the specific app.
3. Use community sources (Reddit, reviews, founder posts) to form keyword, pain-point, and creative hypotheses. Label them as anecdotal; do not present them as Shopify policy or benchmark data.
4. Never create, enable, or materially raise a paid campaign without the user's explicit confirmation of the currency, daily cap, total test cap, and stop date. Do not infer approval from a request to "run ads."
5. Never call a campaign live from an API response, draft state, or local configuration alone. Confirm its visible dashboard status, targeting, budget, billing readiness, and landing/listing preview.
6. Do not promise customers or return on ad spend before enough cohort time has passed. Distinguish clicks, installs, trials, activated merchants, and paid customers.

## Readiness Gate

Collect these facts before recommending spend:

- Public App Store listing URL, app status, category, supported geographies, and current price/trial terms.
- Listing conversion evidence: title, tagline, screenshots, review count/rating, pricing clarity, and a merchant-facing promise that matches the target query.
- A working install-to-value path: first-run activation event, billing/trial event, and paid-conversion event. Name the exact analytics source and event names; do not invent them.
- Unit economics: monthly plan(s), gross margin, expected paid retention, acceptable payback window, and the maximum customer-acquisition cost (CAC).
- Partner account access, ad billing readiness, and the person authorized to approve spend.

If a required item is unknown, make it a launch blocker or use the smallest reasonable research-only next step. Do not compensate for weak listing conversion or broken onboarding with a larger bid.

## Research and Campaign Brief

Build a brief that separates evidence from hypotheses.

| Field | Record |
| --- | --- |
| Merchant segment | Store size, vertical, market, current workflow, and urgent job-to-be-done |
| Search intent | The problem phrase merchants use, expected outcome, and disqualifying intent |
| Evidence | Shopify listing/report data, review themes, and dated community observations with links |
| Offer match | Listing headline, screenshots, trial/pricing, and activation path that answer that intent |
| Economics | Target CAC, payback assumption, daily cap, total cap, and stop rule |
| Measurement | Shopify report fields plus product events for install, activation, trial, and paid conversion |

### Keyword Research

Start from the merchant's problem and workflow, not the app's internal feature names. Group terms into:

- **High-intent problem terms:** merchants actively seeking a solution, for example `bundle app` or `back in stock alerts`.
- **Workflow and integration terms:** `preorder manager`, `subscription migration`, or `klaviyo reviews` when the product actually supports the workflow.
- **Competitor/alternative terms:** use only when the listing truthfully offers a credible alternative and current platform rules allow the approach.
- **Exclusions:** irrelevant store types, free-template seekers, jobs/training, or adjacent problems the app cannot solve.

Launch with a compact, traceable set. Separate exact/high-intent terms from discovery terms when the dashboard supports it; preserve the search-term evidence that justifies moving a discovery term into an exact group. Add negatives only for proven mismatches, not because a term has not converted immediately.

### Budget and Bid Logic

Calculate the guardrail from economics first:

```text
max CAC = gross profit expected inside the chosen payback window
max CPC = max CAC × expected click-to-paid conversion rate
```

Use conservative initial bids and a fixed learning budget. A suitable first test is often a **proposal** such as a seven-day, search-led test with a small daily cap; it is never a default authorization. Choose the actual cap only after the user confirms the risk they accept.

Do not spread a small test across many countries, placements, and keyword themes. Start with the segment where the listing, pricing, and onboarding are strongest. Treat homepage/category placements as separate tests only when the listing can win broad discovery and the budget can support them.

## Approval Checkpoint

Before touching a paid control, present a concrete launch card and ask for a direct yes/no approval:

```text
App: <public app name and listing URL>
Objective: <qualified install / activated trial / paid customer>
Targeting: <countries, placement, keyword groups>
Budget: <currency><daily cap>/day, maximum <currency><total cap>, through <date>
Bid rule: <initial bid or bid ceiling and adjustment rule>
Measurement: <Shopify report + product events>
Stop rule: <for example: stop at total cap or if activation quality is below threshold>

Approve this exact Shopify App Store ads test?
```

If approval changes any material field, restate the final card. Record the user's approval in the task or campaign record before launch.

## Create and Verify the Campaign

After approval, use the authenticated Partner Dashboard and complete only the approved configuration.

1. Reconfirm the correct public app and billing account.
2. Configure the approved objective, placement, markets, keywords/negatives, bid, start/end date, and caps.
3. Inspect the preview and confirm that it leads to the intended public listing.
4. Save the campaign and check its dashboard status. Record the campaign name/ID, creation time, final controls, and any review or hold state.
5. Capture the reporting baseline before traffic begins: listing visits, installs, trials, activated accounts, paid accounts, and any known attribution limitations.

If the dashboard says pending, paused, in review, rejected, or otherwise not serving, report that state plainly. Do not claim traffic or customers until the relevant report shows it.

## Measure by Funnel and Cohort

Report the funnel, denominators, date range, and source for every conclusion:

| Metric | Formula | Use |
| --- | --- | --- |
| CTR | clicks / impressions | Query and listing relevance |
| CPC | spend / clicks | Auction cost |
| Install rate | installs / clicks | Listing conversion |
| Activation rate | activated merchants / installs | Onboarding quality |
| Trial rate | trials / installs | Offer and activation fit |
| Paid conversion | paid customers / matured install cohort | Monetization fit |
| CAC | spend / paid customers | Unit-economics decision |

Use Shopify's ad reports as first-party acquisition evidence and product analytics/billing as the source of activation and revenue truth. Reconcile date ranges and attribution windows before combining them. Early free-trial traffic is not a paid-customer result.

Review at three points:

- **After initial delivery:** confirm serving state, targeting, spend pacing, and obvious search-term mismatch.
- **After the fixed learning budget:** compare keyword groups on qualified installs and activation, not CTR alone.
- **After the trial/payback window:** decide whether CAC and retained paid conversion support scaling.

## Optimization Decisions

- Low CTR: tighten query-to-listing message match or pause irrelevant terms.
- Good CTR but low installs: improve the listing's promise, screenshots, proof, or pricing clarity before increasing bids.
- Good installs but low activation: fix onboarding and time-to-value; do not label the campaign successful.
- Good activation but poor paid conversion: examine plan fit, trial design, support, and merchant segment before scaling.
- Strong CAC on a mature cohort: scale one variable at a time—budget, geography, keyword expansion, or placement—and preserve a baseline for comparison.

Do not manufacture thresholds or benchmarks. If the user supplies historical baselines, use them; otherwise frame a threshold as a proposed test criterion requiring confirmation.

## Required Handoff

Return a concise, auditable result containing:

1. **Status:** research-only, ready for approval, live, pending/rejected, or stopped.
2. **Evidence:** primary Shopify sources and dated community/review hypotheses, clearly separated.
3. **Final campaign card:** targeting, bids, budget, dates, and stop rule.
4. **Verification:** visible dashboard status, campaign identifier, and listing destination.
5. **Funnel report:** source, date range, spend, impressions, clicks, installs, activation, trials, paid customers, and CAC where mature.
6. **Next decision:** keep, pause, fix listing/onboarding, or scale—with the exact evidence supporting it.
