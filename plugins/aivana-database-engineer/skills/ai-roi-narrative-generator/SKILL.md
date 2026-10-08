---
name: ai-roi-narrative-generator
description: Explain database tuning ROI from supplied measurements and explicitly labeled estimates.
---

# ai_roi_narrative_generator

Use this skill to translate AI database operations evidence into an executive ROI narrative.

Governance:
- Narrative and scoring only.
- Keep ROI claims tied to provided evidence.
- Do not present estimates as audited finance results.

Output contract:
- `usp: "ai_roi_narrative_generator"`
- `executiveNarrative`, `roiSignals`
- `evidence`, `confidence`, `source: "analysis"`
