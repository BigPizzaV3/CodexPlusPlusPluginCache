# Japan SMB Jurisdiction Profile

Profile id: `jp_smb`

Status: `official`

Scope: ordinary Japanese company bookkeeping for small-business management
books and accountant review packages on the current Vibooks product. This
profile is not a tax-return filing workflow or tax advice substitute.

## Contents

- Use this profile when
- Authority order
- Reporting-basis default
- Current-product routing
- Chart-of-accounts rules
- Tax control accounts and tax codes
- Evidence and review rules
- Account numbering guidance
- Stop and ask when
- Do not do
- Future product mapping
- Reference points

## Use This Profile When

- the book or company `country` is Japan
- the source documents, tax registration, or user instructions clearly show the
  business keeps its books under Japanese company bookkeeping rules
- the business is an ordinary small company rather than a listed issuer,
  financial institution, nonprofit with specialized reporting, or other
  regulated reporting entity

Do not choose this profile merely because the operator is Japanese or because a
customer or vendor is located in Japan.

## Authority Order

Use these sources in order:

1. explicit Vibooks book or company setup already saved
2. real Japanese registrations, consumption-tax status, and accountant
   instructions
3. source documents and business profile details
4. explicit user instruction
5. current device country only as a last-resort bootstrap suggestion

If Japan is clear but the consumption-tax registration status or invoice
evidence treatment is unclear, keep the book conservative and mark the item for
accountant review before creating or applying tax master data.

## Reporting-Basis Default

For ordinary small-company management books on the current shipped product,
default to accrual double-entry bookkeeping.

Rules:

- keep the true operating currency, usually `JPY`
- keep accountant-facing exports separate from the operator's desktop UI
  language
- when the accountant wants Japanese workpapers, set the book's
  `report_export_language` to `ja`; do not rely on the operator's UI language
  to change export labels
- do not infer tax filing elections from country alone
- stop and ask when the accountant requires a special tax basis, industry
  treatment, or reporting framework beyond ordinary small-company books

## Current-Product Routing

On the current shipped product, use the official jurisdiction-profile path for
Japan first, then keep remaining chart and workflow choices conservative.

1. create the company with `country = JP`; when known, save the true prefecture
   and `commodity_tax_registration_status`
2. set or confirm `jurisdiction_profile_id = jp_smb`
3. set the operating currency, usually `JPY`
4. set `report_export_language = ja` when the accountant-facing package should
   be Japanese; otherwise keep the language explicitly requested by the
   accountant or operator
5. apply the nearest official Vibooks industry preset when one matches the
   business
6. run the jurisdiction-profile apply flow only when the operator wants Japan
   defaults applied
7. configure consumption-tax codes only when the business is registered or the
   accountant explicitly wants tax-coded bookkeeping

Current official product path:

- set the fields at book creation when they are already known
- otherwise call `post-v1-books-book-id-jurisdiction-profile-apply`

Do not claim that Vibooks files Japanese corporation tax or consumption tax
returns unless a shipped product release actually exposes that filing workflow.

## Chart-Of-Accounts Rules

- start from the official Vibooks generic or industry preset, then add Japan-
  specific balances only where the business facts require them
- preserve one real account per real bank account, card, loan, tax balance,
  and clearing balance
- keep consumption-tax payable and recoverable balances separate when the book
  is tax-coded
- prefer current shipped-product-compatible control-account roles over cosmetic
  local labels

Common Japan additions that may be appropriate when the business facts require
them include:

- consumption-tax payable and recoverable balances
- a temporary consumption-tax suspense account for unclear source evidence
- officer loan balances
- industry-specific deposits, advances, gift-card liabilities, or deferred
  revenue

Do not create these just because they are common in Japan. Create them only
when the real book needs them.

## Tax Control Accounts And Tax Codes

Current shipped-product-compatible default roles:

- payable control account:
  - name: `Consumption Tax Payable`
  - `report_category`: `tax_payable`
- recoverable control account:
  - name: `Consumption Tax Recoverable`
  - `report_category`: `tax_receivable`

Current product behavior for explicit `jp_smb` opt-in:

- `post-v1-books` can save `country`, `region`, `jurisdiction_profile_id`, and
  `commodity_tax_registration_status`, but it does not itself create tax
  defaults
- tax-control-account and tax-code creation happens only when the operator
  explicitly runs `post-v1-books-book-id-jurisdiction-profile-apply`
- if the business is not registered, Vibooks skips consumption-tax master-data
  creation

Default tax-code set for registered books:

- `JCT10`: Japan consumption tax 10%, sales and purchase
- `JCT8`: Japan reduced consumption tax 8%, sales and purchase
- `JCTEXPORT`: export sale zero-rated, sales only
- `JCTEXEMPT`: exempt or non-taxable classification
- `JCTOOS`: out-of-scope classification

Tax-code rules:

- do not create rounding-variant tax codes to absorb one-yen differences
- for registered JPY books, set the book policy to
  `tax_rounding_scope: invoice_rate`; use `tax_rounding_mode: floor` unless
  the accountant or source-document policy requires `half_up` or `ceiling`
- preserve source invoice tax with `tax_amount_override` and a clear reason;
  use `statutory_invoice_rounding` when the source tax is preserved because a
  Japanese qualified invoice rounds once per invoice and tax rate
- for non-qualified invoices or partial input-tax credit, keep the statutory tax
  code and use `tax_claimable_ratio` on the document line instead of cloning
  tax-code master data
- when qualified invoice status, taxable category, or input-tax credit
  treatment is unclear, mark the item for accountant review

## Evidence And Review Rules

Japan source-document review should capture or flag:

- issuer name and qualified invoice registration number when relevant
- transaction date
- recipient name when required by the source-document type
- per-rate taxable total and tax amount
- whether evidence is qualified, simplified, non-qualified, missing, or unclear
- electronic or paper preservation status

Current product support:

- document lines accept an extensible `evidence` object for qualified-invoice
  status, issuer registration number, recipient, transaction date,
  `tax_rate_breakdown`, preservation status, review status, and review flags
- registered Japan purchase lines with tax codes generate `needs_review`
  evidence flags instead of silently guessing when qualified-invoice status,
  per-rate totals, or preservation status is missing
- `get-v1-books-book-id-tax-summary` includes source-document
  `invoice_rate_groups` for per-invoice/per-rate consumption-tax review
- `get-v1-books-book-id-accountant-handoff` returns financial statements,
  trial balance, general ledger, journal entries, A/R and A/P aging and open
  items, bank reconciliation summary, tax summary, evidence exception report,
  attachment manifest, and Japan accountant-facing labels for tax accountant
  review
- `post-api-admin-export-accountant-package` writes the same handoff as a
  styled Excel workbook, or as a zip package containing the full workbook, each
  selected report as an independent XLSX workbook, the JSON workpaper payload,
  and manifest with report filenames that include company, book, date range,
  and report language
- omit `sections` for the default full report pack; pass `sections` only when
  the tax accountant asks for selected workpapers, so the workbook tabs,
  independent report files, and JSON payload include only those reports
- leave `basis` unset for the normal accrual-basis package; pass `basis = cash`
  or `basis = tax` only when the tax accountant explicitly requests that basis
  for the Profit and Loss and Balance Sheet sections
- in the desktop app, use `Reports > Accountant Package` and select `Full
  fiscal year` for year-end tax-accountant delivery unless the tax accountant
  asks for an interim or custom review period, then leave all workpapers
  selected or clear reports the tax accountant did not request

Use these fields instead of burying qualified-invoice facts in free-form notes
when posting or reviewing Japan source documents.

## Account Numbering Guidance

Account numbering is recommended, not mandatory.

Use stable small-business ranges if the book wants numbered accounts, but do
not renumber an existing clean chart solely to match a template.

- `1000-1999`: assets
- `2000-2999`: liabilities
- `3000-3999`: equity
- `4000-4999`: revenue
- `5000-5999`: cost of sales or direct costs
- `6000-7999`: operating expenses
- `8000-8999`: other income and other expense

## Stop And Ask When

- consumption-tax registration status is unknown but tax-coded posting is
  requested
- qualified invoice registration or preservation evidence is missing
- an input-tax credit ratio is unclear
- simplified taxation, special small-business measures, import, reverse charge,
  cross-border service, payroll, or fixed-asset tax treatment is needed
- the book needs listed-company, regulated-industry, nonprofit, or other
  specialized reporting

## Do Not Do

- do not choose this profile from operator nationality alone
- do not imply that Vibooks files Japanese tax returns
- do not create consumption-tax codes for an unregistered book unless the user
  or accountant explicitly requests tax-coded management bookkeeping
- do not clone tax codes for supplier-specific input-tax credit percentages
- do not silently guess qualified invoice status
- do not mix jurisdiction rules into industry preset ids

## Future Product Mapping

When Vibooks later ships deeper first-class Japan localization, keep the same
profile id and prefer the official product setup. The skill should then switch
from manual guidance to:

1. choosing the official `jp_smb` setup
2. reusing the product's official Japanese chart, tax, evidence, and export
   defaults
3. keeping this document as a safety and interpretation layer, not as the
   primary creator of Japan master data

## Reference Points

- National Tax Agency consumption-tax overview:
  <https://www.nta.go.jp/english/taxes/consumption_tax/01.htm>
- National Tax Agency qualified invoice system:
  <https://www.nta.go.jp/english/taxes/consumption_tax/invoice.htm>
- National Tax Agency electronic books and electronic transaction preservation:
  <https://www.nta.go.jp/law/joho-zeikaishaku/sonota/jirei/tokusetsu/index.htm>
- Japan Peppol Authority and JP PINT:
  <https://www.digital.go.jp/en/policies/electronic_invoice>
