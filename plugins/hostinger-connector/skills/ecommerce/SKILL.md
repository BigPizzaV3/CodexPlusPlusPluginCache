---
name: ecommerce
description: Use when the user wants a Hostinger online store — creating a store, adding physical or digital products, setting flat-rate shipping, enabling a manual payment method, checking whether the store is ready to take orders, and creating or updating a custom sales channel so a frontend you built can serve the catalog and a hosted checkout. Not for WooCommerce, which is a WordPress plugin.
---

# Ecommerce

Binary: **`hostinger-ecommerce-mcp`** — every tool named `ecommerce_*`.

Run the `hostinger` router first. Its safety gates apply to everything here.

**This is a Hostinger store, not WooCommerce.** WooCommerce is a WordPress
plugin and is managed through the WordPress tools in `websites`. If the user has
a WooCommerce site and asks for products, they mean that one — say so rather than
creating a second, unrelated store here.

## Order of operations

The steps depend on each other, and doing them out of order produces a store
that looks finished but cannot take an order:

1. `ecommerce_getStoresV1` — **check for an existing store first.** Never create
   a second store for an account that already has one unless the user says
   that is what they want.
2. `ecommerce_createStoreV1` — creates the store and a primary sales channel
   alongside it.
3. Products: `ecommerce_createPhysicalProductV1` or
   `ecommerce_createDigitalProductV1`. Each creates a published product with a
   single variant. A digital product takes an optional external download link.
4. `ecommerce_setStoreShippingV1` — flat-rate shipping, creating the zone if it
   does not exist. **Physical products need this**; without it a customer cannot
   complete checkout. Digital products do not.
5. `ecommerce_enableManualPaymentMethodV1` — lets the store accept orders without
   an online payment provider. See the warning below.
6. `ecommerce_getStoreMetadataV1` — readiness check: whether payment methods and
   shipping are configured, plus the default currency. **Run this before telling
   the user the store is live**, and report what it says rather than assuming.

## Currency and prices

Products are priced in the **store currency**, which comes from
`ecommerce_getStoreMetadataV1`. Read it before creating a product — a price
entered against the wrong currency is a live mispricing that customers can order
against. Confirm the currency with the user when creating the first product.

## Manual payment is not online payment

`ecommerce_enableManualPaymentMethodV1` means the store accepts an order and the
merchant collects money **some other way** — a bank transfer, cash on delivery,
an invoice. Nothing is charged automatically. Say that explicitly when enabling
it, because "payments enabled" reads as "customers can pay by card" and it does
not. Connecting a real payment provider happens in hPanel, not through these
tools.

## Custom sales channels — for a frontend you built

A custom sales channel is how a separately deployed frontend serves the store's
catalog while checkout, orders and shipping stay with Hostinger.

- `ecommerce_listSalesChannelsV1` — existing channels and their metadata.
- `ecommerce_createCustomSalesChannelV1` — create one for a frontend you built.
- `ecommerce_updateSalesChannelV1` — change the merchant-facing `name` and the
  public `url`, which is returned as the channel's `domain`.
- `ecommerce_getCustomStorefrontSetupInstructionsV1` — **read this before writing
  any frontend code.** It returns the actual, current integration steps as
  Markdown. Follow them rather than reconstructing an integration from memory;
  the contract can change and the instructions are authoritative.

The channel `url` must be the address the storefront is really served from. A
mismatch breaks the checkout hand-off, which fails at the worst possible moment —
after the customer has picked something.

## Products are published immediately

Both create tools produce a **published** product. There is no draft state here,
so a product created to try something out is publicly visible and orderable the
moment it exists. Confirm name, price and currency before creating, and do not
create throwaway test products on a store that is taking real orders.

## The destructive one

`ecommerce_deleteStoreV1` soft-deletes a store: the underlying data is preserved
but the store is marked deleted, which takes the storefront and its checkout
offline. Two confirmations, never batched. Name the store, say what stops working
— the storefront, any custom sales channel pointing at it, and the ability to
take orders — and say that undoing it is a support request, not a tool call.

## Full tool list

Stores: `ecommerce_getStoresV1`, `ecommerce_createStoreV1`,
`ecommerce_getStoreMetadataV1`, `ecommerce_deleteStoreV1`

Products: `ecommerce_createPhysicalProductV1`,
`ecommerce_createDigitalProductV1`

Checkout: `ecommerce_setStoreShippingV1`,
`ecommerce_enableManualPaymentMethodV1`

Sales channels: `ecommerce_listSalesChannelsV1`,
`ecommerce_createCustomSalesChannelV1`, `ecommerce_updateSalesChannelV1`,
`ecommerce_getCustomStorefrontSetupInstructionsV1`
