---
name: codebase-design
description: "Shared vocabulary and patterns for designing deep modules with narrow interfaces and clean seams. Use when designing module interfaces, finding deepening opportunities, deciding where seams go, or making code more testable and AI-navigable — even if the user says \"improve this module\". Do NOT use for whole-codebase architectural surveys."
---

# Codebase Design

Design deep, high-leverage modules that encapsulate complex domain behavior behind minimal interfaces placed at clear architectural seams.

---

## Core Invariants

1. **Depth Over Surface Area**: Maximize internal implementation leverage while minimizing interface surface area (few methods, simple primitive parameters).
2. **Interface as Test Surface**: External callers and unit tests cross the exact same seam; never pierce the interface to test internal private plumbing.
3. **The Deletion Test**: If deleting a module causes complexity to vanish, it was an unnecessary pass-through; if complexity scatters across $N$ callers, it was earning its keep.
4. **Real vs. Hypothetical Seams**: One adapter indicates a hypothetical seam; introduce an interface seam only when at least two concrete adapters vary across it.
5. **Exact Design Vocabulary**: Strictly use canonical terminology (**module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality**); avoid vague synonyms (service, component, boundary).

---

## Architecture & Map of Content (MOC)

```
┌───────────────────────────────────────┐
│       Narrow Public Interface         │  ◄── Small surface (few methods, simple inputs)
├───────────────────────────────────────┤
│                                       │
│          Deep Implementation          │  ◄── High leverage, hidden state, rich logic
│                                       │
└───────────────────────────────────────┘
```

| Component | Responsibility | Reference |
|---|---|---|
| **Module Deepening** | Refactor shallow pass-throughs into deep modules | `skills/codebase-design/DEEPENING.md` |
| **Design It Twice** | Explore multi-model interface variations | `skills/codebase-design/DESIGN-IT-TWICE.md` |
| **Testability Rules** | Accept dependencies, return pure values | Public seam tests |

---

## Step-by-Step Procedure (TWI)

### Step 1: Evaluate Current Interface Depth & Seams
- **Action**: Inspect the module's public methods, parameter signatures, and call sites.
- **Key Point**: Check the ratio of interface cognitive overhead to internal capabilities.
- **Why**: Shallow modules force callers to understand internal mechanics, destroying locality.

### Step 2: Apply the Deletion Test & Simplify Signatures
- **Action**: Consolidate fine-grained procedural methods into unified, intent-revealing operations.
- **Key Point**: Hide internal state transformations and dependency instantiations behind the seam.
- **Inline Checklist**:
  - [ ] Methods reduced to minimal essential operations
  - [ ] Dependencies passed in rather than created internally
  - [ ] Functions return values rather than mutating global side effects

### Step 3: Align Seam with Unit Test Harness
- **Action**: Structure test suites to exercise the module strictly through its public interface.
- **Key Point**: Eliminate internal mocking and testing of private helper functions.
- **Why**: Testing through the interface ensures tests survive internal refactors without breakage.

### Step 4: Explore Alternatives (Design It Twice)
- **Action**: When designing complex or foundational modules, draft 2–3 radically different interface designs before coding.
- **Key Point**: Compare candidates on depth, locality, and caller ergonomics.
- **Why**: The first interface that comes to mind is rarely the deepest or most maintainable.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Expose private helper functions so we can write unit tests for them."* | **Forbidden. Test exclusively through the public interface.** | Testing private helpers couples tests to implementation details and prevents refactoring. |
| *"Create an interface and adapter for a single implementation."* | **Wait for 2 adapters before extracting a generic seam.** | Speculative generalization creates shallow, unnecessary abstraction layers. |
| *"Break this 100-line cohesive function into 5 single-use files."* | **Maintain locality inside deep modules.** | Excessive fragmentation increases cognitive load and scatters related logic. |

