---
name: gstack
description: Route software product, planning, review, QA, debugging, design, security, release, documentation, browser, iOS, and safety requests to the right gstack workflow.
---

# gstack Router

Route a request to the smallest matching gstack Skill. If the user names a Skill directly, use it. For a complex delivery request, chain only the phases needed and keep planning, mutation, verification, and release gates distinct.

## Routing rules

1. Start with intent, not keywords.
2. Prefer one specialist Skill for a bounded request.
3. For a build request with material ambiguity or cross-module impact, use `spec` or the relevant plan review before implementation.
4. For defects, use `investigate` before fixing when root cause is unclear.
5. Use `review` before landing material changes.
6. Use `qa-only` when the user wants findings without edits, and `qa` when fixes are explicitly in scope.
7. Use safety Skills as constraints around another workflow, not as substitutes for it.
8. Native browser, pairing, gbrain, and iOS workflows require compatible local capabilities. Never simulate them.

## Available workflows

- `office-hours`: Reframe a product idea before implementation begins.
- `plan-ceo-review`: Challenge a plan from product and company-value angles before implementation.
- `plan-eng-review`: Review architecture, data flow, failure modes, edge cases, and test strategy before coding.
- `plan-design-review`: Review product and interface design dimensions before implementation.
- `plan-devex-review`: Review developer experience, time to first success, friction, and persona paths.
- `plan-tune`: Tune when the workflow should ask questions versus proceed with safe assumptions.
- `autoplan`: Run coordinated product, design, engineering, and developer-experience plan reviews.
- `design-consultation`: Create or refine a design system and its implementation guidance.
- `spec`: Turn vague intent into a precise executable specification with acceptance criteria.
- `review`: Review a change before landing and find defects that can pass CI but fail in production.
- `codex`: Provide a second-opinion code or plan review using available Codex reasoning and workspace evidence.
- `investigate`: Run systematic root-cause investigation before proposing a fix.
- `design-review`: Audit an implemented interface against design quality, usability, and consistency criteria.
- `design-shotgun`: Generate and compare several materially different design directions before selecting one.
- `design-html`: Create production-oriented HTML and CSS from an approved design direction.
- `devex-review`: Audit a real developer workflow and measure friction against the actual path.
- `qa`: Run end-to-end QA, fix authorized defects, and re-verify them when host tools permit.
- `qa-only`: Run end-to-end QA and report findings without changing code.
- `scrape`: Extract structured data from a web page using the safest available browser or web capability.
- `skillify`: Convert a proven repeatable workflow into a reusable Skill with clear triggers and checks.
- `ship`: Prepare a change for delivery by checking tests, review evidence, repository state, and release steps.
- `land-and-deploy`: Land an approved change, observe CI and deployment, and verify production health when host access permits.
- `canary`: Run post-deploy checks and surface regressions after a release.
- `landing-report`: Summarize delivery status and release queue state without modifying anything.
- `document-release`: Update release-facing documentation to match shipped behavior.
- `document-generate`: Generate practical documentation from code and verified behavior.
- `setup-deploy`: Inspect a repository and establish deployment configuration guidance without inventing provider details.
- `gstack-upgrade`: Check and update an installed native gstack runtime only when the host can execute local commands and the user authorizes it.
- `context-save`: Save concise project context, decisions, git state, and remaining work into the workspace when writing is available.
- `context-restore`: Restore saved project context and verify it against the current repository state.
- `learn`: Capture, inspect, and maintain project learnings backed by observed evidence.
- `retro`: Produce a retrospective from repository evidence, delivery outcomes, and recorded learnings.
- `health`: Assess codebase health using available type checks, linting, tests, dead-code signals, and repository evidence.
- `benchmark`: Measure performance and compare against a known baseline using available execution or browser tools.
- `benchmark-models`: Compare model performance on the same bounded workflow with explicit scoring criteria.
- `cso`: Perform an evidence-backed security review using OWASP and STRIDE-oriented checks.
- `setup-gbrain`: Configure gbrain integration only when the native local runtime and required credentials are available.
- `sync-gbrain`: Refresh gbrain project context only when the native local runtime is available and the user authorizes the sync.
- `browse`: Drive the native gstack browser when available; otherwise use host browser capabilities without pretending gstack is running.
- `open-gstack-browser`: Open the native visible gstack browser only on a compatible local host.
- `setup-browser-cookies`: Import browser cookies into native gstack only with explicit user authorization on a compatible local host.
- `pair-agent`: Pair an authorized agent with native gstack browser access while preserving scope and revocation controls.
- `ios-qa`: Run QA on a real iOS device only when a compatible local device bridge is available.
- `ios-fix`: Investigate and fix iOS defects with regression checks on a compatible local device workflow.
- `ios-design-review`: Review an iOS interface against Apple platform conventions using real device evidence when available.
- `ios-clean`: Remove development-only iOS bridge wiring before release after verifying the target scope.
- `ios-sync`: Regenerate native iOS debug bridge artifacts only on a compatible local host.
- `careful`: Apply an extra safety check before destructive or difficult-to-reverse operations.
- `freeze`: Restrict requested edits to an explicitly named directory or scope.
- `guard`: Combine destructive-operation checks with a strict edit scope.
- `unfreeze`: Remove a previously established edit-scope restriction when the user explicitly requests it.
- `make-pdf`: Turn markdown or structured content into a PDF using the host document or Python capabilities when available.
- `diagram`: Create a technical diagram from a textual description and return editable source when the host supports artifacts.

## Host portability

The original gstack project contains local runtime features. This plugin keeps its public workflow names and intent but maps operations to ChatGPT/Codex host capabilities. When a compatible original gstack install exists on Codex, specialist Skills may defer to the current installed upstream workflow for native execution.
