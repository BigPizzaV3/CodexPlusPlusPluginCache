# Setup — plan check and website provisioning

All tools here are in `hostinger-hosting-mcp`, except where noted.

## 1. Plan check (gate — run this first)

A website can only be created on an active hosting plan.

1. `hosting_listWebsitesV1` — if it returns websites, the account has a working
   plan; note any existing `order_id` and `username` for step 3.
2. Otherwise `hosting_listOrdersV1` — look for an order in a usable state. A
   fresh order that has never hosted a website still works; note its `order_id`.
3. If there is no usable order: **stop and tell the user** that an active
   Hostinger hosting plan is required, link
   https://www.hostinger.com/web-hosting, and offer to keep building locally in
   the meantime. When they confirm the purchase, re-run this check.

This is a normal state for a new account, not an error. Never purchase a plan,
a domain, or any paid item without the user explicitly approving that specific
purchase.

## 2. Choose the domain

- **Default: free subdomain.** `hosting_generateAFreeSubdomainV1` returns a
  `*.hostingersite.com` domain. No verification needed. Tell the user a custom
  domain can be connected later.
- **A domain the user already owns:** `hosting_verifyDomainOwnershipV1` first.
  If it comes back inaccessible, relay the TXT record it returns, remind them
  propagation can take about 10 minutes, and re-verify before continuing.
  Adding that TXT record is a `domains` task if the domain's DNS is at
  Hostinger.
- **Buying a new domain:** not this skill. Route to `domains`, which
  owns `domains_checkDomainAvailabilityV1` and `domains_purchaseNewDomainV1`,
  and which applies the two-confirmation billable gate.

## 3. Create the website and wait for it

Generating a subdomain does **not** create a website — deploying straight to it
fails with `No website found for domain`. The working sequence:

1. `hosting_createWebsiteV1 { domain, order_id }`. `datacenter_code` is required
   only for the first website on a brand-new plan; pick the first entry from
   `hosting_listAvailableDatacentersV1`, which is ordered best-match first.
   The domain cannot start with `www.`.
2. **Poll** `hosting_listWebsitesV1` filtered by the domain until the site
   appears. Creation takes up to a few minutes — poll with backoff, don't fail
   fast.
3. Note the site's `username`. Deployment, database, PHP and cron tools are all
   keyed on it.

If the domain already has a website — the user pointed at an existing site, or
this is a repeat run — skip creation entirely. Never re-provision a site that
exists.

## 4. Optional extras (only when the run needs them)

- **Database:** `hosting_createAccountDatabaseV1` for Node.js apps that need
  MySQL. Pass the credentials to the app through its environment or config,
  never hard-coded into client-side code. The name and user are automatically
  prefixed with the account username if you omit the prefix.
- **DNS records for a custom domain:** `domains` owns these. Ask that
  skill to take a snapshot before any destructive record change.
