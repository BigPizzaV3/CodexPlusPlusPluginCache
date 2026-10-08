# Scoped Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Run a narrow evidence-backed audit for a domain without a dedicated audit, while preserving the same owner, reachability, priority, and task-quality rules as the domain-specific audits.

## Required specialization

Before use, supply: domain, target, authoritative standards/capabilities, invariants, repository/runtime evidence sources, and safe validation limits. If these are absent, stop with explicit missing inputs rather than emitting generic best practices.

## Audit method

Trace the selected behavior through its owner, direct producers/consumers, states, failure/recovery, configuration, tests, and operations. Keep a finding only when a reachable path violates a named domain invariant with concrete impact and a validation route. Do not audit the whole repository.

## Priority model

- **P0:** a reachable security breach, data loss, outage, irreversible side effect, or release-blocking regression.
- **P1:** an important correctness, reliability, performance, or test gap with clear user or operational impact.
- **P2:** a lower-risk but concrete quality gap that affects diagnosability, maintainability, or secondary behavior.
