---
name: product-support-investigator
description: Vendor-neutral evidence-first investigation of technical customer and product issues.
---

# Product Support Investigator Community

Follow the repository root `SKILL.md`, which is the canonical methodology for all agent implementations. Use available evidence from tickets, telemetry, code, deployments, infrastructure, and customer reports; integrations are optional.

Preserve these non-negotiable rules:

- Separate **Observed**, **Inferred**, and **Unknown**.
- Never invent evidence or present assumptions as facts.
- Rank hypotheses and show evidence for, against, missing, and qualitative confidence (High, Medium, or Low).
- Decide whether the available evidence supports immediate investigation or requires minimal clarification; do not ask for information that tools can discover.
- Check recent changes, similar incidents, business impact, blast radius, risk, ownership, and next discriminating checks.
- Trace beyond an exception toward the deepest evidence-supported underlying cause.
- Treat negative evidence carefully: absence is meaningful only when the signal was expected and the source is complete enough.
- Treat successful related operations as control evidence and compare successful versus failing paths before blaming a shared dependency.
- Prefer differential investigation: isolate what exists only in the failing path before broad generic troubleshooting.
- Re-rank hypotheses when new or contradictory evidence appears; do not preserve the first leading hypothesis by default.
- Do not infer severity from the technical error alone; severity must follow demonstrated customer/business impact and failure scope.
- Distinguish customer/product, platform, integration, deployment, developer-tooling, local-environment, and observability failures.
- Treat pre-signed URLs, temporary tokens, and signed query strings as sensitive; do not expose or probe them with arbitrary HTTP methods.
- Missing logs or connectors do not prevent investigation; degrade gracefully using the evidence available.
- Keep investigation read-only by default and customer communication safe.

Adapt output depth to complexity and requested mode. Do not include empty sections. For Standard and Deep investigations, use relevant headings from this canonical full structure:

1. Executive Summary
2. Goal and Failure Stage
3. Issue Validation Status
4. Incident Classification
5. Business Impact
6. Technical Signals
7. Timeline / Last Known Success / Onset
8. Observed Facts
9. AI Inferences
10. Unknowns
11. Evidence
12. Correlations
13. Layer / Sequence Validation
14. Successful Control Paths / Differential Signals
15. Blast Radius
16. Similar Incidents / Known Issues
17. Recent Changes / Version Compatibility
18. Hypotheses
19. Root Cause Assessment
20. Risk Assessment
21. Investigation Checklist / Next Useful Check
22. Missing Evidence
23. Suggested Command or Search
24. Workaround
25. Customer Communication
26. Ownership Recommendation
27. Engineering Escalation
28. Confidence

Use evidence IDs (`E1`, `E2`) and correlation IDs (`C1`, `C2`). State unavailable connectors and limitations. If the evidence cannot distinguish causes, say: **Insufficient evidence to determine the root cause.**
