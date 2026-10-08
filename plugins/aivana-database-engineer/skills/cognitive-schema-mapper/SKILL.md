---
name: cognitive-schema-mapper
description: Infer candidate business concepts from supplied database schema metadata.
---

# cognitive_schema_mapper

Use this skill to map database schema names and domain terms into a business ontology for AI reasoning.

Governance:
- Analysis-only semantic mapping.
- Do not infer sensitive data access permissions.
- Flag domain terms that lack schema evidence as semantic gaps.

Output contract:
- `usp: "cognitive_schema_mapper"`
- `ontology`, `semanticGaps`, `recommendations`
- `evidence`, `confidence`, `source: "analysis"`
