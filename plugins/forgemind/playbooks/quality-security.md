# Quality, Security, and Experience Evidence

Run relevant automated checks, inspect the diff, review code paths for regressions, and assess secrets, dependencies, authorization, data exposure, misuse, and AI safety. Distinguish passed, failed, blocked, and not-run evidence. Never infer success from workflow intent.

## Experience Evidence Loop

For a user-facing change, define one decisive task and a compact state matrix: loading, empty, error, success, keyboard-only, narrow viewport, and destructive confirmation or recovery when applicable. Reuse the product's components, copy, and interaction conventions; do not invent a parallel design system.

Prove in this order:

1. **Meaning:** accessible names, labels, focus order, keyboard escape routes, status/error announcements, contrast, and touch targets.
2. **Behavior:** component tests for state transitions and a browser test for the critical user task, including an unhappy path.
3. **Appearance:** a screenshot baseline or visual comparison only where layout, rendering, or responsive behavior is material; inspect meaningful diffs rather than accepting pixel noise.
4. **Resilience:** no trapped focus, lost input, duplicate submission, silent failure, hidden destructive action, or inaccessible recovery path.

Record which layers ran, their viewport or browser context, screenshot evidence when used, and residual states not covered. If the repository lacks a UI test harness, add the smallest compatible layer or record the gap and block a visual-quality claim.

Use `ui-test plan` to detect a compatible test surface and `ui-test run` to retain the actual command result. For visual regression, accept a report from a perceptual runner (for example SSIM or pixelmatch) with an explicit threshold and human review; a byte hash detects file identity only and cannot establish visual equivalence. A proposed selector repair must remain staged until a reviewer confirms it preserves the same task, keyboard behavior, and unhappy path.

## Opportunity and Business Discipline

For any material product or GUI bet, calculate market chance before build from pain, frequency, willingness to pay, reach, differentiation, feasibility, and evidence. Build a transparent business case from reachable accounts, penetration, price, margin, build cost, and monthly operating cost. Defaults are illustrative assumptions; never present the resulting revenue, ROI, or break-even date as market fact. Use the counterfactual tournament to select the highest-value reversible experience, then bind its task-time target, experiment, and kill condition to release evidence.

Import dated, cited research separately from customer signals and product telemetry. Model conservative, base, and upside economics including CAC, churn, sales cycle, and operating cost. The discovery loop must distinguish stated preference, observed behavior, and external research; it may rank a next experiment but cannot infer causality or authorize a product decision by itself.
