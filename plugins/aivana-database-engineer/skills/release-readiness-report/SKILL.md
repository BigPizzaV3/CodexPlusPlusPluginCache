---
name: release-readiness-report
description: Produce a release readiness report across production blockers, connector status, and health assessment.
---

# Release Readiness Report

Run:

```bash
node runtime/runTool.js release_readiness_report '{"environment":"production","engine":"postgres"}'
```

Returns readiness sections, open blockers, and final ready flag.
