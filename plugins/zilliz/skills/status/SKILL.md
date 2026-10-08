---
name: status
description: Use when the user wants a comprehensive overview of their current Zilliz Cloud environment — context, cluster details, databases, and collections with stats.
---

Gather and display a status overview of the user's current Zilliz Cloud environment. Run commands with `--output json` for structured data, then present a formatted summary.

## Step 1: Inspect current access

Verify the CLI and inspect both authentication surfaces:

```bash
zilliz --version
zilliz auth status
zilliz context current --output json
```

Do not stop solely because `zilliz auth status` reports no control-plane login. A configured data-plane context may still be usable.

## Step 2: Show Current Context

```bash
zilliz context current --output json
```

If no context is set, suggest running `zilliz context set --cluster-id <id>`.

## Step 3: Optional cluster details

Using the cluster ID from context:

```bash
zilliz cluster describe --cluster-id <cluster-id> --output json
```

If this command succeeds, present the cluster name, status, plan, and region. If it is unavailable or denied, preserve the error briefly and continue with data-plane status. Do not ask the user to change credentials unless cluster metadata is required for their request.

## Step 4: Database List

```bash
zilliz database list --output json
```

If database listing is unavailable but the context already names a database, continue with that database and mark database discovery as unavailable.

## Step 5: Collections Summary

For each database returned in Step 4, gather collection information:

```bash
zilliz collection list --database <db-name> --output json
```

For each collection, gather stats and index info:

```bash
zilliz collection get-stats --name <name> --database <db-name> --output json
zilliz collection get-load-state --name <name> --database <db-name> --output json
zilliz index list --collection <name> --database <db-name> --output json
```

## Step 6: Present Summary

Format the results as a readable summary:

**Context:** <cluster-id> | <endpoint>
**Cluster metadata:** <available fields, or unavailable with the current access>

For each database, show its collections:

**Database:** <db-name>

| Collection | Rows | Load State | Indexes |
|---|---|---|---|
| my_collection | 10,000 | Loaded | vector_idx (AUTOINDEX) |
| ... | ... | ... | ... |

Distinguish verified facts from unavailable metadata. Report successful data-plane checks even when optional control-plane checks fail.
