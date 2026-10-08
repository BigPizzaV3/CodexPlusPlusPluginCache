---
name: decision-evidence-compiler
description: Builds an executive-grade decision evidence packet from runtime signals and confidence checks.
---

# Decision Evidence Compiler

## Use when
- A dry-run recommendation needs an approval-ready evidence packet.

## Governance
- Missing evidence must be explicit.
- Confidence must be stated separately from recommendation.

## Output
- `executivePacket`, `missingEvidence`, `confidence`, `safeNextAction`
