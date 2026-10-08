---
name: vibe-serverless
description: "Audit, fix or verify serverless and edge invocation lifetime, duplicate events, environment reuse and provider runtime limits. Use for existing Lambda/Workers or similar runtime defects; SSR/hydration belongs to vibe-web."
---

# Serverless & edge

Read [the shared workflow](../../references/workflow.md) once, then the recipe matching the operation. Establish the provider, trigger and runtime configuration before selecting checks.

| Request | Recipe |
|---|---|
| Inspect invocation and side-effect ownership | [Serverless Runtime Audit](references/serverless-runtime-audit.md) |
| Repair an evidenced runtime boundary | [Serverless Runtime Polish](references/serverless-runtime-polish.md) |
| Verify completion, reuse or redelivery | [Serverless Invocation Check](references/serverless-invocation-check.md) |

Use [runtime boundaries](../../references/serverless-runtime.md) for the actual provider. Rendering/serialization belongs to [Web](../vibe-web/SKILL.md), provisioning plans to [Terraform](../vibe-terraform/SKILL.md). Do not create a cloud deployment to inspect existing code.
