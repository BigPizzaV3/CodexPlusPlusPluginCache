---
name: recommendation-ranker
description: Rank SQL performance recommendations by expected impact, operational risk, and implementation effort.
---

# Recommendation Ranker

Run:

```bash
node runtime/runTool.js recommendation_ranker '{"recommendations":[{"id":"narrow_projection","impact":"medium","risk":"low","effort":"low"}]}'
```

Returns ranked recommendations and score rationale.
