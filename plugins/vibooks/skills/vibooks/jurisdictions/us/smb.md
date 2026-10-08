# United States SMB Jurisdiction Profile

Profile id: `us_smb`

Status: `skill_guided`

Scope: ordinary United States small-business bookkeeping on the current shipped
Vibooks product, with conservative treatment of state and local tax variation.
This profile is not a full 50-state filing handbook.

## Contents

- Use this profile when
- Authority order
- Reporting-basis default
- Evidence sufficiency and statement rules
- Current-product routing
- Chart-of-accounts rules
- Tax control accounts and tax codes
- Accountant handoff package
- Account numbering guidance
- Units of measure
- Stop and ask when
- Do not do
- Future product mapping
- Reference points

## Use This Profile When

- the book or company country is the United States
- the business facts clearly show US bookkeeping context
- the business is an ordinary small business rather than a nonprofit, public
  company, broker-dealer, insurer, or other specialized reporting entity

Do not choose this profile merely because the operator is American.

## Authority Order

Use these sources in order:

1. explicit Vibooks company or book setup already saved
2. real state registrations, payroll registrations, nexus footprint, and filing
   obligations
3. source documents and business profile details
4. explicit user instruction
5. current device country only as a last-resort bootstrap suggestion

If the business is in the United States but the relevant state or local tax
jurisdiction is still unclear, stop and ask before creating sales-tax master
data.

## Reporting-Basis Default

For ordinary small-business management books on the current shipped product,
Vibooks normally starts from `accrual` unless the user clearly wants
cash-basis bookkeeping.

Treat that as a Vibooks operating default for management books, not as a claim
that every US authoritative reporting or tax basis requires accrual.

Use `cash` only when one of these is clearly true:

- the user explicitly wants cash-basis books
- the book is being kept primarily for a cash-basis tax workflow
- the business is simple enough that cash-basis books are the intended operating
  method

Rules:

- in the United States, GAAP is an accrual-based financial-reporting framework,
  but private companies are not automatically required to use GAAP
- for federal tax, the IRS allows cash, accrual, or hybrid methods as long as
  the method clearly reflects income and is used consistently
- when a lender, investor, owner, contract, tax preparer, regulator, or chosen
  reporting framework clearly requires a specific basis, follow that explicit
  requirement instead of treating the Vibooks default as authoritative
- when inventory or merchandise is an income-producing factor, treat inventory
  accounting as a higher-risk area and stop to confirm the intended method if
  the workflow is not obvious

## Evidence Sufficiency And Statement Rules

For ordinary United States small-business books, treat a legible financial
account statement as supporting evidence of payment only when it contains the
payment-method-specific facts required by current IRS guidance. Do not treat
proof that money moved as sufficient by itself to establish a deductible
business expense or the full accounting treatment.

Rules:

- retain the available sales slips, paid bills, invoices, receipts, deposit
  slips, cancelled checks, account statements, credit-card slips, contracts, or
  other contemporaneous records that support the book and tax-return entries
- for a check, require the statement to show the check number, amount, payee,
  and date the financial institution posted the check amount
- for an electronic funds transfer, require the amount transferred, payee, and
  date the financial institution posted the transfer
- for a credit-card payment, require the amount charged, payee, and transaction
  date; preserve a separately shown posting date for matching and reconciliation
- use those method-specific statement facts to support the payment conclusion;
  separately require evidence that the cost was incurred and had the stated
  business purpose before passing `business_nature_supported`
- do not mark a deduction or tax conclusion supported merely because a
  statement shows the amount, payee, and date; IRS guidance explicitly treats
  proof of payment alone as insufficient to establish entitlement to a
  deduction
- bank-originated fees or interest and clearly evidenced transfers between the
  book's own accounts may rely primarily on statement evidence when the full
  accounting treatment is apparent and no other applicable rule requires more
- for cash-basis books, statement evidence may support when an amount was paid
  or received; for accrual-basis books, use the underlying invoice, supply,
  service, delivery, or obligation evidence for recognition and cutoff
- federal income-tax recordkeeping does not resolve state or local sales-tax,
  use-tax, or regulated-industry evidence requirements; research the applicable
  authority when those rules affect the conclusion

If the statement supports payment but the business purpose, recognition date,
or applicable tax documentation remains unclear, keep the affected check
`warning`, `fail`, `needs_user`, or `unknown` rather than passing the item.

## Current-Product Routing

On the current shipped product, the United States is not yet a first-class
official jurisdiction preset. Use this routing:

1. create the company and book with `country = US`
2. set the true operating currency, usually `USD`
3. choose the nearest official Vibooks industry preset when one clearly fits
4. review the chart of accounts and add only the real federal, state, local,
   payroll, and industry balances the book actually needs
5. configure sales-tax master data only after the real state or local
   registration footprint is known

Do not claim that Vibooks has a built-in all-states US tax engine unless the
shipped product actually exposes one.

## Chart-Of-Accounts Rules

- record the true company or book country as the United States
- set the real operating currency instead of assuming one from operator
  location
- start from the official Vibooks generic or industry preset, then add
  US-specific balances only where the business facts require them
- preserve one real account per real bank account, credit card, loan, payroll
  clearing balance, and tax-agency liability
- keep payroll liabilities, sales-tax liabilities, and income-tax liabilities
  separate; do not net them together into one generic tax bucket
- do not infer payroll, withholding, or 1099 handling from country alone

Common additions that may be appropriate when the business facts require them
include:

- state or local sales-tax payable balances
- payroll tax and withholding liabilities
- merchant clearing balances
- owner contribution, draw, or distribution balances

Do not create these just because they are common in US books. Create them only
when the real book needs them.

## Tax Control Accounts And Tax Codes

For ordinary US small-business books, treat general retail sales tax as a
state-and-local tax problem, not as one national federal sales-tax regime.

Current shipped-product-compatible default role for ordinary sales-tax
collection:

- payable control account:
  - name: `Sales Tax Payable`
  - `report_category`: `tax_payable`

Ordinary US sales-tax codes should usually be `sales` direction codes, not
`both`, because general retail sales tax is normally collected from customers
for remittance to a state or local agency rather than operated as a VAT-style
recoverable input tax.

Rules:

- create sales-tax master data only for real state or local agencies the
  business is registered with or clearly must collect for
- do not create one national catch-all US sales-tax code
- do not create purchase-side receivable tax balances unless the real legal
  treatment is a refundable or otherwise recoverable tax balance
- when the business pays sales tax on purchases in ordinary nonrecoverable
  situations, treat it as part of the cost or expense flow rather than forcing
  a fake recoverable sales-tax asset
- keep federal employment taxes, federal income taxes, and state sales taxes in
  separate account roles
- do not invent state or local sales-tax setup without the actual nexus,
  registration, and filing context

If the business has marketplace facilitator, exemption certificate, resale,
manufacturer exemption, or multi-state nexus complexity, stop and ask before
creating the tax model.

## Accountant Handoff Package

For United States books, the accountant handoff is a bookkeeping workpaper
package, not a federal, state, payroll, sales-tax, or information-return filing
output.

Use `get-v1-books-book-id-accountant-handoff` for the review date range to
prepare the accountant-facing financial statements, trial balance, general
ledger, journal entries, A/R and A/P aging and open items, bank reconciliation
summary, tax category summary, deduction-support review, attachment manifest,
and US jurisdiction notes.

Use `post-api-admin-export-accountant-package` when the accountant needs files:

- `format = xlsx` creates the styled Excel workbook intended for accountant
  review
- `format = zip` includes the full Excel workbook, each selected report as an
  independent XLSX workbook, the JSON workpaper payload, and package manifest
  with report filenames that include company, book, date range, and report
  language
- omit `sections` for the default full report pack; pass `sections` only when
  the accountant asks for selected workpapers, so the workbook tabs,
  independent report files, and JSON payload include only those reports
- leave `basis` unset for the normal accrual-basis package; pass `basis = cash`
  or `basis = tax` only when the accountant explicitly requests that basis for
  the Profit and Loss and Balance Sheet sections
- in the desktop app, use `Reports > Accountant Package`; choose `Full fiscal
  year` for year-end handoff or `Fiscal year to date` for interim review, then
  leave all workpapers selected or clear reports the accountant did not request

Do not claim that the package files income tax, payroll tax, sales tax, 1099, or
other US returns.

## Account Numbering Guidance

Account numbering is recommended, not mandatory.

If the book wants numbered accounts, a practical US default aligned with common
QuickBooks guidance is:

- `10000-19999`: assets
- `20000-29999`: liabilities
- `30000-39999`: equity
- `40000-49999`: income or revenue
- `50000-59999`: cost of goods sold or direct costs
- `60000-69999`: operating expenses or overhead
- `70000-79999`: other income
- `80000-89999`: other expenses

Do not renumber an existing clean chart solely to fit a template.

## Units Of Measure

US books may need US customary and SI units to coexist in practice. If the
book uses item quantities or inventory-style units:

- keep one base unit plus any related purchase, sales, or shipping units
- record the true unit used by the source documents and operations
- define explicit conversions instead of freehand mental conversion
- do not assume that every US business uses customary-only units
- do not rename an existing base unit into a different physical unit once
  transactions rely on it; create a new unit set instead

## Stop And Ask When

- state sales-tax setup is needed but the state or locality is unclear
- payroll withholding or employer tax setup is needed
- the book needs nonprofit, public-company, regulated-industry, or other
  specialized reporting treatment
- the business needs a documented US-specific reporting or filing treatment
  that Vibooks has not yet published

## Do Not Do

- do not choose this profile from operator nationality alone
- do not design the book around one imaginary federal sales-tax agency
- do not create one national catch-all sales-tax code for every US sale
- do not force purchase-side sales tax into a fake receivable balance when it
  is actually part of cost or expense
- do not mix payroll liabilities and sales-tax liabilities into one tax account
- do not imply that current shipped Vibooks automatically handles state nexus,
  marketplace facilitator rules, or all-state filing automation unless the
  product actually exposes that first-class workflow

## Future Product Mapping

When Vibooks later documents or ships first-class US localization, keep the
same profile id and prefer the official product setup. The skill should then
switch from manual guidance to:

1. choosing the official `us_smb` or equivalent product-native setup
2. reusing the product's official US chart and tax defaults
3. keeping this document as a safety and interpretation layer, not as the
   primary creator of US master data

## Reference Points

- IRS accounting-method and inventory rules:
  [Publication 538](https://www.irs.gov/publications/p538)
- IRS starting-a-business and recordkeeping guidance:
  [Publication 583](https://www.irs.gov/publications/p583)
  and
  [IRS recordkeeping](https://www.irs.gov/businesses/small-businesses-self-employed/recordkeeping)
- IRS federal business-tax categories:
  [IRS business taxes](https://www.irs.gov/businesses/business-taxes?Tag=tips)
  and
  [IRS filing and paying business taxes](https://www.irs.gov/businesses/small-businesses-self-employed/filing-and-paying-your-business-taxes)
- official state and local tax routing:
  [USAGov state taxes](https://www.usa.gov/state-taxes)
- US small-business accounting-method and GAAP overview:
  [SBA manage your finances](https://www.sba.gov/business-guide/manage-your-business/manage-your-finances)
- measurement-law basis and customary/SI coexistence:
  [NIST approximate conversions](https://www.nist.gov/pml/owm/approximate-conversions-us-customary-measures-metric)
- mainstream SMB software alignment:
  [QuickBooks automated sales tax](https://quickbooks.intuit.com/learn-support/en-us/help-article/sales-taxes/set-use-automated-sales-tax-quickbooks-online/L4Lx8eL7V_US_en_US)
  and
  [QuickBooks account numbers](https://quickbooks.intuit.com/learn-support/en-us/help-article/chart-accounts/use-account-numbers-chart-accounts/L7lRLN0Do_US_en_US)
