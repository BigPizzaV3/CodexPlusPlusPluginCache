---
name: implement
description: "Build scoped code changes and run verification from an approved specification or plan. Use when a concrete spec, approved plan, or set of tickets is ready to implement, when the user asks to build or code a planned feature, or when executing tasks — even if they don't explicitly say \"implement\". Do NOT use for initial architecture exploration or vague requirements."
---

# Implement

Execute scoped code changes and thorough verification from an approved specification, plan, or ticket set.

## Core Principle

> **Implement incrementally via vertical tracer slices, verify at each step, and maintain a green build at every seam.**

---

## Core Invariants

1. **Approved Plan or Spec First**: Never start broad implementation on ambiguous or unapproved specs.
2. **Vertical Slice Progress**: Implement in small, testable tracer slices rather than mass horizontal file edits.
3. **Continuous Typecheck & Test Verification**: Run local typechecks and single test files after every file modification, and the full suite before completion.
4. **Pre-Commit Quality Gate**: Pass clean code review (`code-review`) and lint checks before committing.
5. **Zero Dead or Speculative Code**: Write strictly the code required to satisfy the spec; avoid speculative abstractions.

---

## Architecture & Map of Content (MOC)

```
[ Review Approved Spec ] ──► [ Order Tracer Slices ] ──► [ TDD Cycle per Slice ] ──► [ Full Suite Verification ] ──► [ Code Review & Commit ]
```

| Phase | Responsibility | Key Action |
|---|---|---|
| **1. Preparation** | Read spec, identify dependencies, check existing test seams | Verify repo builds cleanly before touching code |
| **2. Tracer Execution** | Implement slice-by-slice with TDD | Red-green cycles on target components |
| **3. Continuous Check** | Fast feedback on type errors and single tests | Run targeted test runner after each edit |
| **4. Integration Gate** | End-to-end regression validation | Full test suite, linter, and typecheck pass |
| **5. Delivery** | Review diff against standards and spec | Route to `code-review` and clean commit |

---

## Step-by-Step Procedure (TWI)

### Step 1: Ingest Spec & Verify Baseline Cleanliness
- **Action**: Read the spec or ticket descriptions, inspect referenced files, and verify the existing test suite passes cleanly.
- **Key Point**: Never begin adding new features to a broken or failing baseline.
- **Why**: Existing failures confound regression detection for new changes.

### Step 2: Implement via Vertical Slices (TDD)
- **Action**: For each ticket or component, write failing assertions at public seams, then implement minimal passing logic.
- **Key Point**: Keep edits contained and avoid touching unrelated modules.
- **Inline Checklist**:
  - [ ] Public seam identified and tested
  - [ ] Typecheck passes without errors
  - [ ] Targeted test passes cleanly

### Step 3: Full Test Suite & Quality Verification
- **Action**: Run the complete project test suite, typechecker, and linter across the entire repository.
- **Key Point**: Zero failures, zero unexpected warnings, zero unformatted files.
- **Why**: Changes in one module can subtly break downstream consumers.

### Step 4: Code Review & Final Commit
- **Action**: Audit the git diff against repository coding standards and original requirements using `code-review`.
- **Key Point**: Write a clear, value-communicating commit message summarizing the change.
- **Why**: Durable commit histories preserve architectural reasoning for future maintainers.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"I'll edit all 10 files at once before testing anything."* | **Vertical tracer slicing: verify each file/unit immediately.** | Massive multi-file edits make errors difficult to isolate and debug. |
| *"Typechecks are slow, I'll run them at the very end."* | **Run fast targeted checks continuously.** | Catching type errors early prevents building on flawed data signatures. |
| *"The existing test suite was failing before, so ignore it."* | **Establish clean baseline before modifying code.** | Unaccounted failures hide new regressions introduced by the feature. |
| *"Skip code review since the code runs fine."* | **Mandatory diff review against spec and standards.** | Functional code can still violate repository conventions and security standards. |
