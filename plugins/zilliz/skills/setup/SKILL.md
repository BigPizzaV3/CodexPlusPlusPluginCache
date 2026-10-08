---
name: setup
description: Use when the user needs to install zilliz-cli, log in to Zilliz Cloud, configure credentials, or set the active cluster context. Also use when any other skill reports a missing prerequisite.
---

## Setup approach

Treat control-plane authentication and data-plane access as separate capabilities. Do not require one as proof of the other.

1. Check whether the CLI is installed with `zilliz --version`.
2. Inspect the current control-plane authentication state with `zilliz auth status`.
3. Inspect the current data-plane context with `zilliz context current --output json`.
4. Validate the capability needed for the user's task with a non-destructive command. For example, use `zilliz cluster list --output json` for control-plane discovery or `zilliz database list --output json` / `zilliz collection list --output json` for data-plane access.

A failed control-plane authentication check does not prove that an explicitly configured data-plane credential is invalid. Continue with the available context and validate the requested operation directly.

## Commands Reference

### Install / Upgrade CLI

```bash
curl -fsSL https://raw.githubusercontent.com/zilliztech/zilliz-cli/master/install.sh | bash
```

Verify installation:

```bash
zilliz --version
```

### Authentication

Interactive login and credential configuration must happen in the user's own terminal, not in a non-interactive agent shell.

Check if already logged in:

```bash
zilliz auth status
```

If the task needs control-plane access and no usable authentication is available, tell the user to open their own terminal and run one of the following:

**Option 1: Browser-based login (OAuth)**

```
zilliz login
```

- Opens a browser for authentication
- Uses the signed-in account's assigned control-plane permissions
- Use `--no-browser` in headless environments (displays a URL to visit manually)

**Option 2a: API Key via login command**

```
zilliz login --api-key
```

**Option 2b: API Key via configure (legacy)**

```
zilliz configure
```

- Prompts for an API key (found in Zilliz Cloud console under API Keys)
- Limitations compared to OAuth login:
  - Organization switching not available
  - Available control-plane operations depend on the key's assigned permissions

**Option 3: Environment variable**

User can add to their shell profile (`.zshrc` / `.bashrc`):

```
export ZILLIZ_API_KEY=<your-api-key>
```

The environment variable can also carry a data-plane token supported by the target endpoint. Never ask the user to paste the value into the conversation.

After the user completes control-plane authentication, verify it with:

```bash
zilliz auth status
```

For data-plane-only access, verify the endpoint, database, and credential with a non-destructive data command instead of requiring `zilliz auth status` to succeed.

### Configure Subcommands

```bash
zilliz configure              # Interactive API key setup
zilliz configure list          # Show all config values
zilliz configure set <key> <value>  # Set a config value
zilliz configure get <key>     # Get a config value
zilliz configure clear         # Clear all credentials
```

### Switch Organization

These commands require an interactive terminal. Instruct the user to run in their own terminal:

```
# Interactive selection
zilliz auth switch

# Direct switch by org ID
zilliz auth switch <org-id>
```

### Logout

```bash
zilliz logout
```

### Set Cluster Context

Data-plane commands (collection, vector, index, etc.) require an active cluster context.

```bash
# Set by cluster ID when endpoint discovery is available
zilliz context set --cluster-id <cluster-id>

# Set an explicit data-plane context when discovery is unavailable
zilliz context set --cluster-id <cluster-id> --endpoint <url> --database <database-name>

# Change the active database
zilliz context set --database <db-name>
```

Do not assume a database name. Prefer the database already stored in the context; otherwise run `zilliz database list --output json` and use a database returned by the service.

### View Current Context

```bash
zilliz context current
```

## Output Format

All zilliz-cli commands support `--output json` for structured, machine-readable output. Use this when you need to parse results programmatically:

```bash
zilliz cluster list --output json
zilliz collection describe --name <name> --output json
```

Available formats: `json`, `table`, `text`. Default is `text`.

## Capability detection

Available operations can vary with the credential, endpoint, service configuration, and current context. Prefer direct, non-destructive capability checks over inferring behavior from a cluster label.

- For control-plane tasks, test the narrowest relevant read command first.
- For data-plane tasks, confirm the explicit endpoint and database, then test `database list` or `collection list`.
- If a command is unavailable or denied, report the returned error and continue with independent capabilities when possible.
- Do not turn a failed optional check, such as cluster discovery or cluster metadata lookup, into a blocker for an otherwise working data-plane task.

## Troubleshooting

- **"command not found" after install:** Check that the install directory (e.g., `~/.local/bin`) is in your PATH. Try re-running the install script: `curl -fsSL https://raw.githubusercontent.com/zilliztech/zilliz-cli/master/install.sh | bash`.
- **Control-plane "not authenticated" errors:** Run `zilliz auth status`. If the task is data-plane-only, validate the configured endpoint and database separately before asking the user to log in again.
- **Context errors (no cluster set):** Run `zilliz context current` to verify. If the cluster was deleted or suspended, set a new context with `zilliz context set --cluster-id <id>`.
- **Permission or "not supported" errors:** Preserve the server or CLI error, verify the target endpoint and database, and explain that the current credential or service configuration does not expose that operation.
- **Network or timeout errors:** Verify the endpoint and retry a non-destructive operation once. If control-plane metadata is available, use it as additional evidence rather than a mandatory prerequisite.

## Guidance

- Validate only the capabilities needed for the current task.
- Treat control-plane discovery and data-plane operations as independent when the available credentials support only one of them.
- NEVER run `zilliz login`, `zilliz configure`, or `zilliz auth switch` (without arguments) inside a non-interactive agent shell — they require interactive input. Always instruct the user to run these in their own terminal.
- NEVER ask the user to paste API keys into the chat — this is a security risk. Guide them to configure credentials in their own terminal instead.
- After the user reports setup is complete, verify the narrowest capability needed for the requested task.
- After setting context, verify with `zilliz context current`.
- For data-plane commands in other skills, verify that context includes the intended endpoint and database.
- When a command fails unexpectedly, verify the endpoint, database, credential scope, and current context before drawing conclusions about service support.
