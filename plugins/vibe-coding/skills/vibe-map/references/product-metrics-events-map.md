# Product Metrics Events Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/product_metrics_events_map.md` as the evidence-backed index of product metrics, analytics events, funnels, experiments, telemetry ownership, and event-to-capability traceability.

## Inspect

Analytics SDK setup, event emitters, tracking helpers, server-side events, data warehouse/ClickHouse/db tables, experiment flags, dashboard configs, docs, tests, privacy/consent gates, retention configs, generated clients, and product surfaces that trigger events.

## Map rules

- Write or update `docs/product_metrics_events_map.md` when possible; otherwise print the complete markdown.
- Preserve stable IDs: metric `MET-*`, event `EVT-*`, funnel `FUN-*`, experiment `EXP-*`, property `PROP-*`, dashboard `DASH-*`.
- Anchor events and metrics to implementation evidence, not only dashboard/docs names.
- Mark privacy, consent, PII, sampling, identity, deduplication, timezone, and environment boundaries when discoverable.
- Do not infer business targets or KPI thresholds unless repository docs/configs provide them.

## Coverage

Cover core product metrics, event taxonomy, event producers, payload properties, identity/session/tenant keys, consent/privacy gates, experiments, dashboards or queries, tests, known missing events, duplicated/drifting names, and downstream consumers.

## Markdown structure

Use summary, conventions, metric inventory, event taxonomy, producer/consumer matrix, funnel and experiment links, privacy/retention notes, tests, drift/gaps, and unknowns.
