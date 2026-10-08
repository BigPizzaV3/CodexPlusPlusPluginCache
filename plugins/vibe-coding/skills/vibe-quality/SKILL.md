---
name: vibe-quality
description: "Audit test coverage or release readiness, improve an existing test harness, or verify visual regressions. For review of a concrete diff use vibe-review."
---

# Quality & readiness

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

This covers verification quality and release assessment. It does not grant release/deployment permission. A visual result needs rendered evidence; code inspection alone is not visual verification.

## Recipes

| Recipe | Operation |
|---|---|
| [Release Readiness Audit](references/release-readiness-audit.md) | audit |
| [Test Coverage Audit](references/test-coverage-audit.md) | audit |
| [Test Harness Polish](references/test-harness-polish.md) | implement |
| [Visual Regression Check](references/visual-regression-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
