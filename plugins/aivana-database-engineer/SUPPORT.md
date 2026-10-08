# Support

Use GitHub issues for bug reports, feature requests, and documentation problems:

https://github.com/rweisssieker-xp/SQLSERVER-POSTGRES-Plugin/issues

## Before Opening an Issue

Please include:

- Plugin version.
- Node.js version.
- Database engine (`postgres` or `sqlserver`).
- The command or Codex skill used.
- Sanitized output from `npm run readiness` or the failing tool command.

Do not include passwords, tokens, private keys, production connection strings,
or customer data.

## Operational Questions

For production use, run:

```bash
npm run readiness:strict
```

Resolve all blockers before enabling live database operations.
