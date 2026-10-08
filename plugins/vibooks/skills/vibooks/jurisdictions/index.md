# Jurisdiction Profiles

## Contents

- Purpose
- Support statuses
- Selection order
- Interaction with industry presets
- Current profiles

## Purpose

Use a jurisdiction profile to choose country or region bookkeeping defaults
without hardcoding those defaults into the core workflow.

A jurisdiction profile is not the same thing as an industry preset.

- jurisdiction profile: reporting-basis defaults, statutory tax posture,
  evidence-sufficiency rules, chart-of-accounts guidance, control-account
  roles, numbering guidance, and unit-of-measure guidance tied to a country or
  region
- industry preset: workflow-specific account additions, dimensions, report
  views, and operating defaults tied to a business shape such as e-commerce,
  restaurant, or lodging

One book may need both:

- one jurisdiction profile
- one official industry preset when the business shape is clear

## Support Statuses

Treat every documented profile as one of these support states:

- `official`: Vibooks exposes first-class jurisdiction resources, setup, or
  defaults for that profile. Use the official product support first and treat
  the profile doc as interpretation and safety guidance.
- `skill_guided`: the current shipped product does not yet expose a full
  first-class jurisdiction package. Use the official generic or industry
  product workflows, then apply this profile's rules when creating or reviewing
  accounts, tax codes, and settings.
- `generic_only`: no jurisdiction-specific profile is documented yet. Use the
  generic Vibooks workflow, keep tax handling conservative, and do not imply
  local filing support that Vibooks does not actually provide.

## Selection Order

Choose the jurisdiction profile in this order:

1. the existing book or company `country`, tax registration, and other explicit
   authoritative setup already stored in Vibooks
2. the source documents or business profile when they clearly establish the
   legal or tax jurisdiction
3. the user's explicit instruction
4. only when none of the above is clear, use the current device country as a
   suggestion for bootstrap defaults

Rules:

- treat jurisdiction as a property of the company or book, not of the human
  operator's nationality
- do not infer a tax registration merely from country alone
- if country is clear but province, territory, or state detail is required for
  tax setup and is still unknown, stop and ask before creating jurisdiction-
  specific tax codes
- if the business is not yet tax-registered, bootstrap the book conservatively
  and keep tax-coded bookkeeping off until registration or filing requirements
  are clear
- when the book's country or region is outside a documented profile, or when
  the current profile does not clearly cover a material evidence, tax,
  reporting, or measurement question, research the current official country
  rules before creating tax codes, tax control accounts, accepting
  statement-only support, or claiming local-compliance support
- research sources in this order:
  1. government tax authority, law database, or regulator
  2. official accounting-standards body or professional-body guidance
  3. official documentation from mainstream bookkeeping software, used only for
     product-UX alignment rather than as legal authority
- if the result is still unclear, or if subnational rules such as state,
  province, territory, or local taxes materially affect the treatment, stop
  and ask before posting or configuring tax master data

## Interaction With Industry Presets

Use this order when the current shipped product has a jurisdiction layer but
does not yet ship a full country-specific localization package for the target
country or region:

1. create the company and book with the true country and functional currency
2. inspect discovery and official product resources first
3. set or confirm the jurisdiction profile through the official product path
   only when the operator explicitly wants to opt in to those defaults, such
   as `post-v1-books-book-id-jurisdiction-profile-apply`
4. choose the nearest official Vibooks industry preset when one clearly fits
5. apply the jurisdiction profile's evidence, chart, tax, naming, numbering,
   and measurement guidance
6. reuse existing accounts and tax codes when they already match the profile;
   do not create near-duplicate objects

Do not collapse jurisdiction and industry into one combined pseudo-preset such
as `ca_restaurant_summary`. Keep them as separate layers.

## Current Profiles

- `generic_global`
  - status: `skill_guided`
  - use when no stronger country or region profile is documented or when the
    jurisdiction remains unclear
  - keep setup conservative, avoid unsupported local filing claims, and use the
    core workflow docs as the main authority
  - reference:
    [generic-global.md](generic-global.md)
- `ca_smb`
  - status: `skill_guided`
  - use for ordinary Canadian small-business and private-enterprise books
  - reference:
    [ca/smb.md](ca/smb.md)
- `us_smb`
  - status: `skill_guided`
  - use for ordinary United States small-business books, with explicit state
    and local tax stop conditions
  - reference:
    [us/smb.md](us/smb.md)
- `jp_smb`
  - status: `official`
  - use for ordinary Japanese small-company books, with explicit consumption-
    tax, qualified-invoice evidence, and accountant-review stop conditions
  - reference:
    [jp/smb.md](jp/smb.md)

When a future shipped product release adds first-class jurisdiction support,
keep the same profile id and switch the status to `official` instead of
inventing a second naming scheme.

When adding a new profile, follow the standard authoring shape in:

- [_template.md](_template.md)
