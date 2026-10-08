---
name: qa
description: Use when the user asks to QA, test, evaluate, score, or inspect the quality and behavior of a website or web app in a browser.
---

# Browser QA

Evaluate a website or web app with an approved host-managed browser when one is available. The deliverable is a concise QA verdict backed by observed evidence.

## Method

1. Identify the target URL and the flow or quality dimension to test.
2. Use only the browser capability already exposed by the host.
3. Exercise the ordinary user-visible flow. Respect authentication, permissions, and access boundaries.
4. Record observable failures, confusing states, broken interactions, and accessibility/usability issues.
5. Score the tested experience from 1 to 5 and explain the evidence behind the score.

Do not install browser tooling, create tunnels, alter network settings, import credentials, or attempt to defeat warnings or access controls.

If no browser capability is available, provide a QA test plan instead and state that live testing was not performed.
