---
name: cross-agent-consensus-builder
description: Compare supplied advisor recommendations and report agreement and unresolved disagreements.
---

# cross_agent_consensus_builder

Use this skill to combine performance, cost, security, compliance, and rollout agent findings into a consensus packet.

Governance:
- Analysis-only consensus.
- Preserve disagreements instead of hiding them.
- Disagreement should defer to more evidence or human review.

Output contract:
- `usp: "cross_agent_consensus_builder"`
- `consensus`, `disagreements`, `decision`
- `evidence`, `confidence`, `source: "analysis"`
