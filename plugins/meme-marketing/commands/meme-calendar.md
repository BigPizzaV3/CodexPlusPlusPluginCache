---
description: Plan a varied meme content calendar (BATCH route)
argument-hint: "<brand/product> <audience> <duration, e.g. 2 weeks> [dialect] [platforms]"
---

Use the meme-marketing skill in BATCH mode:

$ARGUMENTS

1. Delegate moment mining to the `meme-moment-miner` subagent once for the whole calendar, passing the skill root path.
2. Spread posts across brand roles (`none`, `prop`, `character`, `product_forward`) with most posts at `none` or `prop`.
3. Never repeat a humor mechanic or visual form in consecutive posts.
4. Send the full calendar to the `meme-bineval-critic` subagent and apply its repairs.
5. Return a table: date, platform, moment, mechanic, form, brand role, caption, on-image text. Offer to save it as a batch JSON following `references/output-contract.md`.
