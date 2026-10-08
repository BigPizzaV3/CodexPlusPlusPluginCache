---
name: setup-ts-deep-modules
description: "Enforce TypeScript package boundaries, entry points, and cyclic dependency rules with dependency-cruiser. Use when structuring monorepo packages, establishing public API entry points, or preventing circular imports — even if the user says \"fix TS package boundaries\". Do NOT use for non-TypeScript repositories."
---

# Setup TS Deep Modules

Configure and verify strict deep-module boundaries across TypeScript packages using `dependency-cruiser`, ensuring public interfaces exist exclusively at package root files while private implementations remain sealed inside subdirectories.

---

## Core Invariants

1. **Root Files as Exclusive Entry Points**: External callers and consumers may only import package root files (`index.ts`, `client.ts`, `server.ts`); all subdirectories (`lib/`, `internal/`, `tests/`) are private.
2. **Four Strict Dependency Rules**: Enforce (1) Entry-point boundary, (2) Intra-package internal freedom, (3) Tests import entry-points only, (4) Zero dependency cycles.
3. **Barrels Strongly Discouraged**: Expose focused, multiple root entry points instead of giant barrel files that re-export whole subtrees.
4. **Mandatory Biting Proof**: Before completing setup, deliberately introduce a forbidden deep import to verify that `lint:boundaries` fails fast.
5. **No Speculative Path Aliases**: Wire boundary checks directly through dependency-cruiser rather than altering `tsconfig.json` paths or building complex build-time layers.

---

## Architecture & Map of Content (MOC)

```
src/packages/
  <package-name>/
    index.ts          ◄── Public Entry Point (exported to other packages)
    client.ts         ◄── Additional Public Entry Point
    lib/              ◄── Private Implementation (sealed from outsiders)
    tests/            ◄── Tests (import only root entry points)
```

| Rule | Enforcement | Target |
|---|---|---|
| **Entry Boundary** | `not-to-subfolder` | Outside code $\rightarrow$ root files only |
| **Test Boundary** | `tests-through-entrypoints` | `tests/` $\rightarrow$ root entry points only |
| **Cycle Prevention** | `no-circular` | Disallow all circular dependencies |
| **Verification Gate** | `lint:boundaries` script | Automated CI failure on breach |

---

## Step-by-Step Procedure (TWI)

### Step 1: Detect Environment & Package Manager
- **Action**: Detect the package manager (`bun.lockb` $\rightarrow$ bun, `pnpm-lock.yaml` $\rightarrow$ pnpm, `yarn.lock` $\rightarrow$ yarn, else npm) and locate the packages root (`src/packages` or `packages`).
- **Key Point**: Check for existing `.dependency-cruiser.*` configuration to merge rules rather than overwriting.
- **Why**: Preserving existing project package manager standards ensures zero friction with current CI scripts.

### Step 2: Install and Configure Dependency Cruiser
- **Action**: Install `dependency-cruiser` as a devDependency and copy `dependency-cruiser.config.cjs` to `.dependency-cruiser.cjs` with updated `PACKAGES_ROOT`.
- **Key Point**: Use `.cjs` extension so CommonJS exports function seamlessly in ESM / `"type": "module"` projects.
- **Inline Checklist**:
  - [ ] Package manager identified correctly
  - [ ] `dependency-cruiser` added to `devDependencies`
  - [ ] `.dependency-cruiser.cjs` configured with 4 core rules

### Step 3: Wire Scripts & Scaffold Clean Example
- **Action**: Add `"lint:boundaries": "depcruise <packages-root>"` to `package.json` and create an example deep package:
  - `<packages-root>/example/index.ts` (public entry point delegating to `lib/`)
  - `<packages-root>/example/lib/impl.ts` (hidden implementation)
  - `<packages-root>/example/tests/example.test.ts` (imports `../index`)
- **Why**: A reference package serves as living documentation and a starter template for developers.

### Step 4: Prove the Rules Bite (Verification Gate)
- **Action**: Execute three validation passes:
  1. Run `lint:boundaries` $\rightarrow$ must **PASS** on clean repo.
  2. Add deep import `import { impl } from "../lib/impl"` in test $\rightarrow$ must **FAIL**.
  3. Revert deep import and run `lint:boundaries` $\rightarrow$ must **PASS**.
- **Key Point**: Never sign off on boundary rules without observing an intentional test failure.
- **Why**: Unproven linter configs frequently have syntax or glob errors that silently pass all code.

### Step 5: Document Package Conventions & Agent Pointer
- **Action**: Create `<packages-root>/README.md` explaining layout and rules, and add a single-line context pointer in `AGENTS.md` / `CLAUDE.md`.
- **Key Point**: Explicitly explain why barrel files are discouraged.
- **Why**: Agent pointers ensure future autonomous sessions respect package boundaries from their first prompt.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Skip testing whether the rule fails on bad imports."* | **Mandatory 3-step proof (Pass $\rightarrow$ Fail $\rightarrow$ Pass).** | Linters with invalid glob configurations pass silently without enforcing anything. |
| *"Export all submodules through a giant root index.ts barrel."* | **Discourage large barrel files.** | Giant barrels destroy tree-shaking and create hidden cyclic import dependencies. |
| *"Import directly from lib/ in unit tests for convenience."* | **Enforce tests through public entry points only.** | Deep imports in tests tightly couple test suites to volatile internal refactors. |

