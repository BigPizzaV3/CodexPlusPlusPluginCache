# Catalog schema

Two data files drive the engine. Both are snapshots to be verified, never authorities.

Run `python scripts/test_rank_cards.py` after any edit — it validates structure, vocabulary, cap bases, unique ids, and that every rule is reachable.

## `data/merchants.json`

Maps a store name onto spend categories and likely MCCs, split by purchase channel.

```json
"walmart": {
  "display_name": "Walmart",
  "countries": ["US", "CA"],
  "aliases": ["wal-mart", "walmart.com"],
  "default_channel": "in_store",
  "variants": {
    "in_store": {
      "categories": ["superstore"],
      "mcc": ["5310", "5311"],
      "confidence": "high",
      "caveats": ["Codes as a discount store, which grocery categories exclude."]
    },
    "neighborhood_market": {
      "merchant_id": "walmart-neighborhood-market",
      "display_name": "Walmart Neighborhood Market",
      "categories": ["grocery"],
      "mcc": ["5411"],
      "confidence": "medium"
    }
  },
  "caveats": ["Applies to every channel."]
}
```

- The top-level key must be a slug: lowercase, hyphen-separated.
- `categories` must come from `category_vocabulary` at the top of the file.
- `confidence` is how sure you are the coding is right: `high` (verified, stable), `medium` (usually true, varies by location), `low` (genuinely uncertain).
- `merchant_id` on a variant gives that store format its own identity, so a rule that excludes `walmart` by name does not also catch the Neighborhood Market. Use it whenever issuers treat a format as a separate merchant.
- Caveats on a variant apply to that channel; caveats on the merchant apply to all of them. Both reach the final answer, so write them as sentences a user could read.

## `data/cards-<country>.json`

One file per ISO country code. `UK`, `USA`, `India` and a few other spellings are aliased in the engine.

```json
{
  "id": "amex-bcp",
  "name": "American Express Blue Cash Preferred",
  "issuer": "American Express",
  "network": "amex",
  "currency": "USD",
  "reward_type": "cashback",
  "point_value_cents": 1.8,
  "annual_fee": 95,
  "base_rate": 1,
  "base_unit": "percent",
  "base_label": "1% everything else",
  "foreign_transaction_fee_percent": 2.7,
  "no_earn_categories": ["fuel_india"],
  "surcharge_waiver": {"categories": ["fuel_india"], "min_txn": 400,
                       "max_txn": 5000, "cap_per_cycle": 250},
  "minimum_redemption": 25,
  "as_of": "2026-05",
  "source": "https://...",
  "rules": [ ... ],
  "notes": "Free-text context that reaches the final answer."
}
```

`as_of` and `source` are not optional in practice. Once `as_of` is more than 120 days old the engine drops that card's confidence to `low` and tells the user the number needs checking — which is the behaviour you want, so keep dates honest rather than refreshing them without re-checking.

### Rules

A rule is one bonus category. Rules do **not** stack; the engine applies the single highest-paying rule that matches, then the base rate on whatever spend is left over.

```json
{
  "id": "supermarkets",
  "label": "6% U.S. supermarkets",
  "unit": "percent",
  "rate": 6,
  "match": {"categories": ["grocery"], "merchants": [], "mcc": [], "channels": []},
  "excludes": {"categories": ["superstore"], "merchants": ["walmart"], "mcc": []},
  "cap": {"basis": "spend", "amount": 6000, "period": "year",
          "shared_key": "amex-bcp-grocery"},
  "activation_required": false,
  "confidence": "high",
  "note": "Reaches the user verbatim - write it for them, not for yourself."
}
```

**Matching.** `excludes` is evaluated first, so a user gets "Walmart is excluded from this category" instead of a vague miss. Within `match`, `categories` and `merchants` are an **OR** (a rule can cover "dining, plus Starbucks anywhere"), while `mcc` and `channels` are additional **AND** filters. Every rule needs at least one matcher or the validator rejects it.

**Units.**

| `unit` | Meaning | Cash value |
| --- | --- | --- |
| `percent` | straight cashback | `spend × rate / 100` |
| `points_per_unit` | N points per currency unit | `spend × rate × point_value / 100` |
| `points_per_slab` | N points per fixed slab of spend | `floor(spend / slab) × rate × point_value / 100` |

`points_per_slab` matters for Indian cards: "5 points per ₹150" on a ₹1,490 purchase earns 45 points, not 49.67. The flooring is real money lost and the engine models it.

**Caps.** `basis` is one of:

- `spend` — bonus rate applies until N of spend; the remainder drops to base.
- `reward_cash` — payout is capped at N of cash back.
- `points` — payout is capped at N points.

`shared_key` is how two rules share one cap (Bank of America's combined quarterly cap, for example). It is also the key the caller uses to report how much is already used: `cap_used`, `cap_used_cash`, `cap_used_points`.

**`activation_required`** means the rule is skipped unless the caller passes `activated: true`. Use it for rotating quarterly categories and anything the user has to opt into. Skipping it silently inflates the estimate, which is worse than being vague.

### Card-level fields worth using

- `no_earn_categories` — the card earns *nothing* here, not merely no bonus. Indian fuel, rent and wallet loads are the usual cases.
- `surcharge_waiver` — models the Indian fuel surcharge waiver. Pair it with `surcharge_percent` on the purchase.
- `point_value_cents` — value of one point in 1/100 of the card currency, so `100` means one point is worth one rupee. Be conservative and explain the assumption in `notes`; a 4x card at 0.3c is worse than a 2% card, and users are routinely misled about this.
- `minimum_redemption` — flags cards whose rewards are not usable in small amounts.

## Adding a card

1. Read the issuer's own terms page. Not a blog, not a comparison site.
2. Write the rules, one per bonus category, exclusions included.
3. Set `as_of` to the date you actually read the page.
4. Set `confidence` honestly per rule — `low` is a useful signal, not a failure.
5. Put anything a user would want to know in `note` or `notes`; both reach the final answer.
6. Run the tests.

A `low`-confidence rule with a clear note is more useful than a `high`-confidence rule that is quietly wrong.
