---
name: app-billing
description: "Implement recurring, usage-based, one-time, and hybrid Shopify app billing. Covers appSubscriptionCreate, appUsageRecordCreate, trials, capped amounts, replacement behavior, test mode, current revenue-share rules, and pricing tiers."
---

# Shopify App Billing

Shopify apps can charge merchants through Shopify's billing system. Charges are collected via the merchant's Shopify payment method and appear on their bill. Three models are supported: **recurring** (fixed monthly/annual), **usage-based** (pay-per-action), and **one-time** (one-off charges). You can also combine them (hybrid).

## Revenue Share Model

For developers eligible for Shopify's standard rates:
- You keep **100% of the first $1,000,000 USD in lifetime gross app revenue earned from January 1, 2025**.
- Above that threshold, Shopify's revenue share is **15%**, so you keep **85%** before other fees and taxes.
- All billing is separately subject to a **2.9% processing fee**, applicable sales tax, and potentially regional regulatory fees.
- Shopify applies special eligibility rules to very large developers and aggregates revenue across associated developer accounts. Verify the current policy before financial modeling.

This means your pricing directly affects what you keep:
```
App charges $10 while eligible for the 0% revenue-share tier
├─ Merchant pays: $10.00
├─ Processing fee: $0.29, before tax or regional fees
└─ Developer amount before tax/regional fees: $9.71

App charges $100 above the $1M lifetime threshold
├─ Merchant pays: $100.00
├─ Revenue share: $15.00
├─ Processing fee: $2.90, before tax or regional fees
└─ Developer amount before tax/regional fees: $82.10
```

**Planning rule:** Model revenue share, processing fees, taxes, refunds, and cost to serve separately; don't assume gross charges equal payout.

## Billing Models

### 1. Recurring (Fixed Interval)

**Use Case:** Subscription model (e.g., "Pro plan $99/month")
**Charging:** First charge immediate on approval; subsequent charges on anniversary date
**Cancellation:** Merchant can cancel anytime; charged through current period end

**appSubscriptionCreate Mutation:**
```graphql
mutation CreateRecurringSubscription {
  appSubscriptionCreate(
    input: {
      trialDays: 7
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              interval: MONTHLY  # or ANNUAL
              price: { amount: "9.99", currencyCode: "USD" }
            }
          }
        }
      ]
      returnUrl: "https://your-app.com/billing/confirm"
    }
  ) {
    appSubscription {
      id
      confirmationUrl  # Merchant must visit this URL to approve
      lineItems {
        id
        plan {
          pricingDetails {
            ... on AppRecurringPricingDetails {
              interval
              price { amount currencyCode }
            }
          }
        }
      }
      status  # PENDING, ACTIVE, DECLINED, EXPIRED, FROZEN, CANCELLED
      currentPeriodEnd
      trialDays
      trialEndsOn
    }
    userErrors {
      field
      message
    }
  }
}
```

**Remix Implementation (Recurring Billing):**
```typescript
import { json, redirect } from '@shopify/remix-oxygen';
import { authenticate } from '~/shopify.server';

export const action = async ({ request }) => {
  if (request.method !== 'POST') return json({ error: 'POST only' }, { status: 405 });

  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    mutation CreateRecurringSubscription($input: AppSubscriptionInput!) {
      appSubscriptionCreate(input: $input) {
        appSubscription {
          id
          confirmationUrl
          status
          currentPeriodEnd
          lineItems {
            id
            plan {
              pricingDetails {
                ... on AppRecurringPricingDetails {
                  interval
                  price { amount currencyCode }
                }
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      input: {
        trialDays: 7,
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                interval: 'MONTHLY',
                price: { amount: '9.99', currencyCode: 'USD' },
              },
            },
          },
        ],
        returnUrl: 'https://your-app.com/billing/confirm',
      },
    },
  });

  const { appSubscription, userErrors } = response.data?.appSubscriptionCreate || {};

  if (userErrors?.length > 0) {
    return json({ errors: userErrors }, { status: 400 });
  }

  // Merchant must visit confirmation URL to approve billing
  return redirect(appSubscription.confirmationUrl);
};

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const charge = url.searchParams.get('charge_id');

  if (!charge) {
    return json({ message: 'Waiting for merchant approval' });
  }

  // Query subscription status after merchant approves
  const response = await admin.graphql(`
    query GetSubscription($id: ID!) {
      appSubscription(id: $id) {
        id
        status
        currentPeriodEnd
        returnUrl
        lineItems {
          id
          plan {
            pricingDetails {
              ... on AppRecurringPricingDetails {
                interval
                price { amount currencyCode }
              }
            }
          }
        }
      }
    }
  `, {
    variables: { id: charge },
  });

  const subscription = response.data?.appSubscription;

  if (subscription?.status === 'ACTIVE') {
    return json({ success: true, subscription });
  }

  return json({ success: false, subscription });
};
```

### 2. Usage-Based (Pay-Per-Action)

**Use Case:** Charge per email sent, API call, report generated, etc.
**Charging:** Metered; merchant is charged monthly for accumulated usage
**Cap Amount:** Optional; maximum the merchant can be charged per period

**appSubscriptionCreate Mutation (Usage-Based):**
```graphql
mutation CreateUsageSubscription {
  appSubscriptionCreate(
    input: {
      trialDays: 0
      lineItems: [
        {
          plan: {
            appUsagePricingDetails: {
              cappedAmount: {
                amount: "100.00"  # Max charge per billing period
                currencyCode: "USD"
              }
              terms: "$0.01 per email sent"  # Display string
            }
          }
        }
      ]
      returnUrl: "https://your-app.com/billing/confirm"
    }
  ) {
    appSubscription {
      id
      confirmationUrl
      lineItems {
        id
        plan {
          pricingDetails {
            ... on AppUsagePricingDetails {
              cappedAmount { amount currencyCode }
              terms
            }
          }
        }
      }
      status
    }
    userErrors {
      field
      message
    }
  }
}
```

**Recording Usage (appUsageRecordCreate):**
```graphql
mutation RecordUsage($subscriptionLineId: ID!, $quantity: Float!, $idempotencyKey: String!) {
  appUsageRecordCreate(
    subscriptionLineId: $subscriptionLineId
    quantity: $quantity
    idempotencyKey: $idempotencyKey
  ) {
    appUsageRecord {
      id
      createdAt
      quantity
    }
    userErrors {
      field
      message
    }
  }
}
```

**Remix Implementation (Usage-Based):**
```typescript
import { json } from '@shopify/remix-oxygen';
import { authenticate } from '~/shopify.server';

// Step 1: Create usage-based subscription
export const action = async ({ request }) => {
  if (request.method !== 'POST') return json({ error: 'POST only' }, { status: 405 });

  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    mutation CreateUsageSubscription($input: AppSubscriptionInput!) {
      appSubscriptionCreate(input: $input) {
        appSubscription {
          id
          confirmationUrl
          lineItems {
            id
            plan {
              pricingDetails {
                ... on AppUsagePricingDetails {
                  cappedAmount { amount currencyCode }
                  terms
                }
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `, {
    variables: {
      input: {
        lineItems: [
          {
            plan: {
              appUsagePricingDetails: {
                cappedAmount: { amount: '100.00', currencyCode: 'USD' },
                terms: '$0.10 per report generated',
              },
            },
          },
        ],
        returnUrl: 'https://your-app.com/billing/confirm',
      },
    },
  });

  const { appSubscription } = response.data?.appSubscriptionCreate || {};
  return redirect(appSubscription.confirmationUrl);
};

// Step 2: Record usage when action occurs (e.g., report generated)
export const recordUsage = async (
  admin,
  subscriptionLineId: string,
  quantity: number
) => {
  const idempotencyKey = `${subscriptionLineId}-${Date.now()}`; // Prevent duplicates

  const response = await admin.graphql(`
    mutation RecordUsage(
      $subscriptionLineId: ID!
      $quantity: Float!
      $idempotencyKey: String!
    ) {
      appUsageRecordCreate(
        subscriptionLineId: $subscriptionLineId
        quantity: $quantity
        idempotencyKey: $idempotencyKey
      ) {
        appUsageRecord { id createdAt quantity }
        userErrors { field message }
      }
    }
  `, {
    variables: {
      subscriptionLineId,
      quantity,
      idempotencyKey,
    },
  });

  const { appUsageRecord, userErrors } = response.data?.appUsageRecordCreate || {};

  if (userErrors?.length > 0) {
    console.error('Usage record error:', userErrors);
    return null;
  }

  return appUsageRecord;
};

// Step 3: In report generation endpoint
export const generateReport = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const data = await request.json();

  // Generate report
  const reportId = await createReport(session.shop, data);

  // Record usage (charge for report)
  const subscriptionLineId = 'gid://shopify/AppSubscriptionLine/123';
  await recordUsage(admin, subscriptionLineId, 1); // 1 report = 1 charge unit

  return json({ success: true, reportId });
};
```

### 3. One-Time Charge

**Use Case:** Upfront license purchase, setup fee, premium feature unlocks
**Charging:** Immediate; merchant approves and is charged once
**No Recurring:** Does not repeat; separate call required for each charge

**appSubscriptionCreate Mutation (One-Time):**
```graphql
mutation CreateOneTimeCharge {
  appSubscriptionCreate(
    input: {
      lineItems: [
        {
          plan: {
            appOneTimePricingDetails: {
              price: { amount: "49.99", currencyCode: "USD" }
            }
          }
        }
      ]
      returnUrl: "https://your-app.com/billing/confirm"
    }
  ) {
    appSubscription {
      id
      confirmationUrl
      lineItems {
        id
        plan {
          pricingDetails {
            ... on AppOneTimePricingDetails {
              price { amount currencyCode }
            }
          }
        }
      }
      status
    }
    userErrors { field message }
  }
}
```

### 4. Hybrid (Recurring + Usage-Based)

**Use Case:** Base subscription + pay-per-extra-action (e.g., "Pro $99/month + $0.05 per extra report")
**Charging:** Base charge monthly + usage charges accumulated during month

**appSubscriptionCreate Mutation (Hybrid):**
```graphql
mutation CreateHybridSubscription {
  appSubscriptionCreate(
    input: {
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              interval: MONTHLY
              price: { amount: "99.00", currencyCode: "USD" }
            }
          }
        },
        {
          plan: {
            appUsagePricingDetails: {
              cappedAmount: { amount: "1000.00", currencyCode: "USD" }
              terms: "$0.05 per extra report (beyond 100/month)"
            }
          }
        }
      ]
      returnUrl: "https://your-app.com/billing/confirm"
    }
  ) {
    appSubscription {
      id
      confirmationUrl
      lineItems { id plan { pricingDetails { ... on AppRecurringPricingDetails { interval price { amount currencyCode } } ... on AppUsagePricingDetails { cappedAmount { amount currencyCode } terms } } } }
    }
    userErrors { field message }
  }
}
```

## Billing Configuration in Remix

**Require Billing (MUST_USE_BILLING):**

In your Remix root component, block access until billing is confirmed:

```typescript
// app/root.tsx
import { authenticate } from '~/shopify.server';

export const loader = async ({ request }) => {
  const { billing } = await authenticate.admin(request);

  // MUST_USE_BILLING: Prevent app usage without active subscription
  await billing.require({
    plans: ['basic', 'premium', 'unlimited'], // At least one required
    onFailUrl: '/billing', // Redirect if no active subscription
  });

  return null;
};
```

**Request Billing (Optional):**

Allow app usage but encourage upgrade:

```typescript
export const loader = async ({ request }) => {
  const { billing } = await authenticate.admin(request);

  // OPTIONAL: App works without billing, but show upsell
  const response = await billing.request({
    plan: 'premium',
    isTest: false,
  });

  return json({ needsBilling: !response.appSubscription });
};
```

**Test Mode:**

Simulate billing without charging:

```typescript
export const loader = async ({ request }) => {
  const { billing } = await authenticate.admin(request);

  // Test mode: Billing is mocked; no real charges
  await billing.require({
    plans: ['test-plan'],
    isTest: true, // Set to false for production
  });

  return null;
};
```

**Cancel Subscription:**

```graphql
mutation CancelSubscription($id: ID!) {
  appSubscriptionCancel(id: $id) {
    appSubscription {
      id
      status  # CANCELLED
      returnUrl
    }
    userErrors { field message }
  }
}
```

## Pricing Strategy & Tier Ladder

**Common Pricing Models:**

### Flat Pricing (Simple)
```
Starter: $29/month (up to 100 products)
Pro: $99/month (up to 10,000 products)
Enterprise: $499/month (unlimited)
```

### Tiered Usage (Pay-Per-Action)
```
Base: $0/month (free tier, 100 reports/month)
Standard: $0.05 per report above 100
Premium: $0.02 per report above 100 (volume discount)
```

### Freemium + Paid Features
```
Free: $0 (basic features only)
Plus: $9.99/month (advanced analytics)
Pro: $49.99/month (API access + custom integrations)
```

### Feature-Gated Tiers
```
Standard: $49/month
├─ Dashboard
├─ Email notifications
└─ 30-day history

Pro: $149/month
├─ Everything in Standard
├─ API access
├─ Custom rules
└─ Unlimited history
```

**Recommended Tier Ladder:**
1. **Free Tier** (required; builds trust)
   - Basic functionality
   - Limited usage (e.g., 10 actions/month)
   - No integrations
   - Community support only

2. **Starter** ($19-49/month)
   - 1-2 intermediate features
   - Moderate usage (e.g., 1,000 actions/month)
   - Email support

3. **Professional** ($99-299/month)
   - All features
   - High usage (unlimited or 100K+ actions)
   - Priority support
   - API access

4. **Enterprise** (custom pricing)
   - Custom features
   - Dedicated support
   - SLA guarantee
   - White-label option

**Pricing Psychology:**
- Odd pricing ($19.99 vs $20) increases conversion
- Annual pricing 20-30% cheaper than monthly (increases LTV)
- "Pro" tier should be sweet spot; most conversions
- Free tier must have real value; 10-15% convert to paid

## Full Working Examples

### Example 1: Flat Recurring Billing (3-Tier Plan)

**routes/billing/create.tsx (Create Subscription):**
```typescript
import { json, redirect } from '@shopify/remix-oxygen';
import { authenticate } from '~/shopify.server';
import { Form } from '@remix-run/react';

export const action = async ({ request }) => {
  if (request.method !== 'POST') return json({ error: 'POST only' }, { status: 405 });

  const formData = await request.formData();
  const plan = formData.get('plan') as string;
  const { admin } = await authenticate.admin(request);

  const planConfig = {
    starter: { price: '29.99', interval: 'MONTHLY' },
    pro: { price: '99.99', interval: 'MONTHLY' },
    enterprise: { price: '499.99', interval: 'MONTHLY' },
  };

  const config = planConfig[plan as keyof typeof planConfig];
  if (!config) return json({ error: 'Invalid plan' }, { status: 400 });

  const response = await admin.graphql(`
    mutation CreateSubscription($input: AppSubscriptionInput!) {
      appSubscriptionCreate(input: $input) {
        appSubscription { id confirmationUrl status }
        userErrors { field message }
      }
    }
  `, {
    variables: {
      input: {
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                interval: config.interval,
                price: { amount: config.price, currencyCode: 'USD' },
              },
            },
          },
        ],
        returnUrl: 'https://your-app.com/billing/confirm',
      },
    },
  });

  const { appSubscription } = response.data?.appSubscriptionCreate || {};
  return redirect(appSubscription.confirmationUrl);
};

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function BillingPlans() {
  return (
    <div>
      <h1>Choose Your Plan</h1>
      <Form method="post">
        <label>
          <input type="radio" name="plan" value="starter" /> Starter - $29/month
        </label>
        <label>
          <input type="radio" name="plan" value="pro" /> Pro - $99/month
        </label>
        <label>
          <input type="radio" name="plan" value="enterprise" /> Enterprise - $499/month
        </label>
        <button type="submit">Subscribe</button>
      </Form>
    </div>
  );
}
```

### Example 2: Usage-Based Billing (Per-Report)

**routes/api/report-create.tsx (Record Usage):**
```typescript
import { json } from '@shopify/remix-oxygen';
import { authenticate } from '~/shopify.server';
import { prisma } from '~/db.server';

export const action = async ({ request }) => {
  if (request.method !== 'POST') return json({ error: 'POST only' }, { status: 405 });

  const { admin, session } = await authenticate.admin(request);
  const data = await request.json();

  // Generate report
  const report = await prisma.report.create({
    data: {
      shop: session.shop,
      name: data.name,
      generatedAt: new Date(),
    },
  });

  // Get subscription line for usage tracking
  const subscription = await getActiveSubscription(session.shop);
  if (subscription?.usageLineId) {
    // Record 1 report = 1 usage unit (charge $0.10)
    await admin.graphql(`
      mutation RecordUsage(
        $subscriptionLineId: ID!
        $quantity: Float!
        $idempotencyKey: String!
      ) {
        appUsageRecordCreate(
          subscriptionLineId: $subscriptionLineId
          quantity: $quantity
          idempotencyKey: $idempotencyKey
        ) {
          appUsageRecord { id quantity }
          userErrors { field message }
        }
      }
    `, {
      variables: {
        subscriptionLineId: subscription.usageLineId,
        quantity: 1,
        idempotencyKey: `${report.id}-${Date.now()}`,
      },
    });
  }

  return json({ success: true, reportId: report.id });
};

async function getActiveSubscription(shop: string) {
  return prisma.subscription.findUnique({
    where: { shop },
    select: { usageLineId: true },
  });
}
```

### Example 3: Freemium + Paid Features (Feature Gates)

**routes/app.reports.tsx (Feature-Gated Page):**
```typescript
import { json } from '@shopify/remix-oxygen';
import { useLoaderData } from '@remix-run/react';
import { authenticate } from '~/shopify.server';

export const loader = async ({ request }) => {
  const { admin, billing, session } = await authenticate.admin(request);

  // Check if merchant has active paid subscription
  const { appSubscriptions } = await admin.graphql(`
    query {
      appSubscriptions(first: 1) {
        edges {
          node {
            id
            status
            lineItems {
              plan {
                pricingDetails {
                  ... on AppRecurringPricingDetails {
                    price { amount }
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  const isPaid = appSubscriptions?.edges?.[0]?.node?.status === 'ACTIVE';

  // Load reports
  const reports = await getReports(session.shop);

  return json({ reports, isPaid });
};

export default function ReportsPage() {
  const { reports, isPaid } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Reports</h1>
      {isPaid ? (
        <div>
          {/* Show all reports */}
          {reports.map((r) => (
            <div key={r.id}>{r.name}</div>
          ))}
        </div>
      ) : (
        <div className="upgrade-banner">
          <p>Unlock unlimited reports with Pro plan</p>
          <a href="/billing">Upgrade Now</a>
        </div>
      )}
    </div>
  );
}

async function getReports(shop: string) {
  // Fetch from database
  return [];
}
```

## Handle Subscription Lifecycle

**Webhook: app/subscribed**

When merchant approves subscription:

```typescript
// webhooks/app-subscribed.ts
export const webhooks = {
  APP_SUBSCRIBED: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: '/webhooks/app-subscribed',
  },
};

export async function handleAppSubscribed(shop, body) {
  const { appSubscription } = JSON.parse(body);

  // Store subscription in database
  await storeSubscription(shop, {
    subscriptionId: appSubscription.id,
    status: appSubscription.status,
    currentPeriodEnd: appSubscription.currentPeriodEnd,
    lineItems: appSubscription.lineItems,
  });

  // Send confirmation email
  await sendEmail(shop, 'Subscription activated');
}
```

**Webhook: billing_attempt.failure**

When payment fails:

```typescript
export async function handleBillingFailure(shop, body) {
  const { appSubscription } = JSON.parse(body);

  // Notify merchant
  await sendEmail(shop, 'Payment failed; please update payment method');

  // Optionally freeze features after multiple failures
  await disableFeatures(shop);
}
```

**Cleanup on Uninstall:**

```typescript
export async function handleAppUninstalled(shop) {
  // Delete billing records for this merchant
  await prisma.subscription.deleteMany({ where: { shop } });
  await prisma.usageRecord.deleteMany({ where: { shop } });
}
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| **"Invalid currency code"** | Currency not supported by Shopify | Use USD, EUR, GBP, CAD, AUD, JPY, or merchant's shop currency |
| **Billing confirmation URL returns 404** | Merchant link expired (24h limit) | Generate new confirmation URL; store in database with expiry |
| **appUsageRecordCreate returns "invalid subscription line"** | Wrong subscriptionLineId | Query active subscription to get correct lineId |
| **"subscription is frozen"** | Payment failed; account suspended | Fix payment method; contact Shopify support |
| **Test mode billing not mocking** | isTest flag not set | Set `isTest: true` in billing.require() |
| **Duplicate usage charges** | No idempotencyKey or not unique | Generate unique key per usage record; include timestamp |

## Resources

- **Shopify app billing:** https://shopify.dev/docs/apps/launch/billing
- **GraphQL billing objects and mutations:** https://shopify.dev/docs/api/admin-graphql/latest/objects/AppSubscription
- **Revenue share:** https://shopify.dev/docs/apps/launch/distribution/revenue-share
- **Shopify App Store listing:** https://shopify.dev/docs/apps/launch/shopify-app-store/app-listing
