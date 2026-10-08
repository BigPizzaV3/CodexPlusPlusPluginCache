# Security Policy

## Supported Versions

Security updates are provided for the latest published release of the
`sqlserver-postgres-performance-advisor` plugin.

## Reporting a Vulnerability

Please report suspected vulnerabilities by opening a private security advisory
or by contacting the repository owner through GitHub:

https://github.com/rweisssieker-xp/SQLSERVER-POSTGRES-Plugin/security/advisories

Do not include production secrets, passwords, tokens, connection strings, or
customer data in an issue or pull request.

## Security Model

This plugin is designed for governed database operations. Write-like tools are
policy-gated, default to dry-run behavior where applicable, and should require
human approval for production-risk actions.

Production deployments should set:

```bash
CODEXDB_REQUIRE_LIVE_CONNECTION=true
CODEXDB_MIGRATION_SIGNING_KEY=<secret-from-a-secret-manager>
CODEXDB_DEFAULT_ENV=production
```

Secrets must be supplied through environment variables or a secret manager and
must not be committed to source control.
