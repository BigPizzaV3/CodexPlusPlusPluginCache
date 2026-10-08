# ADR 0001 — Use the MIT License

- **Status:** Accepted
- **Date:** 2026-09-18
- **Decision owner:** Cecil-IA Labs

## Context

Milestone 0 left the public project license as `TBD`, while Milestone 1 requires a concrete `LICENSE` file and publishable npm metadata.

The project is a developer toolkit/CLI intended for broad reuse and extension. One preserved legacy script (`stack_vertical.sh`) already carries MIT-compatible attribution requirements, but that third-party attribution remains independent and must continue to be preserved in its source file and any derived implementation where required.

## Decision

Use the **MIT License** for the FFmpeg Media Toolkit source created by Cecil-IA Labs.

## Consequences

- The npm package can declare `license: MIT`.
- The portable plugin manifest can declare `license: MIT`.
- Third-party source attribution remains preserved separately.
- A future relicensing decision would require a new ADR and appropriate rights/consent.
