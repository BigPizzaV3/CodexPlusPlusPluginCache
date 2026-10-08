# Sanctions screening controls

Screening produces evidence under a particular program, dataset, configuration, query, and time. It does not produce an eternal clearance or let software make the legal disposition. Translate the current, jurisdiction-specific compliance program into explicit system states with named compliance and legal owners.

## Model evidence separately from disposition

Preserve at least:

- the stable customer, counterparty, transaction, payment, and screening request identities;
- normalized query inputs and protected raw evidence, including the parties, intermediaries, ownership, geography, and transaction attributes required by the actual program;
- provider, dataset and list identifiers or versions, configuration and policy version, request time, response completeness, candidate identifiers, scores, reasons, and source evidence;
- adjudication decision, reviewer and approval authority, reason, evidence references, time, and any expiry or rescreen trigger.

Keep screening evidence distinct from the financial lifecycle. `pending`, `provider-unavailable`, `partial`, `candidate`, and `adjudicated` are not interchangeable. The payment may separately be held, rejected, blocked, released, returned, or reported as the applicable program directs.

A fuzzy-match score is a retrieval signal. Thresholds trade false positives against false negatives and must be calibrated, tested, and owned under the risk program. Do not encode one universal threshold or treat a model score as a sanctions determination.

## Make uncertainty explicit

Timeout, malformed response, stale dataset, missing fields, and partial provider coverage must not silently map to `clear`. Define whether each flow fails closed, fails open under a documented exception, or enters a durable manual queue. That choice is legal and risk policy, not a generic availability optimization.

Persist the screening request before an irreversible effect when the program requires pre-transaction screening. Use stable operation identity so retries and regional recovery cannot create a second hold, release, rejection, or economic effect. A late response must be correlated to the current payment and screening generation before it can transition state.

## Handle changing lists and facts

Define rescreen triggers from the actual program: list or sanctions-program changes, material customer or beneficial-ownership changes, counterparty or intermediary changes, geography, new transaction facts, expiry, or periodic review. Version decisions so a later review does not erase what was known and applied earlier.

False-hit suppression requires compliance oversight, specific matching evidence, periodic reassessment, and invalidation when relevant list entries or subject facts change. Never use an unbounded name-only allowlist that suppresses future candidates across tenants or changed identities.

## Protect and operate the queue

Minimize PII in logs, metrics, traces, tickets, and model or tool inputs. Use opaque correlation identifiers and access-controlled evidence storage. Separate screening-provider access, adjudication, hold/release authority, override approval, and audit administration where the program requires it.

Monitor list freshness, screening coverage, incomplete/error rates, queue age, time to adjudication, override use, rescreen volume, and release-after-hold outcomes without exposing sensitive attributes. Alert on stale lists, silent response-shape changes, growing unknown states, and bypass paths. Test known candidates, nonmatches, alternate spellings, changed identifiers, list updates, provider outages, late responses, duplicate delivery, and false-hit invalidation.

The output must state the governing program/version, screened entities and events, uncertainty behavior, disposition authority, idempotency boundary, evidence retained, privacy boundary, and unresolved legal interpretation. Do not claim that code review establishes sanctions compliance.
