# Independent Evidence Review

## Contents

- Purpose and boundary
- Complete-review rule
- Accounting-standard boundary
- Isolation rules
- Inputs
- Statement-evidence boundary
- Prohibited reuse
- Allowed tools
- Extraction independence
- Review workflow
- Review scopes
- Professional criteria
- Check matrix
- Output contract
- Auto-fix boundary
- Completion standard

## Purpose And Boundary

Use independent evidence review when the user asks an agent to check
AI-assisted Vibooks bookkeeping, posted transactions, draft work, or a period
close against original source evidence.

Vibooks remains the system of record. The review agent is a quality-control
workflow, not a substitute for owner or accountant judgment. By default it
produces an exception report and recommended fixes only; it does not mutate the
ledger.

Do not present independent evidence review as an audit, assurance engagement,
tax filing opinion, or blanket GAAP, IFRS, ASPE, or local-standards
certification. It is a bookkeeping quality-control review against the book's
configured policies, source evidence, and professional bookkeeping criteria.

## Complete-Review Rule

Default to complete review for the requested scope. Complete review means every
object in scope is enumerated, assigned a review status, and included in the
coverage totals. Do not silently narrow a broad request into sampling.

Before reviewing, state the review type:

- `complete_review`: every object in the declared scope will be checked
- `initial_risk_scan`: aggregate checks plus limited inspection; not a full
  review
- `sample_review`: user explicitly requested a sample; not a full review

Use `complete_review` unless the user explicitly asks for an initial scan or
sample. If time, access, evidence volume, missing files, or tool limits prevent
complete review, stop and say the review is blocked or ask to narrow the scope.
Do not replace complete review with sampling by judgment.

Sampling rules:

- use sampling only when the user explicitly asks for it
- label the result as `initial_risk_scan` or `sample_review`
- include the sample size, denominator, selection criteria, and excluded
  population
- do not say the book, month, supplier, account, or transaction population has
  been reviewed
- do not use sampled source documents to support a full-scope conclusion

For any complete review, build a scope register before conclusions:

- evidence or attachment objects in scope
- source documents with direct attachments
- records supported only by statement lines or derived workflows
- bank, debit-card, and credit-card statement lines in scope
- draft and posted Vibooks records in scope
- correction, application, reversal, opening-balance, and generated entries
  that need traceability rather than direct receipt matching

The final report must reconcile the denominator to reviewed statuses. If the
scope contains 146 evidence or ledger objects, the report must account for all
146, not only the subset with inspected PDFs.

## Accounting-Standard Boundary

Evaluate every record against the book's actual setup and professional
bookkeeping practice:

- accounting basis and book policy, such as cash, accrual, tax, or
  accountant-approved adjustments
- jurisdiction profile, statutory tax codes, tax rounding policy, claimability,
  and filing-period assumptions available in Vibooks
- chart of accounts, account roles, statement-account kind, subledger controls,
  and period controls
- first-class Vibooks workflows for invoices, bills, receipts, payments,
  expenses, refunds, transfers, settlements, reconciliations, and corrections
- source evidence, owner explanations, accountant notes, and prior confirmed
  patterns

When a treatment depends on professional judgment outside the available
evidence, mark it `needs_user` or `unknown`. Do not invent a policy, tax
treatment, contact, account, cutoff date, or standards conclusion.

## Isolation Rules

Start each review as a new run:

1. create a fresh working directory outside any prior bookkeeping-agent
   workspace
2. build a review input bundle from original evidence and a read-only Vibooks
   ledger snapshot or API reads
3. write all review outputs into the new review directory
4. keep the ledger read-only unless the user explicitly approves a correction
   workflow

At the start of the review, state the isolation boundary:

```text
Review isolation statement:
- Working directory: <fresh-review-directory>
- Evidence source: original documents only
- Bookkeeping artifacts used: none
- Ledger access: read-only
- Ledger mutation allowed: no
```

## Inputs

Use these as primary or comparison inputs:

- original receipts, supplier invoices, customer invoices, statements,
  contracts, processor reports, payout reports, and payment confirmations
- original bank, debit-card, and credit-card statement files or statement-line
  evidence
- Vibooks posted or draft results read through official API or CLI surfaces
- Vibooks chart of accounts, tax codes, jurisdiction profile, contacts,
  items, and reconciliation status
- prior confirmed contact aliases or supplier patterns only as supporting
  evidence

Treat Vibooks bookkeeping results as the object under review. Do not treat
them as source evidence.

## Statement-Evidence Boundary

Bank, debit-card, and credit-card statements are external evidence of the
observable account movement they report. Subject to authenticity and
readability, they can support the statement account, amount, displayed payee or
memo, the per-line transaction and posting dates actually shown, and the
account balance used for reconciliation. Keep transaction date, posting date,
and statement period-end as separate source facts when the statement provides
them.

Statement evidence does not, by itself, establish:

- what goods or services were supplied or why the activity was business-related
- the complete legal identity or role of the underlying counterparty
- whether the activity is revenue, expense, asset, liability, loan, transfer,
  owner activity, refund, prepayment, or another accounting treatment
- the recognition or cutoff date when the book uses accrual accounting
- deductibility, commodity-tax entitlement, tax rate, tax amount, or the
  statutory documentary information required by the jurisdiction

For transaction-like records, evaluate these evidence conclusions separately:

- `payment_or_receipt_supported`: payment or receipt, amount, and applicable
  date are supported under the payment method and jurisdiction profile; do not
  pass this conclusion merely because account movement is visible
- `business_nature_supported`: the underlying business purpose and accounting
  treatment are supported
- `recognition_date_supported`: the date used under the book's accounting basis
  is supported
- `tax_documentation_supported`: the evidence meets the applicable
  jurisdiction's documentary requirements for the claimed tax treatment

`statement_supported` is a provenance label, not an item-level sufficiency or
pass status. Do not mark an item `pass` merely because a statement proves that
money moved. A bank-originated item such as an account fee or interest, or a
clearly evidenced transfer between the book's own accounts, may rely primarily
on statement evidence when that evidence establishes the full treatment and
the jurisdiction profile does not require something more.

For matching and reconciliation, Vibooks stores one per-line `statement_date`.
When the source shows both transaction and posting dates, use the financial
institution's posting or clearing date as `statement_date` and retain the
transaction date in the original statement plus the line `reference` or `note`.
If the source provides only one per-line date, record that date and identify its
type as known or unknown; never silently relabel it. This storage choice does
not decide the bookkeeping recognition date.

For cash-basis books, select the payment or receipt date under the book policy,
payment method, and jurisdiction rules. That may be a retained transaction date
rather than Vibooks' matching-oriented `statement_date`. The statement
period-end or closing date is not the line's payment or receipt date and must
not be used merely because the line appears on that statement. For
accrual-basis books, do not substitute the settlement, transaction, or posting
date for the invoice, supply, service, delivery, or other recognition date.

An owner or accountant explanation may support bookkeeping classification or
resolve why another document is unavailable. It does not replace an invoice,
receipt, prescribed tax document, or other source record when the jurisdiction
requires one. Mark the affected evidence conclusion `warning`, `fail`,
`needs_user`, or `unknown` as appropriate, and do not claim a deduction or
commodity-tax entitlement that the available evidence cannot support.

Use the book's jurisdiction profile to decide documentary sufficiency. When a
material local evidence rule is not documented, research the current official
tax authority, law, or standards guidance before concluding. Until the rule is
confirmed, use `needs_user` or `unknown` rather than presenting the item as
locally compliant.

## Prohibited Reuse

Do not use local tools or artifacts that may repeat the bookkeeping agent's
mistake path:

- receipt parsers, statement parsers, importers, auto-categorizers, or vendor
  normalization scripts used for posting
- OCR caches, extraction JSON, classification JSON, importer staging files, or
  intermediate objects created by the bookkeeping run
- bookkeeping-agent chain-of-thought, explanations, confidence scores, or
  inferred tax/contact classifications
- prior exception reports as proof for the current document

If a value must be checked from a source document, re-read the original source
document visually or from the source statement evidence in the review run.

## Allowed Tools

Use tools that preserve review independence:

- PDF rendering, image viewing, cropping, rotation, and zooming used only to
  inspect original evidence
- deterministic arithmetic for totals, tax splits, rates, date comparisons,
  and documented rounding tolerances
- official Vibooks API or CLI reads for the ledger state being reviewed
- official Vibooks reports, tax summaries, reconciliation summaries, and
  accountant handoff workpapers as comparison surfaces

Rendering a PDF to an image is allowed. Business extraction from an existing
local parser or cache is not allowed.

Do not invent materiality thresholds. Use materiality only when it is explicitly
defined by the user, accountant, book policy, or jurisdiction workflow. Without
that documented threshold, treat non-rounding differences as `warning`, `fail`,
`needs_user`, or `unknown` according to the check result. Never waive statutory
tax, source total, bank or card reconciliation amount, duplicate-posting risk,
or closed-period impact as immaterial unless the user or accountant explicitly
directs that treatment.

## Extraction Independence

New review scripts may assist the review, but they do not become source
evidence.

Allowed script-assisted tasks:

- render PDFs or images
- crop, rotate, enhance, or split pages for visual inspection
- calculate totals, tax rates, date ranges, and coverage totals
- generate scope registers, check matrices, and report skeletons from
  independently reviewed facts

Script-extracted receipt, invoice, or statement fields are candidate values
only. For material fields such as date, counterparty, subtotal, tax,
adjustments, total, payment account, and document number, confirm the value
visually against the original evidence or mark the check `unknown` or
`needs_user`. Do not pass a record only because a new script's OCR or parser
output matches Vibooks.

Record field provenance whenever source facts support a conclusion, whether the
source was inspected visually or with script assistance. In particular, record
`statement_supported` whenever original statement facts support a conclusion;
do not make this provenance conditional on OCR or parser use.

- `visual_confirmed`: value was visually confirmed from original evidence
- `script_candidate_only`: value came from script output and was not confirmed
- `ledger_only`: value exists only in Vibooks and lacks source confirmation
- `statement_supported`: an observable account-movement value is supported by
  original statement evidence; this is provenance, not a sufficiency or pass
  conclusion
- `owner_or_accountant_explained`: value is supported by documented
  explanation rather than a source document

## Review Workflow

1. define the scope: one transaction, one supplier or customer, one account,
   one month, or one book close
2. declare `complete_review`, `initial_risk_scan`, or `sample_review`; default
   to `complete_review`
3. enumerate the full scope register and denominator before making conclusions
4. create the fresh review workspace and isolation statement
5. gather original evidence and read-only Vibooks state
6. independently extract evidence facts from every applicable source document
   in scope
7. compare source facts to Vibooks records and reports
8. complete the required check matrix for each scoped object
9. classify each scoped object as `pass`, `warning`, `fail`, `needs_user`, or
   `unknown`
10. produce structured exceptions with evidence, severity, recommended fix, and
   auto-fix safety
11. write a human-readable review report in the user's language with
   item-by-item results, then include JSON artifacts only as machine-readable
   support
12. stop before mutating Vibooks unless the user authorizes a specific official
   correction workflow

Read-only Vibooks `verify`, reconciliation summaries, task lists, tax summaries,
attachment coverage, and period reports are useful aggregate checks. They do
not substitute for item-by-item evidence review when the requested scope is a
complete review.

## Review Scopes

### Single Transaction

Check whether one draft or posted record can be trusted:

- source total, subtotal, tax, tips, shipping, discounts, adjustments, and
  document date
- bank or card statement amount, date, payee, memo, and statement account
- supplier, customer, employee, owner, lender, or other counterparty
- tax code, tax amount, claimable ratio, and control-account direction
- accounting treatment: invoice, bill, sales receipt, expense, receipt,
  payment, transfer, loan funding or repayment, owner contribution or draw,
  refund, prepayment, deferred revenue, asset, COGS, or journal
- duplicate risk across attachments, bank lines, source documents, and posted
  entries

### Supplier Or Customer Pattern

Compare a party's current documents with prior confirmed patterns:

- recurring tax treatment and invoice structure
- stable merchant, legal, store, and bank-memo aliases
- normal expense or revenue accounts, items, and tax codes
- expected subtotal/tax/total layout and adjustment lines
- sudden tax amount, contact, account, or source-document format drift

Use prior patterns to flag anomalies, not to override current source evidence.

### Month Or Account

Check whether a period is complete enough for close:

- every statement line is imported, matched, explained, or still open
- bank and debit balances tie to statements
- credit-card liability balances tie to card statements
- transfers and card payments are not misposted as revenue or expense
- duplicate bank-feed and manual activity is not present
- tax summary movements are plausible against source documents and posted
  activity
- suspense, uncategorized, unmatched, unapplied, or missing-evidence items are
  resolved or clearly listed as exceptions

For a complete month or account review, classify every statement line and every
scoped ledger or evidence object. A reconciliation summary can prove account
balance tie-out, but it does not prove that every source document's date,
counterparty, subtotal, tax, total, account, and posting treatment were checked.

### Book Close

Check close readiness:

- trial balance balances
- balance sheet, income statement, general ledger, AR/AP aging, tax summary,
  evidence exception report, attachment manifest, and reconciliation summary
  are internally consistent
- all review exceptions are either corrected, owner-confirmed, or listed for
  accountant handoff

## Professional Criteria

Apply these criteria before calling work reviewed:

- source evidence priority: original documents and statements outrank ledger
  guesses, AI reasoning, and historical defaults, but each source supports only
  the facts it actually contains
- completeness: all source activity in scope is accounted for or explained
- existence: every posted activity in scope has real source support or an
  owner-confirmed explanation, while any unmet jurisdictional document
  requirement remains an explicit exception
- amount accuracy: totals, splits, currency, fees, discounts, refunds, and
  partial settlements are consistent
- tax accuracy: statutory tax lines, zero-rated, exempt, out-of-scope, included
  tax, non-tax levies, recoverable/payable direction, and claimability are not
  conflated
- accounting treatment: use the correct first-class workflow before manual
  journals and avoid treating transfers, card payments, loans, owner activity,
  refunds, deposits, and prepayments as ordinary income or expense
- counterparty accuracy: bank memos, document names, aliases, and historical
  matches support the selected customer or vendor
- cutoff: document dates, payment dates, per-line statement transaction or
  posting dates, and period boundaries are not interchanged
- consistency: similar activity is treated consistently unless source evidence
  explains the difference
- reconciliation: statement-backed accounts tie to statement evidence
- traceability: every exception states the evidence reviewed, the mismatch, the
  recommendation, and whether user or accountant confirmation is needed

## Check Matrix

For complete review, produce a check matrix before final conclusions. Each
scoped item must have every required check marked with one of these statuses:

- `pass`
- `warning`
- `fail`
- `needs_user`
- `unknown`
- `not_applicable`

Use `not_applicable` only when the check truly does not apply to that item
type, and explain why. Use `unknown` when the check applies but the evidence is
missing, unreadable, unavailable, or professionally inconclusive.

For each required check, include:

- status
- evidence reviewed
- field provenance for material source values, including `statement_supported`
  whenever original statement facts support a conclusion
- reason for `warning`, `fail`, `needs_user`, `unknown`, or `not_applicable`
- recommended action, or `none`

The item final status is the highest-risk status across its required checks.
Do not mark an item `pass` if any required check is `warning`, `fail`,
`needs_user`, or `unknown`.

## Output Contract

Write the user-facing report first. It must be in the user's language and it
must be readable without opening JSON. JSON artifacts such as
`review_report.json` are supporting workpapers only; do not use JSON as the
primary user report.

The user-facing report must start with:

- review type: complete review, initial risk scan, or sample review
- exact scope and denominator
- coverage counts by status
- whether every item in scope was reviewed
- the discovered issues, or a clear statement that no issues were found in the
  completed scope
- what remains blocked, unknown, or outside scope

Then include an item-by-item review table or grouped item list. For every
scoped item, show:

- item reference and type
- final status
- source evidence reviewed
- required checks and their conclusions
- field provenance for material source values, including `statement_supported`
  whenever original statement facts support a conclusion
- any mismatch, uncertainty, or missing evidence
- recommended action or `none`

For transaction-like records, include required checks such as:

- evidence present and readable
- payment or receipt supported
- business nature supported
- recognition date supported under the book's accounting basis
- jurisdictional tax documentation supported or explicitly unresolved
- source date matches or is explained
- counterparty matches or is explained
- subtotal, tax, adjustments, and total match or are explained
- tax code and tax direction are correct or unresolved
- posting treatment is correct or unresolved
- bank/card statement line match or traceability is present
- duplicate check result

For bank or card statement lines, include required checks such as:

- line imported or accounted for
- matched, reviewed exception, or unmatched status
- amount and sign match the statement account type
- transfer, card payment, fee, refund, loan, or owner activity treatment
- linked source document or explanation
- whether the statement supports only account movement or also supports the
  underlying treatment under the jurisdiction profile

Do not treat a documented explanation as a substitute for a locally required
invoice, receipt, prescribed tax document, or other source record.

For correction, application, reversal, opening-balance, and generated entries,
include traceability checks instead of forcing receipt-style checks:

- source workflow or parent document
- reason or review note
- linked evidence or owner/accountant explanation
- period and account impact
- whether further user or accountant confirmation is needed

Only after the readable report, write a machine-readable report such as
`review_report.json`. Use one object per scoped item or finding. For complete
review, include a coverage entry for every scoped item even when the item
passes. For issue reports, include every `warning`, `fail`, `needs_user`, and
`unknown` item:

```json
{
  "scope": "transaction",
  "status": "needs_user",
  "issue_type": "tax_split_mismatch",
  "severity": "high",
  "record_ref": "expense:<id-or-number>",
  "evidence": {
    "source_total": "113.00",
    "source_tax": "13.00",
    "book_total": "113.00",
    "book_tax": "0.00"
  },
  "recommendation": "Use the applicable HST tax code and split 13.00 as purchase tax.",
  "safe_to_auto_fix": false,
  "confirmation_needed": "owner_or_accountant"
}
```

Top-level report fields should include:

```json
{
  "review_type": "complete_review",
  "complete_scope_reviewed": true,
  "sampling_used": false,
  "scope": {
    "book": "<book-name-or-id>",
    "date_from": "2026-05-01",
    "date_to": "2026-05-31",
    "population_count": 146
  },
  "coverage": {
    "pass": 129,
    "warning": 10,
    "fail": 2,
    "needs_user": 4,
    "unknown": 1,
    "total": 146
  }
}
```

Allowed item `status` values:

- `pass`
- `warning`
- `fail`
- `needs_user`
- `unknown`

Severity:

- `high`: affects tax, revenue, expense, asset/liability classification,
  bank/card reconciliation, duplicate posting, or close readiness
- `medium`: affects counterparty, period, category consistency, or evidence
  quality
- `low`: affects memo, non-material metadata, or documentation quality

## Auto-Fix Boundary

Default to no mutation. Mark `safe_to_auto_fix` as `true` only when source
evidence, ledger state, and the official Vibooks correction workflow are clear.

Never auto-fix:

- ambiguous accounting treatment
- uncertain tax status
- unclear customer or vendor identity
- closed-period changes
- material revenue, expense, asset, liability, AR, AP, loan, owner-equity, or
  tax changes that need owner or accountant judgment

When the user approves a correction, use the normal Vibooks correction,
replacement, reversal, reopen, apply, reconciliation, or tax-code correction
workflow. Do not edit storage directly.

## Completion Standard

An independent evidence review is complete only when:

- the isolation statement is recorded
- prohibited bookkeeping artifacts were not used
- the review type is declared as `complete_review`, `initial_risk_scan`, or
  `sample_review`
- for `complete_review`, every scoped item is enumerated and marked `pass`,
  `warning`, `fail`, `needs_user`, or `unknown`
- for `complete_review`, every required check for every scoped item is marked
  `pass`, `warning`, `fail`, `needs_user`, `unknown`, or `not_applicable`
- every `unknown` and `not_applicable` check has a reason
- material script-extracted source fields are visually confirmed or clearly
  labeled as unconfirmed candidate values
- statement-supported transaction-like items separately conclude payment or
  receipt support, business nature, recognition date, and jurisdictional tax
  documentation; no item passes from account-movement evidence alone
- the coverage totals add up to the declared scope denominator
- exceptions include source evidence, ledger comparison, severity,
  recommendation, and confirmation requirement
- unresolved issues are summarized for the owner or accountant
- the user receives a readable item-by-item report in the user's language, not
  only JSON or a high-level summary
- no ledger mutation occurred without explicit user approval

If any complete-review requirement is not met, say the work is incomplete and
label it as an initial scan, partial review, or blocked review. Do not present
sampled evidence as a full-scope conclusion.
