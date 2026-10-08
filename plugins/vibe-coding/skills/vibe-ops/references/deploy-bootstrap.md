# Deploy Bootstrap

## Select the deployment target

Prepare a minimal CI/CD setup for the user's actual project and chosen hosting target. Inspect existing deployment files first. Preserve the provider, branch, package manager, runtime and operational conventions the user or repository already selected. Do not impose root SSH, Cloudflare, Nginx, GitHub or Docker on a different target.

When the user requests a Linux/SSH/Compose deployment, use GitHub Actions, Docker Compose v2, host Nginx and health checks only where applicable. Read deployment user, path, domain, ports, health route and migration command from configuration or request; prefer an existing limited deployment identity. Missing external values belong in clearly documented configuration inputs, not guessed live credentials.

## Detect and implement

Identify build/start/check commands, lockfile, process topology, workers, database migrations, environment validation and health behavior. Create only the necessary Dockerfile/Compose, CI/CD workflow, deployment script, Nginx template and concise first-run runbook.

Deploy the exact triggering commit or immutable artifact, never a moving branch head. Separate pull-request verification from the selected release trigger; avoid duplicate deploy events. Serialize releases for a target. Give workflows only required permissions. Validate SSH host identity through the project's trusted mechanism; do not disable host-key checking.

Require explicit release identity before a deploy. Use a dedicated release directory or the repository's established deploy mechanism; do not reset a user's checkout. Inject secrets without printing them and use restrictive file permissions. Bind app ports to loopback when host Nginx is the entry point; background workers should not publish ports unless required.

Coordinate migrations with old/new application compatibility and a truthful rollback or forward-fix plan. Validate Nginx configuration before reload. Cleanup follows successful health verification, stays scoped to this application's obsolete assets, and retains required rollback artifacts; do not run global Docker pruning by default.

## Validate and hand off

Check actual workflow/script syntax, container build/config and rendered configuration where tools exist. Record unavailable runtime checks. Return created files, verified commands and required external setup. Preparing the setup does not itself authorize connecting to a server, changing secrets or deploying; execute such actions only within the user's authorization.
