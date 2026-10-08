---
name: ship24-couriers
description: Ship24 courier codes, courier auto-detection and per-courier required fields. Use when asked "which courier code for <carrier>", "force the courier", "does <carrier> need a postcode", "courier not detected", "courierCode", "list of couriers Ship24 supports", or when a tracker returns no results and the courier may be the cause. Explains when to send courierCode, the 3-per-request limit, requiredFields, deprecated codes, and how to fetch the courier list once and cache it instead of calling GET /couriers on every request.
license: MIT
---

# Courier codes and detection

Sources: [Couriers](https://docs.ship24.com/couriers) and the `GET /couriers` operation in the OpenAPI spec
(field table in `references/courier-fields.md`). The courier list itself is not bundled: it changes over time, and a
stale code is silently ignored by the API, so always read it from the live API.

## Auto-detection first

Ship24 detects the courier from the tracking number in most cases. `courierCode` is optional. Send it when:

- the user already knows the courier (it improves accuracy and avoids ambiguous matches);
- a tracker returned no results and the courier is a plausible cause;
- tracking must be restricted to specific couriers (`settings.restrictTrackingToCourierCode: true`).

Do not guess a code. If the courier is unknown, omit the field and let Ship24 detect it.

## Format and limits

| Rule | Value | Source |
| --- | --- | --- |
| Type | string or array of strings | OpenAPI `tracker-create-request` |
| Per request | up to 3 codes | Couriers page |
| Per shipment | up to 9 codes in total; `PATCH /trackers/{trackerId}` is the documented way to add codes afterward | Couriers and Trackers pages |
| Deprecated code (`isDeprecated: true`) | silently ignored, not rejected | Couriers page |
| `settings.restrictTrackingToCourierCode` | `true` pins tracking to the given codes only | OpenAPI |

`tracker_conflict` means a tracker with similar conflicting parameters already exists. Provide additional
parameters such as `shippingDate` or `destinationCountryCode` to differentiate it (see `ship24-troubleshooting`).

## Required fields per courier

Each courier entry carries `requiredFields`, a list of values that Ship24 needs to retrieve results for that
courier. Ship24 does not reject a request that omits them, but it may then fail to find the shipment.

| `requiredFields` value | Tracker field to send |
| --- | --- |
| `destinationPostCode` | `destinationPostCode` (1 to 32 chars) |
| `destinationCountryCode` | `destinationCountryCode` (ISO 3166-1 alpha-2 or alpha-3) |
| `courierAccount` | No matching request field exists in the spec today, so it cannot be supplied through the API. |

The dashboard CSV export exposes the same information as `is_destination_postcode_required`,
`is_destination_country_code_required`, `is_courier_account_required` columns.

## `courierCode` is not `sourceCode`

`courierCode` identifies the courier you ask Ship24 to track with (for example `us-post`). Event `sourceCode`
identifies the data source Ship24 obtained the event from (for example `usps-tracking`). They differ, and
source codes may evolve; never feed a `sourceCode` back as a `courierCode`.

## Getting the courier list

| Source | How | Notes |
| --- | --- | --- |
| Live API | `GET /couriers` or the `get_couriers` MCP tool | Full list, unpaginated, rate limit 1 request per second. Fetch once per session or deployment, cache it, never call it per request. |
| Dashboard | Integrations → Couriers, CSV download | Same data for humans. |

To answer "which code for <carrier>", fetch the list once and filter it locally on `courierName` and
`courierCode`; the response is large, so do not paste it whole into the conversation. Skip entries with
`isDeprecated: true`. `isPost` is `true` when the courier is a postal operator; `countryCode` is the courier's
main country and may be `null`.

Codes appearing in the OpenAPI examples: `us-post` (USPS), `fr-post` (La Poste), `palletways` (Palletways). For
any other courier, call the API; do not invent codes.

## Sibling skills

`ship24-integration` for the tracker creation flow, `ship24-troubleshooting` for `validation_error`,
`tracker_conflict` and "no results" triage.
