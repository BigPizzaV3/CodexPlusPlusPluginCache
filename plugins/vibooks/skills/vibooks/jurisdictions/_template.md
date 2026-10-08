# Jurisdiction Profile Template

Use this template when adding a new country or region profile under
`skills/vibooks/`.

Keep the profile pragmatic, conservative, and tied to the current shipped
product. Do not imply first-class product support that does not yet exist.

## Contents

- Use this profile when
- Authority order
- Reporting-basis default
- Evidence sufficiency and statement rules
- Current-product routing
- Chart-of-accounts rules
- Tax control accounts and tax codes
- Account numbering guidance
- Units of measure
- Stop and ask when
- Do not do
- Future product mapping
- Reference points
- Authoring rules

```md
# <Country Or Region> Jurisdiction Profile

Profile id: `<profile_id>`

Status: `official` | `skill_guided` | `generic_only`

Scope: one short paragraph describing the business shape and any major limits.

## Use This Profile When

- ...

Do not choose this profile merely because ...

## Authority Order

Use these sources in order:

1. explicit Vibooks company or book setup already saved
2. real registrations, reporting obligations, and subnational footprint
3. source documents and business profile details
4. explicit user instruction
5. current device country only as a last-resort bootstrap suggestion

If the country is clear but the relevant subnational jurisdiction is still
unclear, stop and ask before creating tax master data.

## Reporting-Basis Default

Default to ...

Use ... only when ...

Rules:

- ...

## Evidence Sufficiency And Statement Rules

- define what bank and card statements can establish in this jurisdiction
- distinguish proof of payment or receipt from proof of business purpose,
  accounting classification, recognition date, and tax entitlement
- document any prescribed invoice, receipt, tax-document, or record fields
- state how missing receipts or substitute records must be handled
- distinguish cash-basis timing from accrual-basis recognition
- cite the current official tax authority, law, regulator, or standards source
- keep an item unresolved when the local rule or required evidence is unclear

## Current-Product Routing

On the current shipped product, ...

1. ...
2. ...
3. ...

Do not claim that Vibooks has ... unless the shipped product actually exposes
that support.

## Chart-Of-Accounts Rules

- ...

Common additions that may be appropriate when the business facts require them
include:

- ...

Do not create these just because they are common in the jurisdiction.

## Tax Control Accounts And Tax Codes

- ...

## Account Numbering Guidance

Account numbering is recommended, not mandatory.

- ...

Do not renumber an existing clean chart solely to fit a template.

## Units Of Measure

- ...

## Stop And Ask When

- ...

## Do Not Do

- ...

## Future Product Mapping

When Vibooks later ships first-class localization for this jurisdiction, keep
the same profile id and prefer the official product setup.

## Reference Points

- government tax authority or regulator:
  [...]
- accounting standards body or professional guidance:
  [...]
- mainstream SMB software alignment:
  [...]
```

## Authoring Rules

- bind the profile to company or book jurisdiction, not operator nationality
- keep country, reporting basis, tax registration, and industry as separate
  axes
- use official government or standards-body sources first
- use mainstream software docs only for UX alignment, not as legal authority
- keep statement provenance separate from evidence sufficiency and never treat
  proof of payment alone as blanket proof of the underlying business or tax
  treatment
- prefer role-based account semantics over cosmetic display-name purity
- stop and ask whenever subnational tax differences materially change the setup
