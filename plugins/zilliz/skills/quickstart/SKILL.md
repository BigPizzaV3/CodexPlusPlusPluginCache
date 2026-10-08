---
name: quickstart
description: Use when the user wants to set up, install, authenticate, or configure the Zilliz Cloud CLI and cluster context for the first time (one-shot onboarding).
---

Guide the user through the complete Zilliz Cloud CLI setup. Follow these steps in order:

## Step 1: Install zilliz-cli

Check if already installed:

```bash
zilliz --version
```

If not installed or needs upgrading:

```bash
curl -fsSL https://raw.githubusercontent.com/zilliztech/zilliz-cli/master/install.sh | bash
```

Verify:

```bash
zilliz --version
```

## Step 2: Inspect available access

Inspect control-plane authentication and the existing data-plane context independently:

```bash
zilliz auth status
zilliz context current --output json
```

If the requested workflow needs control-plane access and no usable authentication is available, instruct the user to open their own terminal and run one of:

1. **Browser login** — `zilliz login` — opens a browser for OAuth and uses the account's assigned permissions.
2. **API Key via login** — `zilliz login --api-key` — prompts for API key, no browser needed.
3. **API Key via configure (legacy)** — `zilliz configure` — prompts for API key, simpler setup.
4. **Environment variable** — configure `ZILLIZ_API_KEY` with a token supported by the intended API endpoint.

**IMPORTANT:** These commands require interactive input and cannot run inside the agent. Do NOT ask the user to paste API keys into the chat.

Do not require `zilliz auth status` to succeed for a data-plane-only workflow. If an endpoint and context are already available, validate them with `zilliz database list --output json` or `zilliz collection list --output json`.

## Step 3: Resolve the target context

When control-plane discovery is available, list clusters:

```bash
zilliz cluster list --output json
```

If discovery is unavailable, ask the user to configure the cluster ID and endpoint in their own terminal. Set an explicit context instead of treating discovery failure as an authentication failure:

```bash
zilliz context set --cluster-id <cluster-id> --endpoint <endpoint>
zilliz database list --output json
zilliz context set --database <database-name>
```

Use a database returned by the service or an existing database already stored in context. Do not assume its name.

## Step 4: Verify the requested capability

Confirm the data-plane context and perform a non-destructive probe:

```bash
zilliz context current --output json
zilliz collection list --output json
```

If the user also needs control-plane operations, verify the relevant read command separately. Report which capabilities were verified and which were unavailable without inferring the reason from a service label alone.
