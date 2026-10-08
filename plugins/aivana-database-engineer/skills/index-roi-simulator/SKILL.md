---
name: index-roi-simulator
description: Ranks index candidates by read benefit, write penalty, storage cost, and maintenance risk.
---

# Index ROI Simulator

Run:

```bash
node runtime/runTool.js index_roi_simulator '{"candidates":[{"id":"idx_events_user_email","readBenefitMs":180,"readQps":40,"writePenaltyMs":3,"writeQps":8,"storageMb":512}]}'
```

Returns ranked candidates, ROI score, break-even signal, and benchmark recommendation.
