# Customer.io — Namespaces and Field Paths

Getting the prefix right is most of getting a Customer.io template right — and a wrong prefix renders **empty with no error**, so nothing surfaces the mistake.

## Contents

1. [The namespaces](#1-the-namespaces)
2. [Which namespace exists in which workflow](#2-which-namespace-exists-in-which-workflow)
3. [Objects and relationships](#3-objects-and-relationships)
4. [Journey attributes and collections](#4-journey-attributes-and-collections)
5. [Event metadata](#5-event-metadata)
6. [Reserved and system attributes](#6-reserved-and-system-attributes)
7. [Meta keys](#7-meta-keys)
8. [Limits](#8-limits)

---

## 1. The namespaces

```liquid
{{customer.<attribute_name>}}                    profile attributes — ANY message
{{journey.<attribute_name>}}                     journey attributes — ANY message
{{event.<property>}}                             custom-event- or geofence-triggered ONLY
{{trigger.<data.property>}}                      transactional, API-triggered broadcasts, webhook-triggered
{{trigger.<object_type>.<attribute>}}            object-triggered (SINGULAR slug)
{{trigger.relationship.<attribute>}}             object- or relationship-triggered
{{trigger.customer.<attribute>}}                 relationship-triggered: the person WHOSE relationship fired
{{customer._relationship.<attribute>}}           relationship attrs of the RECIPIENT
{{objects.<object-type>[#].<attribute>}}         non-trigger object access (PLURAL slug)
{{objects.<object-type>[#].relationship.<attr>}} relationship attrs on that object
```

### Rules Customer.io states explicitly

> *"You'll **always** use the object `event` to reference event trigger data, **never the actual name of the event**."*

**`event` is already the data object.** Write `{{event.product_name}}`, not `{{event.data.product_name}}`.

You can only reference the **triggering** event — not events used in Wait Until conditions or conversion criteria.

**Singular under `trigger.`, plural under `objects.`** — an object-triggered workflow uses `{{trigger.reservation.check_in_date}}` for the object that fired it and `{{objects.reservations[0].check_in_date}}` for general access.

`{{trigger.customer.<attr>}}` in a relationship-triggered workflow is **the person whose relationship fired**, which is not necessarily the recipient. The recipient is `{{customer.<attr>}}`, and their relationship attributes are `{{customer._relationship.<attr>}}`.

### Bracket notation for awkward names

```liquid
{{ customer["current city"] }}
{{ customer["attribute.name"] }}
{{ snippets["main address"] }}
```

**Attribute names are case-sensitive** — `first_name` and `First_name` are two different attributes. Avoid spaces, periods, hyphens, and special characters when designing a schema.

### The name-collision escape hatch

Don't name object types "Customers" or "Relationships". If you already did, the underscore-prefixed forms reach the trigger data instead of the object data:

```liquid
{{trigger._customer.<attribute>}}
{{trigger._relationship.<attribute>}}
```

Without the underscore, `{{trigger.customer.x}}` resolves to *object* data.

### Namespaces that do NOT exist

`{{trigger.relationship_attributes.*}}` · `{{object.*}}` (singular root) · `{{trigger.<plural_slug>}}`

These render empty and the message sends. That's the failure mode to look for when a value is silently missing.

---

## 2. Which namespace exists in which workflow

| Workflow trigger | `customer` | `journey` | `event` | `trigger` | `objects` |
|---|---|---|---|---|---|
| Segment / attribute-based | ✅ | ✅ | ❌ | ❌ | ✅ |
| Custom event | ✅ | ✅ | ✅ | ❌ | ✅ |
| Geofence event | ✅ | ✅ | ✅ | ❌ | ✅ |
| Transactional API | ✅ | ✅ | ❌ | ✅ | ✅ |
| API-triggered broadcast | ✅ | ✅ | ❌ | ✅ | ✅ |
| Webhook-triggered | ✅ | ✅ | ❌ | ✅ | ✅ |
| Object-triggered | ✅ | ✅ | ❌ | ✅ (singular slug) | ✅ |
| Relationship-triggered | ✅ | ✅ | ❌ | ✅ (`.customer`, `.relationship`) | ✅ |

Event- and segment-triggered automations have **no `trigger.<object>` namespace at all**.

---

## 3. Objects and relationships

```liquid
{{objects.online_classes[0].class_name}}
{{objects.online_classes[0].relationship.enrolled_at}}
{{customer._relationship.membership_tier}}
```

**Ordering and limits:** `[0]` is the **most recently created** object the person is related to; `[9]` is the oldest. **Maximum 10 objects of the same type** per profile — an 11th never renders.

Indexing is **relative per profile** — `objects.online_classes[0]` is a different class for different people.

`[0]` is **not** necessarily the triggering object. Use `{{trigger.<object_type>}}` for that.

**Size comparison gotcha:**

```liquid
{{ objects.online_classes | size }}         filter form
{{ objects.online_classes.size }}           dot form

{% if objects.online_classes.size > 0 %}    ✅
{% if objects.online_classes.size == 0 %}   ❌ documented as not working
```

Use `> 0` with the dot form.

---

## 4. Journey attributes and collections

**Journey attributes** are temporary per-journey data, written by workflow actions and readable in any message in that journey:

```liquid
{{journey.order_total}}
{% for item in journey.recommended_products %}{{ item.name }}{% endfor %}
```

Limits: **100 per journey** — further updates **fail silently** and the profile moves on. Name ≤ **128 bytes**, value ≤ **100 KiB**. Deleted when the journey ends.

**Collections are not addressable in Liquid.** There is no `collections.<name>` or `collections[1].items`. You must add a **Collection Query action** to the workflow, which writes its results into a journey attribute:

```liquid
{% for item in journey.recommended_products %}
  {{ item.name }} — {{ item.price }}
{% endfor %}
```

This surprises people who expect to read a collection directly. If someone is trying to, the fix is a workflow change, not a template change.

**Segments are also not readable in Liquid.** There is no segment-membership namespace. Segments gate *who enters* a workflow; branch on attributes inside the template instead.

---

## 5. Event metadata

Top-level, no prefix:

```liquid
{{event_name}}         the event name as sent; casing follows the profile's stored casing
{{event_id}}           unique per event
{{event_timestamp}}    UNIX epoch of the event — NOT the same as `now`
```

**All three throw an error if the event hasn't been sent recently (within ~30 days).** That 30-day window also governs whether event data appears in the personalization panel at all.

---

## 6. Reserved and system attributes

**Profile:** `id` · `email` · `phone` · `cio_id` · `created_at` · `_created_in_customerio_at` · `unsubscribed` · `cio_email_tracking_consent` · `timezone` · `timezone_valid` · `mobile_ad_id` · `email_sha256` · `mobile_ad_id_sha256`

**Object:** `cio_object_id` · `object_id` · `objectId` · `relationship` · `_relationship` · `created_at` · `timezone`

**`timezone_valid`** is the only documented system-maintained computed attribute — a read-only boolean, `true` only for valid IANA values. Segment on `timezone_valid equals false AND timezone exists` to find profiles needing repair.

---

## 7. Meta keys

```liquid
{{campaign.id}}  {{campaign.name}}  {{campaign.type}}  {{campaign.subscription_topic_ids}}
{{message.id}}  {{message.name}}  {{message.type}}  {{message.subject}}  {{message.preheader}}
{{message.journey_id}}  {{message.send_to_unsubs}}
{{message.subscription_topic_ids}}  {{message.subscription_topic.name}}
{{delivery_id}}   {{content}}   {{editor}}
{{layout.id}}  {{layout.name}}
```

**`{{delivery_id}}`** is a URL-compatible base64 string, generated at draft/send. It renders **`unsent`** in previews and test messages.

**`{{campaign.type}}`** values: `behavioral` · `seg_attr` · `transactional` · `form` · `date` · `object` · `relationship`; `transactional_message` for the Transactional API; `triggered_broadcast` for API-triggered broadcasts and newsletters.

**`{{editor}}`** is one of `bee` · `html` · `wysiwyg` · `rich`, and is blank for Create/update person actions, in-app, Design Studio emails, SMS, and custom push.

**`{{message.type}}`** full enum: `email_action, delay_seconds_action, delay_time_window_action, split_randomized_action, webhook_action, twilio_action, slack_action, attribute_update_action, filter_match_delay_action, grace_period_action, push_action, conditional_wait_action, conditional_branch_action, multi_split_branch_action, random_cohort_branch_action, exit_action, static_seg_update_action, collection_query_action, create_event_action, multi_lang_branch_action, batch_update_action, in_app_action`

`{{sendListIds}}`-style arrays render with `join`: `{{ campaign.subscription_topic_ids | join: "," }}`

---

## 8. Limits

| Item | Limit |
|---|---|
| Objects per object type per profile | **10** referenceable; `[0]` newest, `[9]` oldest; an 11th never renders |
| Journey attributes | **100 per journey** — further updates fail silently |
| Journey attribute name | 128 bytes |
| Journey attribute value | 100 KiB |
| Snippet size | 16 KB each (raisable on request) |
| Snippets total | **5 MB per workspace** |
| Countdown timer | **60 frames** max |
| Test emails | **25 addresses** per send; trial accounts capped daily |
| Event data availability (preview, `event_name`, `event_id`, `event_timestamp`) | **~30 days** |
| Profile `id` | 150 characters by default |
| `send_at` on transactional | up to **90 days** in the future |
| Transient-error retries | up to **11 times over ~1 hour** |

---

## Sources

Customer.io: [Using Liquid](https://docs.customer.io/messaging/liquid/using-liquid/) · [Objects in Liquid](https://docs.customer.io/messaging/objects-data/objects/in-liquid/) · [Manage attributes](https://docs.customer.io/messaging/profiles/manage/attributes/) · [Tag list](https://docs.customer.io/messaging/liquid/tag-list/) · [Snippets](https://docs.customer.io/messaging/liquid/snippets/) · [Webhook actions](https://docs.customer.io/messaging/send/workflows/webhooks/action/) · [Previewing broadcast data](https://docs.customer.io/messaging/send/broadcasts/previewing-broadcast-data/) · plus the official Customer.io MCP skill `recipes/liquid_syntax.md`, which is the source for the collections, singular-vs-plural-slug, and silent-empty-namespace facts.
