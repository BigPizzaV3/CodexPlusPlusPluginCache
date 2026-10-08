---
name: vibe-ai
description: "Frame, audit or improve an existing AI feature, RAG pipeline, OCR flow, agent tools, ML pipeline, evaluation, model serving or AI governance. Select the actual model/data/tool boundary."
---

# AI, RAG & ML

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [AI Evaluation Audit](references/ai-evaluation-audit.md) | audit |
| [AI Evaluation Polish](references/ai-evaluation-polish.md) | implement |
| [AI Feature Audit](references/ai-feature-audit.md) | audit |
| [AI Feature Polish](references/ai-feature-polish.md) | implement |
| [AI ML Problem Framing](references/ai-ml-problem-framing.md) | plan |
| [AI Safety & Governance Audit](references/ai-safety-governance-audit.md) | audit |
| [AI Safety & Governance Polish](references/ai-safety-governance-polish.md) | implement |
| [LLM Agent Tools Audit](references/llm-agent-tools-audit.md) | audit |
| [LLM Agent Tools Polish](references/llm-agent-tools-polish.md) | implement |
| [ML Pipeline Audit](references/ml-pipeline-audit.md) | audit |
| [ML Pipeline Polish](references/ml-pipeline-polish.md) | implement |
| [Model Serving & Monitoring Audit](references/model-serving-monitoring-audit.md) | audit |
| [Model Serving & Monitoring Polish](references/model-serving-monitoring-polish.md) | implement |
| [OCR Document AI Audit](references/ocr-document-ai-audit.md) | audit |
| [OCR Document AI Polish](references/ocr-document-ai-polish.md) | implement |
| [RAG Audit](references/rag-audit.md) | audit |
| [RAG Polish](references/rag-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.

Use [MCP](../vibe-mcp/SKILL.md) for protocol/transport conformance and [Harness](../vibe-harness/SKILL.md) for durable execution/checkpoint recovery. This skill owns model decisions, grounding and tool-selection quality.

For a verification-only request, apply the relevant audit recipe to the stated acceptance criteria and report the measured result and gaps. Verification alone does not authorize implementation; a separate check recipe is not required.
