# Contributing

Thanks for considering a contribution to CodexDB Agent.

## Development Setup

```bash
npm install
npm test
npm run readiness
```

## Pull Request Guidelines

- Keep changes focused and explain the database behavior being changed.
- Add or update tests for new runtime tools, policy behavior, or skill contracts.
- Update `README.md`, `CHANGELOG.md`, and `RELEASE_CHECKLIST.md` when user-facing
  behavior changes.
- Do not commit secrets, local runtime state, database dumps, or customer data.
- Prefer dry-run examples and synthetic data in documentation and tests.

## Runtime Safety

Database write operations must remain policy-gated. New write-like tools should
include risk classification, audit metadata, rollback or verification guidance,
and clear production controls.
