---
name: ship24-tracking-statuses
description: Map Ship24 tracking statuses to application logic using statusMilestone, statusCode and statusCategory. Use when asked "Ship24 status", "statusMilestone", "statusCode", "statusCategory", "is the parcel delivered", "terminal status", "notify the customer on status change", "sample tracking numbers", or when deciding which status field to store, filter or alert on. Covers the 8 milestones, 6 categories and 20 codes, event ordering, and the SHIP24_SAMPLE_* test numbers.
license: MIT
---

# Tracking statuses

Source: [Status](https://docs.ship24.com/status). The OpenAPI spec types these fields as plain strings and does
not encode the enums, so the docs table, mirrored in `references/statuses.md`, is the authoritative list.

## Three fields

| Field | Where | Meaning |
| --- | --- | --- |
| `statusMilestone` | every event, and at shipment level | Overall status of the shipment at that moment. Always present. |
| `statusCategory` | events | Category of the event (`data`, `transit`, `destination`, `customs`, `delivery`, `exception`). May be empty on non-significant events. |
| `statusCode` | events | Codified meaning of the event (20 values). May be empty on non-significant events. |
| `status` | events | Raw courier text, not normalized (for example `ENTREGADO. Su envío está entregado.`). Display it, never branch on it. |

For a high-level state use `shipment.statusMilestone`. For fine-grained triggers use `events[].statusCode`.

## Milestones

| `statusMilestone` | Label | Description (docs) | Typical handling |
| --- | --- | --- | --- |
| `pending` | Pending | The shipment doesn’t have events available yet or can’t be found. | Wait; if it persists, check the courier and required fields (`ship24-couriers`). |
| `info_received` | Info. Received | The shipment has been declared electronically and/or is in preparation by the shipper. | Show "label created". |
| `in_transit` | In Transit | The shipment has been accepted or picked up from the shipper and is on the way. | Default active state. |
| `out_for_delivery` | Out for Delivery | The shipment is about to be delivered, usually the same day. | Notify the recipient. |
| `failed_attempt` | Failed Attempt | A delivery attempt was made and failed (Recipient not available, business closed, etc.) | Notify; the courier usually retries or leaves the parcel at a pickup point. |
| `available_for_pickup` | To Pick Up | The shipment is ready to be picked up by the receiver. (At a pickup point such as a post office, a locker, or a local business) | Notify with urgency. |
| `delivered` | Delivered | The shipment has been delivered. (Delivered at home, picked up from a pickup point, etc.) | Close the flow. |
| `exception` | Exception | The shipment can’t be delivered due to issues that seem to be final (Returning, returned, lost, destroyed, etc.) | Open a support case. |

Ship24 documents no "terminal" flag. Trackers are disabled automatically after delivery, and `isTracked: false`
means tracking has stopped (delivery, inactivity or unsubscription). Stop polling on `isTracked`, not on a
status, and keep processing any webhook that still arrives.

## Categories and codes

Full table in `references/statuses.md`. Codes worth dedicated business rules:

| `statusCode` | Category | Meaning (docs) |
| --- | --- | --- |
| `delivery_delivered` | delivery | Shipment has been delivered. |
| `delivery_attempted` | delivery | Delivery attempted and unsuccessful. Usually, the delivery will be tried again the next day, or the shipment will be left at a pick-up point. |
| `delivery_available_for_pickup` | delivery | Shipment available for pickup at a pick-up point or at the Post Office. |
| `delivery_exception` | delivery | Issue during delivery or preventing delivery, which usually could be solved. |
| `delivery_refused` | delivery | Shipment refused by the recipient. |
| `customs_exception` | customs | Exception or delay during customs clearance. Additional documents or payment may be required. |
| `customs_rejected` | customs | Shipment rejected by customs. |
| `exception_return` | exception | Shipment undeliverable, will be or being returned. |
| `exception_lost` | exception | Shipment lost by the carrier. |
| `exception_discarded` | exception | Shipment destroyed by the carrier. |

## Timestamps and ordering

- `statistics.timestamps` holds the first-occurrence datetime of each milestone
  (`infoReceivedDatetime`, `inTransitDatetime`, `outForDeliveryDatetime`, `failedAttemptDatetime`,
  `availableForPickupDatetime`, `exceptionDatetime`, `deliveredDatetime`). Use it for timelines and durations.
- `events[].occurrenceDatetime` is a `logistic-date-time`: `2022-10-23T15:13:37` (courier local time),
  `2022-12-21T17:01:12+02:00`, `2022-09-03T23:58:12Z`, or a bare date `2022-08-14`. Store it as a string.
  When the time is missing, sort with the event `order` field (lower is older).
- API responses return the full event history; a webhook item carries exactly one event, and Ship24 does not
  guarantee delivery order. Compare `occurrenceDatetime` with the latest stored event before acting.
- `datetime`, `utcOffset` and `hasNoTime` on events are deprecated in favor of `occurrenceDatetime`;
  `signedBy` on `shipment.delivery` is deprecated too.

## Sample tracking numbers

Each sample simulates a set of events, with the corresponding `statusMilestone` updates, up to the desired
milestone. Change the last three digits to mint a new tracker with identical results, or reuse the exact number
with a unique `clientTrackerId`.

| `statusMilestone` | Sample |
| --- | --- |
| `pending` | `SHIP24_SAMPLE_PENDING_000` |
| `info_received` | `SHIP24_SAMPLE_INFO_RECEIVED_000` |
| `in_transit` | `SHIP24_SAMPLE_IN_TRANSIT_000` |
| `out_for_delivery` | `SHIP24_SAMPLE_OUT_FOR_DELIVERY_000` |
| `failed_attempt` | `SHIP24_SAMPLE_FAILED_ATTEMPT_000` |
| `available_for_pickup` | `SHIP24_SAMPLE_AVAILABLE_FOR_PICKUP_000` |
| `delivered` | `SHIP24_SAMPLE_DELIVERED_000` |
| `exception` | `SHIP24_SAMPLE_EXCEPTION_000` |

For integration and testing, the docs point to the free plan ([Getting started](https://docs.ship24.com/getting-started)).

## Sibling skills

`ship24-webhooks` for receiving events, `ship24-integration` for the overall flow, `ship24-troubleshooting`
when a status never moves past `pending`.
