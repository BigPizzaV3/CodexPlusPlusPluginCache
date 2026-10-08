---
name: find-best-cashback
description: Work out which credit card in someone's wallet earns the most on a purchase at a named store - Shell, Target, Walmart, Costco, Amazon, Swiggy, Tesco, a restaurant, a supermarket. Use when the user names a merchant and asks which card to use, what earns the most cashback or rewards there, how a store is likely to code, why a card did not earn a bonus rate, or which new card would be best for a merchant they shop at often. Covers the US, India and the UK.
---

# Find Best Cashback

Answer one question precisely: **for this purchase, at this merchant, in this country, which card in this wallet nets the most money?**

The hard part is not arithmetic. It is that a card's headline rate frequently does not apply — because the merchant codes as a superstore, because a cap is already used up, because the category was never activated, or because the points are worth less than a cent. This skill exists to catch those cases.

## The one rule that matters

**Never state a reward rate from memory.** Every rate you quote comes from one of three places, and you must say which:

| Source | How to label it |
| --- | --- |
| Live issuer page you just read | "verified today at [link]" |
| Bundled catalog in `data/` | "catalog snapshot from *as_of*, worth confirming" |
| The user told you | "per the terms you gave me" |

If a number decides the recommendation and you could not verify it, say so in the answer. Do not launder a stale rate into a confident sentence.

## Step 1 - Get the four inputs

You need: **merchant**, **country**, **cards held**, and — only when it changes the answer — **amount** and **channel**.

- Country: infer from context if the signal is strong (₹ or a named Indian merchant → India). Otherwise ask.
- Cards: check for a saved wallet first (see *Wallet* below). If none exists, ask for **card product names only**.
- Amount: ask only when a cap, a fixed-value offer, a minimum spend, or a fee could change the winner. For "which card at Shell?" a representative amount is fine — say which you assumed.
- Channel: ask when the merchant codes differently by channel and the difference flips the winner. `--explain-merchant` tells you when that is true.

Ask at most one consolidated question. Never request a card number, CVV, expiry, PIN, login, or statement. If the user pastes one, tell them to rotate nothing but redact it, and continue from the product name alone.

## Step 2 - Resolve how the merchant codes

```bash
python scripts/rank_cards.py --explain-merchant walmart --country US
```

This returns the spend categories, likely MCCs, a confidence level, and the known traps for that merchant. Read the caveats — they are the substance of a good answer.

If the merchant is not in the table, research it or ask the user how similar purchases have posted before. Do not guess a category from the brand name alone.

Merchant category codes are set by the merchant's acquiring bank, not by the card issuer. A franchise location, a separate fuel forecourt, an in-app payment, or a third-party delivery order can all code differently from the flagship store. Say "likely to code as", never "codes as".

## Step 3 - Score the wallet

Build a request and run the engine. Do not do this arithmetic in your head — caps, slabs, point values and fees interact in ways that are easy to get wrong.

```bash
python scripts/rank_cards.py request.json
```

```json
{
  "purchase": {
    "merchant": "shell", "channel": "pump", "amount": 60,
    "country": "US", "currency": "USD"
  },
  "wallet": [
    "amex-bcp",
    {"id": "chase-freedom-flex", "activated": true,
     "cap_used": {"chase-rotating": 1200}},
    {"id": "discover-it", "offers": [
      {"label": "10% back up to $15", "type": "percent", "value": 10, "cap": 15}]}
  ]
}
```

Run `--help` for the full schema and `--list-cards US` for the available ids. A card the user holds that is not in the catalog is reported as `unknown` rather than scored — research its terms and pass them inline as a `card` object, or ask the user.

The engine deliberately refuses to invent anything. What it hands back:

- `net_reward` — bonus earning + base earning + stacked offers − fees
- `applied_rule` and `rules_rejected` — *why* each card landed where it did
- `cap_binding` — the bonus rate ran out partway through this purchase
- `earning_blocked` — the card earns nothing here (Indian fuel, unaccepted network)
- `confidence` — the weakest link across merchant coding, rule certainty and data age

Pass `cap_used`, `activated` and `offers` whenever the user has told you about them. Assuming an unactivated rotating category is live, or that a monthly cap is untouched, is the most common way this answer goes wrong.

## Step 4 - Verify before you commit

Verify live when the recommendation is decided by a rate whose catalog confidence is `low` or `medium`, when the data is stale, when the user is about to make a large purchase, or when they ask you to be certain.

Prefer the issuer's own benefits page, rewards terms, or the offer's terms. Use blogs and forums to *find* a candidate or to understand ambiguous coding — never as the final authority on a rate. Record what you checked and when.

Never sign in, activate an offer, apply for a card, or change an account. Tell the user what to click; let them click it.

## Step 5 - Answer

Lead with the verdict, in one line:

> **Use the Blue Cash Preferred — about 3% back, ≈$1.80 on a $60 fill-up.**

Then, briefly:

- **Why it wins** — the rule that applied, in plain words.
- **Runner-up** and what it would have earned, so the user can judge whether it is worth caring.
- **What would change this** — the cap, activation, channel, or coding risk that could flip it. Only list ones that realistically could.
- **Confidence and date** — where the numbers came from and when they were checked.

Keep it to a short paragraph and a few bullets. A wallet-sized answer beats a table of every card.

### Say what you actually know

- Rates and money: "about 3%", "roughly $1.80" — the underlying rate is exact, the coding is not.
- Coding: "likely codes as a gas station", "Supercenters are normally excluded from grocery categories".
- Points: always state the assumed value. "4x Membership Rewards, worth about $3.60 if you transfer to airline partners — closer to $2 as a statement credit."
- Ties under a cent: say they are tied and break it on redemption friction, not on the decimal.
- Never say a card is "the best card" without a scope. It is best *for this purchase, at this merchant, in this country, among these cards*.

### Things that are easy to get wrong

- A card that misses the bonus category still earns its base rate. It is not disqualified.
- Instant checkout discounts (Target Circle Card) are not the same as accrued cashback, and annual redemption certificates (Costco) are not spendable today. Flag the difference.
- An annual fee belongs to the card, not to one purchase. Never amortise it into a single transaction — but do include it when comparing a card the user might newly open.
- In India, most cards earn **zero** on fuel and instead waive a 1% surcharge within a monthly cap. The right answer at a petrol pump is usually "the one that waives the surcharge", not "the one with the best rate".
- Welcome bonuses are not ongoing cashback. Keep them in a separate sentence if you mention them at all.

## Market-wide mode

Only when the user asks for a *new* card — "what card should I get for groceries?" — widen to the whole catalog plus live research. In that mode include the annual fee, a realistic break-even at the user's stated spend, and any membership or eligibility constraint. Say plainly when the honest answer is "your current card is fine; a new one would not pay for itself".

You are not a licensed financial adviser. Comparing published reward terms is fine. Telling someone whether to open a credit line, carry a balance, or restructure their finances is not — say so and stop.

## Wallet

If a saved wallet exists at `~/.cashback-wallet.json`, read it instead of asking. See the `manage-wallet` skill for the format and for adding, updating, or clearing cards. Never write card numbers to it — product ids only.

## References

- [merchant-coding.md](references/merchant-coding.md) — how specific store types behave and why
- [data-schema.md](references/data-schema.md) — the catalog format, for adding a card or merchant
