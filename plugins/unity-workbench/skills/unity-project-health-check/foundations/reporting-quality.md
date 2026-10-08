# Reporting Quality

## Findings must be actionable

Each finding should explain:

- what was observed
- why it matters
- where the evidence is
- what to do next
- how to validate remediation

## Avoid generic advice

Weak:

> Improve performance.

Strong:

> `EnemyScanner.Update` performs a scene-wide search every frame. Cache or
> maintain the candidate set and validate with a CPU profiler capture.

## Avoid recommendation overload

Prioritize the few changes that provide the greatest reduction in risk.

## Positive findings

Include strengths only when supported and useful.

## Language

Use clear distinctions:

- confirmed defect
- likely risk
- code smell
- unknown
- not checked

## Report size

Keep the main report concise.

Move detailed inventories or evidence tables into appendices when needed.
