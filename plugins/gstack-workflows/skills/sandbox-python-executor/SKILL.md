---
name: sandbox-python-executor
description: Use host-native Python for deterministic parsing, hashing, archive inspection, validation, transformations, and executable verification.
---

# Sandbox Python Executor

Use the host Python capability when deterministic execution materially improves correctness. Suitable jobs include manifest parsing, package inspection, hashing, structured validation, and file transformation. Do not use Python merely to imitate a safer file-read operation.

Actually execute the code before reporting outputs. Do not expose secrets. Treat target repository scripts as untrusted until inspected. If Python is unavailable, keep execution-dependent conclusions unverified.
