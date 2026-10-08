# SFMC — Data Sources and Field Paths

## Contents

1. [The two substitution engines](#1-the-two-substitution-engines)
2. [Personalization strings](#2-personalization-strings)
3. [System and built-in strings](#3-system-and-built-in-strings)
4. [Sendable Data Extensions](#4-sendable-data-extensions)
5. [Journey Builder data binding](#5-journey-builder-data-binding)
6. [What AMPscript can and cannot see in a journey](#6-what-ampscript-can-and-cannot-see-in-a-journey)
7. [Data views](#7-data-views)
8. [Send logging](#8-send-logging)
9. [Contact Builder attribute groups](#9-contact-builder-attribute-groups)

---

## 1. The two substitution engines

| Engine | Syntax | Resolved by | When | Case |
|---|---|---|---|---|
| Personalization strings / AMPscript | `%%FieldName%%`, `%%=Fn()=%%`, `%%[ ]%%` | Email compiler | Send/build time, per subscriber | **Insensitive** |
| Journey Builder data binding | `{{Contact.Attribute…}}`, `{{Event.<key>.<field>}}` | Journey Builder engine | Before the message reaches the compiler | **Sensitive** |

Conflating these is the single biggest source of SFMC personalization bugs. They have opposite case rules and different escaping for names with spaces.

---

## 2. Personalization strings

```
%%FieldName%%              outside an AMPscript block
FieldName                  inside a block or a function — no %% wrapper
[First Name]               square brackets for any non-alphanumeric character
```

**Case-insensitive** — *"All personalization strings are case-insensitive."*

**Sources that can back an attribute string:**

- Email Subscriber **Profile Attributes** (All Subscribers list)
- **Sendable Data Extension fields**
- **Journey Builder entry source attributes**
- MobileConnect / MobilePush attributes

Profile Attributes and Data Extension fields use identical syntax — SFMC resolves from whichever context is present.

**`%%firstname%%` and `%%lastname%%` are derived**, not stored: they split the **FullName** profile attribute on the first space.

---

## 3. System and built-in strings

Available regardless of the Data Extension's schema.

**Identity**

```
%%emailaddr%%              %%_subscriberkey%%        %%subscriberid%%
```

**Job and send**

```
%%jobid%%                  %%_JobSubscriberBatchID%%
%%listid%%                 %%listsubid%%             %%_listname%%
%%_DataSourceName%%        The audience name the email was sent to
%%emailname_%%             %%_emailid%%
%%_IsTestSend%%            True when the job is marked a test send
%%_messagecontext%%        Context in which the message was viewed
%%_MessageTypePreference%% Text or HTML
%%_PreHeader%%
```

**Standard links**

```
%%view_email_url%%         %%profile_center_url%%    %%subscription_center_url%%
%%unsub_center_url%%       %%ftaf_url%%
```

**Business unit / physical address block**

```
%%memberid%%               %%member_busname%%        %%member_addr%%
%%member_city%%            %%member_state%%          %%member_postalcode%%
%%member_country%%
```

**Sender profile**

```
%%replyname%%              %%replyemailaddress%%
```

**Send-date strings**

```
%%xtmonth%%   %%xtday%%   %%xtyear%%   %%xtshortdate%%
%%xtlongdate%%   %%xtdayofweek%%   %%xtmonthnumeric%%
```

**Analytics**

```
%%linkname%%   %%_ImpressionRegionID%%   %%_ImpressionRegionName%%
```

**Contact model (MobileConnect / Contact Builder)**

```
_ContactKey  _MobileNumber  _CarrierID  _Channel  _City  _ContactID
_CountryCode  _CreatedBy  _CreatedDate  _FirstName  _IsHonorDST  _LastName
_ModifiedBy  _ModifiedDate  _Priority  _Source  _SourceObjectID  _State
_Status  _UTCOffset  _ZipCode
```

`%%_IsTestSend%%` and `{{Context.IsTest}}` are the two ways to branch content for tests.

---

## 4. Sendable Data Extensions

The **Used For Sending** checkbox makes a DE available for sends. You then relate one DE field to the subscriber table — acceptable types are **Text, Email Address, or Phone**, mapping to **SubscriberKey**.

Via API: `IsSendable = true`, plus `SendableDataExtensionField` (the DE column) and `SendableSubscriberField` (the subscriber attribute). When the account uses subscriber keys, `SendableSubscriberField.Name` must be `Subscriber Key`.

**A sendable DE does not gain `_subscriberkey` or `emailaddr` as columns.** Those are system personalization strings, available at send time regardless of schema. What the DE itself needs is:

- a primary key
- a field of type `EmailAddress`
- the send relationship mapping

**Multiple or missing EmailAddress fields prevent new subscriber creation** — a documented failure mode.

**De-duplication is by key, not address:** *"the system removes duplicate entries from your data extension list based on the key value, and not the email address."*

---

## 5. Journey Builder data binding

### Journey Data vs Contact Data

- **Journey Data** — *"Initial data value about a customer… preserves the state of a contact's data at the moment an entry event fires."* A **static snapshot**.
- **Contact Data** — *"Current data value"*, from your Contact Builder model, evaluated **live** at the point of use.

Entry filters on Data Extensions use **Contact Data only**.

### Exact syntax

**Journey (event/entry) data:**

```
{{Event.<EventDefinitionKey>.<FieldName>}}

{{Event.my-custom-product-entry-event-key.ProductId}}
{{Event.APIEvent-645f4e45-e4b7-379d-8ccc-e44551c315f4."Email"}}
```

**Contact data:**

```
{{Contact.Attribute.<AttributeSetName>.<FieldName>}}

{{Contact.Attribute.ContactInfo.FavoriteColor}}
{{Contact.Attribute.Person.Work.PostalCode}}
{{Contact.Attribute."Product Orders"."Product Name"}}
```

**Identity and defaults:**

```
{{Contact.Key}}
{{InteractionDefaults.Email}}
{{Contact.Default.SMS}}   {{Contact.Default.Twitter}}   {{Contact.Default.Facebook}}
```

**Output of a prior activity:**

```
{{Interaction.[ActivityCustomerKey].[OutArgumentName]}}
```

**Context:**

```
{{Context.IsTest}}            {{Context.PublicationId}}
{{Context.DefinitionId}}      {{Context.DefinitionInstanceId}}
{{Context.StartActivityKey}}  {{Context.VersionNumber}}
```

### Rules

- **Case-sensitive.** *"Data binding expressions are case-sensitive. Ensure that the expression exactly match your data extension name and field name."*
- **Names with spaces or special characters need double quotes**, not square brackets.
- **A contact must exist in all linked data extensions** for an attribute to resolve.
- Get the event key from Journey Settings, or `GET /interaction/v1/eventDefinitions`.

### Resolution order in a JB email activity

1. If the field name exists in the **entry data**, use that value.
2. If it's null in the entry source but exists in **Profile Attributes** for All Subscribers, use that.
3. Otherwise, **insert no value**.

---

## 6. What AMPscript can and cannot see in a journey

**Can:** journey entry-source attributes are a first-class AMPscript data source. `AttributeValue()` reads *"email subscriber profiles, data extension fields, journey entry source attributes, and MobilePush attributes."* So entry-source DE columns are addressable as `%%ColumnName%%`, `AttributeValue("ColumnName")`, or `[Column Name]`.

**Cannot — and this one catches people:**

**Date-based entry events pass no journey data at all.** *"This entry event type does not use Journey Data. This means that the data in the entry source Data Extension is not passed into the Journey."* Only `_subscriberkey` and Profile Attributes are available. Everything else needs `Lookup()`.

**Journey data is frozen at entry.** For anything that changed mid-journey — after an Update Contact activity, say — Salesforce's own guidance is to *"use the `%%=Lookup()=%%` function to personalize an email with data not found in journey data, or contact data that has changed since the journey started."*

**AMPscript does not evaluate `{{ }}` bindings.** The JB engine substitutes them before the email is built; AMPscript sees the resolved value or nothing. This follows from the architecture rather than an explicit doc statement, but it holds.

---

## 7. Data views

Queryable from **Automation Studio SQL only** — not from AMPscript. Stored in CST with no DST.

**Retention:** `_Bounce`, `_Click`, `_Complaint`, `_FTAF`, `_Open` = **6 months**. `_ReconcilableDispositionView` = 7 days.

**`_Subscribers`** — *"Only returns results at the Enterprise level, and not for child business units."*
`SubscriberID` · `SubscriberKey` (defaults to the email address) · `EmailAddress` · `Domain` · `Status` (active/held/unsubscribed/bounced) · `SubscriberType` · `BounceCount` · `DateJoined` · `DateUnsubscribed` · `DateUndeliverable`

**`_Sent`** — `AccountID` · `OYBAccountID` · `JobID` · `ListID` · `BatchID` · `SubscriberID` · `SubscriberKey` · `EventDate` · `Domain` · `TriggeredSendCustomerKey` · `TriggererSendDefinitionObjectID`

**`_Open`** — as `_Sent` plus `IsUnique`

**`_Click`** — as `_Open`, plus:

- `URL` varchar(900) — **"No AMPscript or variables are populated in this column"**
- `LinkContent` varchar(max) — **"AMPscript and variables are populated in this column"**
- `LinkName` varchar(1024)

That asymmetry matters for anyone reporting on AMPscript-built links: the resolved URL is in `LinkContent`, not `URL`.

**`_Job`** — `JobID` · `EmailID` · `AccountID` · `FromName` · `FromEmail` · `SchedTime` · `PickupTime` · `DeliveredTime` (**NULL for triggered sends**) · `IsMultipart` · `JobType` · `JobStatus` · `EmailName` · `EmailSubject` · `DynamicEmailSubject` · `TestEmailAddr` · `SendType` · `SalesForceTotalSubscriberCount` · `SalesForceErrorSubscriberCount` · and more.

---

## 8. Send logging

One send-log DE per account for email, created from the **SendLog** template with **Is Sendable unchecked**. *"Use send logging in Email Studio to obtain run-time information about email send attributes."*

**Content Builder test sends are NOT logged by default** — enabling that requires contacting your relationship manager.

Best practices from Salesforce: retention of **10 days**; **10 or fewer custom fields**; be aware *"the send log can contain duplicate records of a single message due to sending issues"*; dates are UTC-6; pause/republish/restart triggered sends and JB triggered sends for changes to take effect.

The SendLog template's exact column list isn't published — inspect it in the UI.

---

## 9. Contact Builder attribute groups

*"Attribute groups enable you to organize your data in Contact Builder. Each attribute group includes a data model consisting of data extensions linked to either the contact record or other data extensions."*

Attribute-group data is addressed by **fully qualified name in Journey Builder binding syntax** — `{{Contact.Attribute.SetName.FieldName}}`.

There is **no personalization string that reads an arbitrary attribute group inside an Email Studio send.** In practice that requires `Lookup()` against the underlying Data Extension, or the JB binding. Salesforce doesn't state this prohibition explicitly, but no mechanism is documented.

---

## Sources

Salesforce: [Personalization strings in Email Studio](https://help.salesforce.com/s/articleView?id=sf.mc_es_available_personalization_strings.htm&type=5) · [Journey and Contact Data](https://help.salesforce.com/s/articleView?id=mktg.mc_jb_journey_contact_data.htm&type=5) · [How data binding works](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/how-data-binding-works.html) · [Personalization in the Journey Builder email activity](https://help.salesforce.com/s/articleView?id=mktg.mc_jb_personalization_in_the_journey_builder_send_email_activity.htm&type=5) · [Data extension properties](https://help.salesforce.com/s/articleView?id=mktg.mc_es_de_properties.htm&type=5) · [Create a sendable data extension](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/creating_a_sendable_data_extension.html) · [Data views](https://help.salesforce.com/s/articleView?id=sf.mc_as_data_views.htm&type=5) · [Send logging](https://help.salesforce.com/s/articleView?id=mktg.mc_es_send_logging.htm&type=5) · [Attribute group creation](https://help.salesforce.com/s/articleView?id=mktg.mc_cab_create_attribute_group.htm&type=5) · plus [ampscript.guide](https://ampscript.guide/) for attribute-string detail.
