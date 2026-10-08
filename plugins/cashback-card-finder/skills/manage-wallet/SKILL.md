---
name: manage-wallet
description: Save, update, list or clear the set of credit cards a user holds, so card recommendations do not have to ask every time. Use when the user says which cards they have, asks to remember or forget a card, wants to see their saved cards, or reports that a spending cap or rotating category has changed.
---

# Manage Wallet

Keep a small local file of which cards the user holds, so `find-best-cashback` can answer "which card at Shell?" without re-asking.

## What goes in the file

Product identities and reward-relevant state. Nothing else.

Store: card ids, the user's country, chosen categories, activation status, and cap usage they have told you about.

**Never store**: card numbers, CVV, expiry dates, PINs, names as they appear on the card, credit limits, balances, statement PDFs, or login credentials. This file is plain text on disk. If the user offers a card number, tell them you do not need it and that the product name is enough.

## Location

`~/.cashback-wallet.json` — expand `~` yourself; the engine does not.

## Format

```json
{
  "version": 1,
  "country": "US",
  "updated": "2026-07-25",
  "cards": [
    {"id": "amex-bcp", "nickname": "the blue one"},
    {"id": "chase-freedom-flex", "activated": true,
     "cap_used": {"chase-rotating": 1200},
     "note": "Q3 rotating category is gas stations"},
    {"id": "boa-customized-cash", "chosen_category": "online_retail"}
  ]
}
```

Card ids come from the catalog:

```bash
python ../find-best-cashback/scripts/rank_cards.py --list-cards US
```

If the user names a card that is not in the catalog, still save it — record what they told you so it is not lost:

```json
{"id": "local-credit-union-visa", "in_catalog": false,
 "user_terms": "2% everywhere, no annual fee, told to me 2026-07-25"}
```

`find-best-cashback` will pass that through as an inline card definition rather than dropping it.

## Reading it

Read the file before asking the user which cards they hold. If it does not exist, ask once and offer to save the answer — do not save without being asked or agreeing first.

## Writing it

Rewrite the whole file; do not append. Always set `updated` to today.

Before overwriting an existing wallet, read it and confirm what changes: adding a card is safe to just do, but removing or replacing the list should be echoed back ("dropping the Discover it, keeping the other three — right?").

## Cap and activation state goes stale

`cap_used` and `activated` are true on the day they were written and drift immediately afterwards. When a saved value is more than a few weeks old, or when the calendar has crossed into a new quarter, treat it as unknown and re-ask rather than computing on it. A confidently wrong cap number produces a confidently wrong recommendation.

Rotating categories reset quarterly. A saved `activated: true` from last quarter means nothing this quarter.

## Clearing

If the user asks you to forget their cards, delete the file rather than emptying it, and confirm afterwards that it is gone.
