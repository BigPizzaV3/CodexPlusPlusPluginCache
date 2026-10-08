# Trylle CLI workflows

Use these recipes after reading the core workflow in `SKILL.md`. Replace placeholders and run leaf `--help` before consequential writes.

## Contents

- [Authenticate safely](#authenticate-safely)
- [Create and publish a repository](#create-and-publish-a-repository)
- [Open and manage a pull request](#open-and-manage-a-pull-request)
- [Review and merge a pull request](#review-and-merge-a-pull-request)
- [Triage issues](#triage-issues)
- [Work with a PR stack](#work-with-a-pr-stack)
- [Diagnose CI](#diagnose-ci)
- [Manage variables and secrets](#manage-variables-and-secrets)
- [Use an uncovered public API endpoint](#use-an-uncovered-public-api-endpoint)

## Authenticate safely

Inspect current status first:

```bash
try auth status --json
try whoami --json
```

If no credential is configured, have the user create an API key in Trylle and place it in the environment outside the command transcript. Then save and clear it:

```bash
try auth login --json
unset TRYLLE_API_KEY
```

Do not inspect a token with `try auth token --show` during routine diagnosis. The masked `try auth token --json` output is sufficient to identify the credential source.

## Create and publish a repository

1. Confirm the target organization and role:

   ```bash
   try org view OWNER --json
   try repo view OWNER/NAME --json
   ```

   Continue past the expected `404` only when creating a new repository.

2. Review creation flags and create with explicit visibility and branch:

   ```bash
   try repo create --help
   try repo create NAME --owner OWNER --public --auto-init \
     --default-branch main --description "DESCRIPTION" --json
   ```

3. Clone through Trylle and enter the checkout:

   ```bash
   try repo clone OWNER/NAME DIRECTORY --json
   cd DIRECTORY
   try repo context --json
   ```

4. Make and verify local changes with `git`, then push the branch.

5. Re-read the repository and return its URL:

   ```bash
   try repo view OWNER/NAME --json
   try browse repo -R OWNER/NAME
   ```

If the server initializes the repository, clone that history instead of creating an unrelated local root commit.

## Open and manage a pull request

1. Inspect context and ensure the branch exists on `origin`:

   ```bash
   try repo context --json
   git status --short --branch
   git push -u origin HEAD
   ```

2. Check for an existing PR:

   ```bash
   try pr current --json
   ```

   A nonzero `no open pull request found` result is the expected absence case. Use the `currentPullRequest` field from `try repo context --json` when a JSON `null` is easier to handle.

3. Create a PR with explicit base and a body file:

   ```bash
   try pr create --title "TITLE" --base main --body-file /path/to/body.md --json
   ```

4. Verify and return a URL:

   ```bash
   try pr status NUMBER --json
   try browse pr NUMBER
   ```

Use `--draft`, repeated `--label`, `--assignee`, and `--reviewer` flags only when requested. Do not create a second PR when `try pr current` finds one.

## Review and merge a pull request

1. Read the PR, structured diff, and live status:

   ```bash
   try pr view NUMBER -R OWNER/NAME --json
   try pr diff NUMBER -R OWNER/NAME --json
   try pr status NUMBER -R OWNER/NAME --json
   ```

2. Submit exactly one review event:

   ```bash
   try pr review NUMBER -R OWNER/NAME --approve --body-file /path/to/review.md --json
   ```

   Replace `--approve` with `--request-changes` or `--comment` when appropriate.

3. Before merging, re-run status and confirm the method and branch-deletion choice. Then execute only when authorized:

   ```bash
   try pr merge NUMBER -R OWNER/NAME --method squash --delete-branch --json
   ```

4. Verify the merged state with `try pr view` and return `try browse pr`.

## Triage issues

Start with a sufficiently large page and then inspect candidates:

```bash
try issue list -R OWNER/NAME --state open --per-page 100 --json
try issue view NUMBER -R OWNER/NAME --json
try issue timeline NUMBER -R OWNER/NAME --json
```

Apply additive label changes when unrelated labels must remain:

```bash
try issue label NUMBER -R OWNER/NAME --add triage --remove needs-info --json
```

Use `--set` only when replacing the entire label set is intentional. After comments, label changes, closing, or reopening, re-read the issue and return its `try browse issue` URL.

## Work with a PR stack

Create each dependent branch from its intended parent:

```bash
try stack create feature/child --json
```

After opening the PR, record the parent relationship:

```bash
try stack track --pull CHILD_NUMBER --parent PARENT_NUMBER --json
try stack log --json
```

Navigate or update the current branch:

```bash
try stack prev --json
try stack next --json
try stack restack --json
try stack sync --pull PARENT_NUMBER --json
```

`restack` performs a git rebase and can stop on conflicts. Inspect the working tree before it, preserve local changes, and resolve or abort conflicts deliberately. `stack submit` pushes `HEAD` and creates a PR if none exists, so treat it as both a git and platform write.

## Diagnose CI

1. List recent runs and select the exact run ID:

   ```bash
   try ci list -R OWNER/NAME --limit 20 --json
   try ci view RUN_ID --json
   ```

2. Read logs:

   ```bash
   try ci logs RUN_ID
   ```

3. Re-read the run for fresh state. On CLI 1.0.0, `watch` and `logs --follow` do not continuously poll.

4. Cancel only after confirming the run is active and the user intended cancellation:

   ```bash
   try ci cancel RUN_ID --json
   ```

## Manage variables and secrets

Read metadata and exact help first:

```bash
try actions variable list -R OWNER/NAME --json
try actions secret list -R OWNER/NAME --json
try actions secret set --help
```

Plain variables can be set directly when they are not sensitive:

```bash
try actions variable set NAME VALUE -R OWNER/NAME --json
```

For a secret, require the value to already exist in an environment variable and keep the value out of the recorded command:

```bash
try actions secret set NAME "$SECRET_VALUE" -R OWNER/NAME --json
unset SECRET_VALUE
```

Re-list metadata to verify. Use `try org secret ORG ...` or `try actions secret ... --org ORG` for organization scope.

## Use an uncovered public API endpoint

1. Confirm no first-class command covers the operation.
2. Inspect the public API contract and use a `/v1` path only.
3. Start with a GET and `--json` when possible:

   ```bash
   try api /v1/example -q owner=OWNER -q repo=NAME --json
   ```

4. For writes, prefer a JSON file or stdin over complex inline fields:

   ```bash
   try api /v1/example -X post --input /path/to/body.json --json
   ```

5. Re-read the affected resource with a first-class command or a GET request.
