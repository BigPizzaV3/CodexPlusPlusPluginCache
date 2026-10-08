---
name: mollie-upgrade
description: >
  Activate this skill when a developer wants to upgrade their Mollie SDK to a newer
  version, or migrate an existing integration from a deprecated Mollie API to its
  replacement — most commonly migrating from the Orders API to the Payments API.
  This includes: updating @mollie/api-client, mollie-api-php, mollie-api-python, or
  mollie-api-typescript to a newer major version, resolving breaking changes after an
  upgrade, and moving off the Orders API (orderNumber, order lines, Shipments API,
  order cancellation) onto the Payments API (captures, release-authorization,
  unified refunds).
---

# Mollie Upgrade

This is a distinct workflow from `mollie-payments` — that skill builds new
integrations; this one changes existing, working code. Confirm current behavior
with tests before changing anything, and re-verify after.

## Step 1 — Identify the type of upgrade

> Are you updating your Mollie SDK to a newer version, or moving off the Orders API
> to the Payments API?

These require different playbooks — ask before proceeding.

---

## Step 2A — SDK version upgrade

1. **Detect the current version.**
   ```bash
   # Node.js
   npm list @mollie/api-client
   # TypeScript
   npm list mollie-api-typescript
   # PHP
   composer show mollie/mollie-api-php
   # Python
   pip show mollie-api-python
   ```
2. **Find the latest supported version and read its changelog** before touching
   code — do not upgrade blind. Check for a major version bump specifically; minor/
   patch upgrades rarely have breaking changes, major ones usually do.
3. **Identify breaking changes** relevant to this codebase — grep the existing
   integration for methods/fields the changelog flags as renamed or removed, rather
   than assuming nothing broke.
4. **Apply the version bump and required code changes** together, not separately —
   an upgraded dependency with unmigrated call sites will fail at runtime, not at
   install time, for a dynamically-typed language.
5. **Run the existing test suite.** If there isn't one covering the Mollie
   integration, say so explicitly before declaring the upgrade done — this skill
   should not report success on the basis of "the code compiles."
6. **Verify webhooks and payment flows manually in test mode** — create a test
   payment, complete it, confirm the webhook still fires and fulfilment still
   triggers, before recommending a live-mode deploy.

---

## Step 2B — Migrating from Orders API to Payments API

Mollie no longer recommends the Orders API. Payments API is simpler and gets new
features the Orders API doesn't. This is not a drop-in rename — several concepts
don't map 1:1.

### Field and endpoint changes

| Orders API | Payments API | Note |
|---|---|---|
| `orderNumber` | `description` | No dedicated order-number field |
| `lines[].name` | `lines[].description` | |
| Negative amounts on `physical`/`digital`/`shipping_fee`/`surcharge` lines | Not supported | Redesign any discount-via-negative-line logic |
| `consumerDateOfBirth` | Removed | No replacement field |
| `expiresAt` controlling authorization expiry | Removed | Authorization expiry is no longer configurable this way |

### Authorize-then-capture behavior changed

Orders auto-produced an `authorized` status for Klarna/Billie/Riverty. Payments
capture immediately by default — **you must explicitly set `captureMode: 'manual'`**
to keep a hold-then-capture flow. Without this, funds are taken immediately where
the old integration expected a hold. See `<mollie-payments:references/operations/captures.md>`
for the Payments-API capture flow.

### Fulfilment: Shipments API → Captures API

- The Shipments API doesn't exist for standalone Payments — use the Captures API
  instead.
- Captures only work on `authorized`-state payments, are amount-based (not
  line-based), and are asynchronous (status via webhook, not immediate).
- **You cannot use the Captures API on a payment that is still part of an Order** —
  fully migrate that transaction's flow, not just the capture call.

### Cancellation changed

Orders allowed cancelling individual lines or the whole order to release funds.
Payments only support releasing the **full** remaining authorized amount via the
release-authorization endpoint — there is no partial release. If the existing logic
does partial-line cancellation, it has no direct equivalent; flag this to the
developer rather than silently approximating it.

### Refunds consolidated

Orders had two refund paths (via order lines, or via the underlying payment).
Payments API has one — `<mollie-payments:references/operations/refunds.md>` — which
also works against legacy orders' underlying payments.

### Migration steps, in order

1. **Pre-migration gate: check for orders still in `authorized` status.** Those
   can't use the Captures API directly — resolve them under the old flow first.
   Do this before any of the steps below land in production, otherwise those
   orders end up with the old shipment path gone and the new Captures path unable
   to operate on them yet.
2. Replace *create order* calls with *create payment*, adjusting the field
   differences above.
3. Add `captureMode: 'manual'` anywhere a hold-then-capture flow is required.
4. Replace Shipments-API fulfilment logic with Captures-API calls — but only once a
   given transaction is fully off the Orders flow.
5. Replace order/line cancellation with the release-authorization endpoint; flag any
   partial-cancellation logic that has no direct equivalent.
6. Consolidate refund logic onto the single payment-refund endpoint.
7. **Migrate stored references from Order IDs to Payment IDs.** Use `embed=payments`
   on existing List/Get Order calls to find the underlying payment ID and confirm its
   status matches the order's status before cutting over stored references. Run this
   as a pre-deploy backfill, or ship it atomically with steps 2–6 in the same
   release — not after. Steps 2–6 already make the codebase expect Payment IDs; any
   lookup that runs between that deploy and a separately-completed backfill will fail
   against a database that still holds Order IDs.
8. **Webhook caveat**: payments created without a `webhookUrl` under the old Orders
   flow will reference the Order ID in webhook payloads, not a Payment ID — account
   for this if webhook handlers are being updated in the same pass.

---

## Step 3 — Produce a migration summary

Regardless of which path was taken, end with a short summary covering: what version/
API was migrated from and to, which breaking changes were found and how each was
resolved, what was verified (tests run, manual test-mode checks performed), and
anything flagged as needing a design decision rather than a mechanical fix (e.g.
partial-cancellation logic with no equivalent). Don't mark the migration complete if
verification was skipped — say so explicitly instead.
