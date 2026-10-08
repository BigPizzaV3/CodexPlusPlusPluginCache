---
name: vibe-go-rust
description: "Audit, fix or verify Go goroutine or Rust async task ownership, cancellation, pools, backpressure, errors and ordered service shutdown."
---

# Go & Rust services

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Go Rust Concurrency & Shutdown Check](references/go-rust-concurrency-shutdown-check.md) | check |
| [Go Rust Microservices Audit](references/go-rust-microservices-audit.md) | audit |
| [Go Rust Microservices Polish](references/go-rust-microservices-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
