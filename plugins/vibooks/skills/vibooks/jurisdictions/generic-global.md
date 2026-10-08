# Generic Global Jurisdiction Profile

Profile id: `generic_global`

Status: `skill_guided`

Scope: conservative fallback bookkeeping when no stronger country or region
profile is documented yet or when the jurisdiction is still not clear enough
for local tax and filing defaults.

## Use This Profile When

- no documented country or region profile applies yet
- the country is still ambiguous
- the book needs normal bookkeeping setup now, but local filing rules are not
  yet clear

This profile is a safe fallback, not a claim that the book has no local rules.

## Current-Product Routing

1. create the company and book with the best-known country and operating
   currency
2. use the nearest official Vibooks industry preset when one clearly fits
3. keep tax setup conservative until real registration or filing obligations
   are known
4. build only the accounts and master data the source documents and business
   facts actually require

## Rules

- treat explicit book or company setup as authoritative when it already exists
- treat device country only as a bootstrap suggestion, never as legal proof
- keep `tax_mode` off until the real tax registration or statutory treatment is
  clear
- use neutral, role-based control-account names that fit the current shipped
  product
- use account numbering only when the existing book already uses numbering or
  the user clearly wants numbered accounts
- treat bank and card statements as evidence of observable account movement and
  reconciliation, not by themselves as proof of business purpose, accounting
  classification, recognition date, deductibility, or commodity-tax
  entitlement
- keep `payment_or_receipt_supported`, `business_nature_supported`,
  `recognition_date_supported`, and `tax_documentation_supported` as separate
  review conclusions; do not turn statement provenance into a blanket pass
- if the book uses item quantities, keep one base unit plus explicit
  conversions rather than mixing freehand unit assumptions into document lines
- when the country or region is not covered by a stronger documented profile,
  research the current official country rules before accepting statement-only
  evidence for a material conclusion, creating tax codes or tax control
  accounts, or presenting local-compliance guidance
- research sources in this order:
  1. government tax authority, law database, or regulator
  2. official accounting-standards body or professional-body guidance
  3. official documentation from mainstream bookkeeping software, used only for
     product-UX alignment rather than as legal authority
- if the official position or the relevant subnational rule is still unclear,
  stop and ask before configuring tax master data

## Stop And Ask When

- the book needs jurisdiction-specific filing, remittance, or return behavior
- a local commodity-tax regime, withholding regime, or payroll remittance
  regime matters
- statement-only or substitute evidence would affect a deduction, tax credit,
  commodity-tax claim, or other local-compliance conclusion
- the business has a local reporting basis that materially changes bookkeeping
  presentation or classification

When a stronger documented jurisdiction profile later becomes available, switch
to that profile rather than stretching `generic_global` to cover local rules it
does not own.
