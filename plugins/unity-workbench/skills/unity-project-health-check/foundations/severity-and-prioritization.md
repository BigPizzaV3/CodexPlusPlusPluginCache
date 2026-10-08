# Severity and Prioritization

## Priority factors

Consider:

- user impact
- crash risk
- data-loss risk
- security risk
- release-blocking potential
- frequency
- affected platforms
- affected users or systems
- recovery difficulty
- confidence
- remediation cost

## Severity

### Critical

Immediate release or data-integrity threat.

### High

Major functional, performance, compatibility, or reliability risk.

### Medium

Meaningful risk that should be planned.

### Low

Localized improvement or preventive maintenance.

### Informational

No immediate remediation required.

## Priority is not severity alone

A confirmed medium issue with a one-hour fix may deserve earlier action than a
possible high-risk redesign requiring weeks.

## Avoid inflated severity

Do not classify:

- naming preferences
- small duplication
- minor folder inconsistencies
- missing comments
- non-hot-path micro-allocations

as high severity without direct impact.
