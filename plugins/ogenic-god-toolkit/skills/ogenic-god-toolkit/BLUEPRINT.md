# OGENIC GOD TOOLKIT — Master Blueprint

## One toolkit, four capability groups

The user invokes one toolkit. The router inspects the request and automatically selects one or more capability groups. The user does not need to remember group names.

### 1. Code Skill
Agent orchestration and GOD MODE capability. Owns request classification, tool discovery, routing, sequencing, state reuse, and result verification.

### 2. Code System
Workspace, repository, file/search/patch, Git inspection, development lifecycle, test/lint/typecheck/build, process/shell/Codex, system health.

### 3. Code Delivery
GitHub CI/CD, hosted runners, n8n, deployment, scheduler, authenticated webhook/outbound integration, connector execution, post-deploy verification.

### 4. Code Website
Website/browser/UI operation, DOM/accessibility/input/vision/window routing, Cloudflare and web deployment workflows, website verification.

## Router contract

1. Receive one natural-language request.
2. Inspect connected execution surfaces and current state.
3. Classify required capability groups (one or many).
4. Select the smallest set of tools/skills needed.
5. Execute in dependency order.
6. Reuse fetched state and batch independent reads when safe.
7. Verify writes, diffs, tests, builds, deploys or remote state as applicable.
8. Return concise Result / Blocked / Next output.

## Routing examples

- “Fix the site and deploy” → Code Website + Code System + Code Delivery.
- “Review this repository and patch the bug” → Code Skill + Code System.
- “Build an n8n connector and deploy it” → Code System + Code Delivery.
- “Inspect a workflow, patch the code, and deploy it” → Code Skill + Code System + Code Delivery.
- “Repair a website and verify the live result” → Code Website + Code System + Code Delivery.

## Execution surfaces

Prefer: connected first-party/app tool → GitHub/CI/n8n/authorized cloud runner → local bridge when genuinely required → explicit connector/bridge-required result.

## Source of truth

- Master operator: `skills/god-mode/SKILL.md`
- This blueprint: `skills/ogenic-god-toolkit/BLUEPRINT.md`
- OGENIC Registry remains a separate registry/status interface unless its write/execution contract is explicitly upgraded.

## Tool creation blueprint

Create one tool identity named `OGENIC GOD TOOLKIT`. Its description should say that it automatically routes software, system, delivery, and website requests across four capability groups. Do not expose four separate tools merely for category selection. Category selection is internal routing. The tool may chain multiple groups for a single request.

Recommended invocation intent: inspect, edit, build, test, deploy, automate, operate websites, connect services, or diagnose systems.
