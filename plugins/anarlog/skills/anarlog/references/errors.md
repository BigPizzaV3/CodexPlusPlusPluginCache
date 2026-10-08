# Errors

## Meeting not found

List or search meetings again and use the returned ID. Do not retry a guessed ID.

## No meetings returned

An empty list means no meetings matched in that source. It does not mean the local database is unavailable. If the user did not restrict the source, check an already-connected alternate source for a missing meeting. Label any result with its source. An empty Cloud list can mean the snapshot has not uploaded; a remote agent cannot check local-only meetings. Do not invent meetings or claim that every source is empty.

## Database not found

Run `anarlog --json doctor`. Ask the user to open Anarlog once if the database does not exist. If they keep data in a custom location, use `--db-path FILE` or `ANARLOG_DB_PATH` after they provide the path.

## Database operation failed

Confirm the desktop app and CLI come from compatible revisions. Report the error instead of silently switching to Cloud. Do not run migrations or write SQL from the agent.

## Cloud command failed

Preserve the CLI's hosted error code. Run `anarlog auth login` again for `unauthorized`, ask the user to enable **Cloud API & Connectors** for `cloud_api_not_enabled`, and wait for the reported retry delay after `rate_limited`. Do not silently switch a user-requested `--source cloud` read to local data.

## Export output exists

Choose a new path. Pass `--force` only when the user explicitly approves replacing that exact file.

## MCP server exits

Run `anarlog --json meetings list` to distinguish database access from client configuration. Confirm the MCP command is `anarlog` and its only required argument is `mcp`. Missing meetings and proposals are invalid parameters. Validation and conflict failures, including declining a non-pending proposal, are internal MCP errors.

With `--json`, errors contain `schema_version` and an `error` object with `code`, `message`, and `exit_code`. CLI exit codes are `1` for an operation failure, `2` for missing data, `3` for a missing database, and `4` for an existing export target. Invalid CLI arguments use Clap's exit code and the `invalid_arguments` error code.
