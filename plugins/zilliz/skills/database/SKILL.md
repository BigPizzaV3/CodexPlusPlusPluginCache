---
name: database
description: Use when the user wants to create, list, describe, or drop databases in Milvus.
---

## Prerequisites

1. CLI installed, a usable data-plane credential configured, and cluster context set (see setup skill).

## Commands Reference

### Create a Database

```bash
zilliz database create --name <database-name>
# Or use raw JSON: --body '{"properties": {}}'
```

Availability depends on the current endpoint, credential, and service configuration. Report the CLI or server response without inferring support from a cluster label alone.

### List Databases

```bash
zilliz database list
```

### Describe a Database

```bash
zilliz database describe --name <database-name>
```

If details are unavailable, fall back to the information returned by `database list` and the current context.

### Drop a Database

```bash
zilliz database drop --name <database-name-to-drop>
```

This action is destructive. Confirm the exact database and impact immediately before execution.

## Guidance

- Use `database list` and the current context to discover available database names. Do not assume that a database named `default` exists or is accessible.
- When an operation is rejected, report the returned permission or availability error and continue with independent database capabilities where possible.
- Before dropping a database, confirm with the user -- all collections in it will be deleted.
- After creating a database, suggest switching context: `zilliz context set --database <db-name>`.
- To work with collections in a non-default database, use `--database` flag on collection commands or switch context.
