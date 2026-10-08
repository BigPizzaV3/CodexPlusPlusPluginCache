---
name: migrate-to-shoehorn
description: "Migrate unsafe TypeScript test assertions to @total-typescript/shoehorn with explicit fixture intent. Use when test files contain unsafe `as` or `as unknown as` typecasts, when mock fixtures break under typechecking, or when modernizing test typing — even if the user says \"fix test type assertions\". Do NOT use for production code types."
---

# Migrate to Shoehorn

Safely migrate unsafe, brittle TypeScript test-fixture typecasts (`as Type`, `as unknown as Type`) to intention-revealing, type-safe helpers from `@total-typescript/shoehorn`.

---

## Core Invariants

1. **Test-Code Isolation Strictly**: `@total-typescript/shoehorn` is strictly for test suites and test fixtures; NEVER import or use shoehorn helpers in production application code.
2. **Intent-Specific Helper Mapping**:
   - Partial objects where only some keys matter $\rightarrow$ `fromPartial(obj)`
   - Intentionally invalid/wrong types for error testing $\rightarrow$ `fromAny(obj)`
   - Fully populated mocks $\rightarrow$ `fromExact(obj)`
3. **Preserve Autocomplete & Refactor Safety**: Maintain TypeScript type inference and IDE autocompletion across all migrated test fixtures.
4. **Automated Discovery & Regex Caution**: Discover test casts via targeted grep (`as [A-Z]`); avoid blind global replacements that might alter production code.
5. **Mandatory Typecheck Green**: Every migration pass must conclude with a green `tsc --noEmit` or equivalent repository typecheck command.

---

## Architecture & Map of Content (MOC)

```
[ Unsafe Test Casts (`as Type`, `as unknown as`) ] ──► [ Intent Classification ] ──► [ Replace with Shoehorn Helper ] ──► [ Verify Typecheck ]
```

| Unsafe Pattern | Shoehorn Replacement | Target Scenario |
|---|---|---|
| `{ id: "123" } as User` | `fromPartial<User>({ id: "123" })` | Test cares only about `id` in large type |
| `{ id: 123 } as unknown as User` | `fromAny<User>({ id: 123 })` | Testing runtime validation on bad input |
| `completeMock as User` | `fromExact<User>(completeMock)` | Explicit complete mock structure |

---

## Step-by-Step Procedure (TWI)

### Step 1: Install Dependency with Detected Package Manager
- **Action**: Install `@total-typescript/shoehorn` as a devDependency (`bun add -d`, `pnpm add -D`, `npm i -D`).
- **Key Point**: Check that it is added strictly to `devDependencies`.
- **Why**: Prevent bundling test-helper utilities into production builds.

### Step 2: Locate Unsafe Casts in Test Files
- **Action**: Search test files for type assertion smells:
  ```bash
  grep -rnE " as [A-Z]| as unknown as " --include="*.test.ts" --include="*.spec.ts" src/
  ```
- **Key Point**: Inspect surrounding context to determine whether the fixture is a partial mock or an intentionally invalid payload.
- **Inline Checklist**:
  - [ ] Only test files (`*.test.ts`, `*.spec.ts`) targeted
  - [ ] Zero production source files modified
  - [ ] Intent classified per fixture (`fromPartial` vs. `fromAny`)

### Step 3: Replace Casts and Import Helpers
- **Action**: Replace `as Type` with `fromPartial(...)` and `as unknown as Type` with `fromAny(...)`, adding `import { fromPartial, fromAny } from "@total-typescript/shoehorn"`.
- **Why**: `fromPartial` documents that missing fields are deliberate, avoiding false compiler errors while retaining type intelligence.

### Step 4: Run Typecheck & Test Suite
- **Action**: Execute the project's typecheck command (e.g. `bun run typecheck`, `pnpm check`, `tsc --noEmit`) and run the test suite.
- **Key Point**: Verify that tests pass and TypeScript emits 0 errors.
- **Why**: Ensures no subtle type contract regressions were introduced during migration.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Use shoehorn in production helpers to bypass strict types."* | **Forbidden. Test code only.** | Bypassing types in production creates silent runtime TypeError crashes. |
| *"Use `fromAny` everywhere because it's easier than `fromPartial`."* | **Use `fromPartial` for valid partials; `fromAny` only for invalid types.** | Overusing `fromAny` disables autocomplete and typechecking benefits. |
| *"Skip running typecheck after updating test files."* | **Mandatory green typecheck verification.** | Minor syntax errors or missing generic arguments break CI builds. |

