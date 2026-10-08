# DevRecap Privacy

DevRecap is designed to reconstruct developer work from local evidence without background monitoring.

## Local sources

DevRecap can read the following sources only after explicit setup/authorization:

- local Codex session history;
- local Claude Code session history;
- read-only Git metadata for detected projects.

A source that is disabled in DevRecap setup is not collected. Git access is restricted to read-only query operations.

## What DevRecap stores

DevRecap may create local configuration and report artifacts such as:

- `~/.devrecap/config.json` for source permissions;
- `.devrecap/run.json` for structured report facts;
- `.devrecap/analysis.json` for the AI-written analysis;
- generated HTML/PDF reports when requested.

DevRecap does not create background watchers or continuously monitor development activity.

## AI processing

When DevRecap is used as a Codex or Claude skill, the host AI receives the structured, sanitized report contract produced by DevRecap and uses it to write the report. The skill instructs the host model to analyze only the allowed structured facts and not to expose raw transcripts, credentials, or secrets to improve prose.

Processing performed by the host AI is also subject to the privacy and data controls of that host product and account.

## Raw transcripts and secrets

DevRecap's report pipeline is designed so that raw session transcripts are not required as report prose. The factual layer extracts evidence-backed Activities and Workstreams first. Redaction and validation remain part of the reporting pipeline.

DevRecap does not intentionally transmit credentials or secrets to external services.

## User control

Collection is explicit-invocation only. Users can rerun `devrecap setup` to change which local sources are authorized, or use per-run source-disable flags where supported.

## Contact

Project repository: https://github.com/jquinteiroo/devrecap
