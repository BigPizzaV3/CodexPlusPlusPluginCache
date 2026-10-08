---
name: setup-pre-commit
description: "Configure pre-commit quality checks with Husky and lint-staged while preserving package manager conventions. Use when setting up git pre-commit hooks, automated formatters, staged linters, or typecheck gates — even if the user says \"add pre-commit hooks\". Do NOT use for continuous integration (CI) pipeline setup."
---

# Setup Pre-Commit Hooks

Install and configure deterministic Git pre-commit quality gates using Husky, `lint-staged`, and Prettier, preserving existing repository package managers and build scripts.

---

## Core Invariants

1. **Package Manager Fidelity**: Detect and use the repository's native package manager (`bun`, `pnpm`, `yarn`, `npm`); do NOT introduce conflicting lockfiles.
2. **Staged-Only Formatting**: Run Prettier strictly against staged files via `lint-staged` with `--ignore-unknown --write` to prevent un-staged code drift.
3. **Repository-Wide Typecheck & Test**: Execute full typecheck and unit test passes inside `.husky/pre-commit` after `lint-staged` succeeds.
4. **Preserve Existing Configurations**: If `.prettierrc` or existing Husky hooks exist, merge scripts safely without overwriting user rules.
5. **Mandatory Smoke-Test Commit**: Verify the entire hook pipeline by staging all configuration changes and executing a verified test commit.

---

## Architecture & Map of Content (MOC)

```
[ Git Commit Attempt ] ──► [ .husky/pre-commit Hook ]
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
  [ lint-staged ]             [ Typecheck Gate ]          [ Unit Test Gate ]
  - Prettier format           - `npm run typecheck`       - `npm run test`
  - Staged files only         - Full project types        - Unit/Integration pass
```

| Component | Responsibility | Configuration File |
|---|---|---|
| **Husky Engine** | Git hook manager v9+ | `.husky/pre-commit` |
| **lint-staged** | Run formatters exclusively on staged changes | `.lintstagedrc` |
| **Prettier** | Code style standardization | `.prettierrc` |

---

## Step-by-Step Procedure (TWI)

### Step 1: Detect Package Manager & Check Existing Setup
- **Action**: Detect the lockfile (`bun.lockb` $\rightarrow$ bun, `pnpm-lock.yaml` $\rightarrow$ pnpm, `yarn.lock` $\rightarrow$ yarn, else npm).
- **Key Point**: Check if `prettier`, `lint-staged`, or `husky` are already installed.
- **Why**: Reusing existing dependencies prevents package bloat and lockfile churn.

### Step 2: Install DevDependencies & Initialize Husky
- **Action**: Install `husky`, `lint-staged`, and `prettier` as devDependencies, then run `npx husky init`.
- **Key Point**: Verify that `"prepare": "husky"` is added to `package.json`.
- **Inline Checklist**:
  - [ ] Dependencies installed in `devDependencies`
  - [ ] `.husky/` directory created
  - [ ] `prepare` script present in `package.json`

### Step 3: Write `.husky/pre-commit` & `.lintstagedrc`
- **Action**: Configure `.husky/pre-commit`:
  ```bash
  npx lint-staged
  npm run typecheck
  npm run test
  ```
  *(Adapting `npm` to the detected package manager, and omitting `typecheck`/`test` if scripts are absent).*
- **Key Point**: Create `.lintstagedrc` with `{"*": "prettier --ignore-unknown --write"}`.
- **Why**: `prettier --ignore-unknown` safely ignores binaries and images while formatting all supported text formats.

### Step 4: Smoke Test and Initial Commit
- **Action**: Stage all created hook files and run `git commit -m "Add pre-commit hooks (husky + lint-staged + prettier)"`.
- **Key Point**: Confirm that the commit triggers the pre-commit hook and passes all stages.
- **Why**: Live commit execution proves that hooks are executable and correctly configured.

---

## Anti-Rationalization Guardrails

| Tempting Rationalization | Binding Rule | Engineering Rationale |
|---|---|---|
| *"Run prettier across the whole repository on every commit."* | **Run Prettier strictly on staged files via `lint-staged`.** | Full-repo formatting on every commit slows developer workflows and pollutes diffs. |
| *"Skip the typecheck and test steps in pre-commit to make it faster."* | **Include typecheck and fast tests in pre-commit.** | Catching type errors locally before push prevents broken remote CI builds. |
| *"Use npm commands in a pnpm or bun repository."* | **Strictly match detected package manager commands.** | Mismatched package managers create duplicate lockfiles and broken installations. |

