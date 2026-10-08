# Architecture and Maintainability Checklist

Inspect:

- responsibility boundaries
- state ownership
- dependency direction
- coupling between feature areas
- use of static mutable state
- singleton reliance
- circular conceptual dependencies
- oversized managers
- hidden scene dependencies
- duplicated parallel systems
- public API size
- testability of important rules
- composition versus inheritance
- architectural consistency

Do not penalize a simple project for not using enterprise layering.

Flag only issues that increase change cost, defect risk, or ownership ambiguity.
