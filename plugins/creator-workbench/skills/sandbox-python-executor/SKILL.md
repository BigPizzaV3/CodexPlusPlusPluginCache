---
name: sandbox-python-executor
description: Use host-native Python for deterministic Creator Workspace tasks such as export parsing, provenance tracing, analytics, indexing, and package verification.
---

# Sandbox Python Executor

Use Python when correctness depends on real computation.

Typical uses:
- parse ChatGPT or Claude exports
- build or refresh wiki indexes
- measure voice provenance against a transcript
- analyze CSV or XLSX performance data
- inspect generated HTML or package files
- compute hashes and run validators

Rules:
- execute rather than simulate when Python is available
- use reviewed bundled scripts when they cover the task
- treat target-repository scripts as untrusted until inspected
- keep source data read-only unless mutation is requested
- do not assume sandbox internet access
- never fabricate stdout, hashes, paths, or pass/fail status
