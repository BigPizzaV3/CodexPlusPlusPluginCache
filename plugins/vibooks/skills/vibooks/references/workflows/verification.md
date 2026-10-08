# Controls And Verification

## Contents

- Tax rounding rules
- Tax rule design
- Posted tax-code corrections
- Tax summary review
- Tax returns
- Evidence and attachments
- Reconciliation
- Month-end validation
- Completion standard

## Tax Rounding Rules

When a source bill or invoice rounds tax per line and the summed source tax
differs by a cent or two from subtotal times rate, keep the standard statutory
tax code. Do not create one-off tax codes such as `HSTX1501` only to absorb
rounding.

Use these rules:

- before posting Japanese qualified-invoice workflows, verify that the book
  policy uses `tax_rounding_scope: invoice_rate` and the accountant-approved
  `tax_rounding_mode`
- if the source shows separate taxable lines, preserve them as separate
  `lines[]` entries under the normal tax code such as `HST15`
- if line splitting still cannot match the source tax exactly, keep the normal
  tax code and use `tax_amount_override` plus `tax_override_reason` on the
  affected line
- use a short auditable reason such as `supplier_rounding`; for Japanese
  qualified-invoice per-invoice/per-rate rounding, use
  `statutory_invoice_rounding`
- if a posted bill or invoice already used the wrong tax code but the posted
  amount is otherwise correct, use `invoice:replace-tax-code` or
  `bill:replace-tax-code` to relabel the posted tax lines back to the statutory
  tax code while preserving the posted tax amount with `tax_amount_override`
  when needed
- `replace-tax-code` is only for tax classification corrections; if the
  economics, date, party, settlement, or source amount is wrong, use the normal
  reversal, void, reopen, or credit-note workflow instead
- reserve new tax-code master data for genuinely different statutory or
  contractual tax regimes

## Tax Rule Design

Use tax-code master data to describe the real statutory regime, not one-off
operator workarounds.

Rules:

- when a documented jurisdiction profile defines the expected statutory tax
  code names, rates, or control-account roles, follow that profile instead of
  inventing local aliases
- use `sales_rule` and `purchase_rule` when the tax treatment is compound,
  reverse-charge, withholding, or otherwise asymmetric between sales and
  purchases
- use one tax code for the real statutory treatment and keep claimability
  choices on the document line with `tax_claimable_ratio`; do not clone tax
  codes just to express partial recoverability
- use the stored line `tax_detail` as the authoritative explanation of the
  component-level tax posting; do not reconstruct multi-component taxes from a
  single display `rate` alone
- when a document needs grouped liability and asset tax components, keep them
  inside the same tax code rule instead of splitting the business line into
  fake mirror lines

## Posted Tax-Code Corrections

Use the dedicated correction actions only when a posted invoice or bill has the
wrong tax code tag but the posted amount itself should stay unchanged.

- `post-v1-books-book-id-invoices-invoice-id-replace-tax-code`
- `post-v1-books-book-id-bills-bill-id-replace-tax-code`

Rules:

- replace the wrong historical tax code with the correct active statutory tax
  code; do not create a near-duplicate tax code just to make the old tax amount
  appear to fit
- the replacement tax code must support the same document direction and post to
  the same tax control account
- when the replacement rate differs from the historical implied rate, provide
  `tax_override_reason` so Vibooks can preserve the already-posted tax amount
  with `tax_amount_override`
- this workflow updates tax metadata with audit history; it does not reopen
  applied receipts or payments and it does not change the posted gross amount
- if the tax amount itself was substantively wrong and should no longer remain
  on the books, do not use `replace-tax-code`; use the normal corrective
  document flow instead

## Tax Summary Review

Use `get-v1-books-book-id-tax-summary` as the authoritative tax-code summary
before tax settlement, accountant handoff, or jurisdiction-specific review.
Do not reconstruct tax totals from journal rows unless the API is unavailable.

The summary exposes, per tax code:

- `sales_base_total` and `sales_tax_total` for output-tax activity
- `purchase_base_total` and `purchase_tax_total` for claimable input-tax
  activity
- `net_tax` as sales tax less claimable purchase tax
- `source_currency`, `scale`, `posting_scale`, `reporting_scale`, and
  `calculation_scale` from the effective book policy when available
- `invoice_rate_groups` for source-document, per-tax-code review of
  invoice-rate VAT/GST/consumption-tax totals

For VAT/GST/consumption-tax profiles, use these fields to prepare review
workpapers. Keep statutory tax codes on the source documents, and use the
source document and evidence review to explain any override or partial
claimability instead of changing the tax-code master data.

For accountant handoff, use `get-v1-books-book-id-accountant-handoff` with the
true review date range. It returns financial statements, trial balance, general
ledger, journal entries, A/R and A/P aging and open items, bank reconciliation
summary, tax summary, evidence exceptions, attachment manifest, and
jurisdiction notes as review workpapers; it does not file a tax return.
Omit `sections` for the full package. When the accountant asks for a narrower
package, pass repeated `sections` values for only the needed workpapers so the
JSON payload and workbook tabs match the selected report pack.
Leave `basis` unset for the default accrual-basis package. Pass `basis = cash`
or `basis = tax` only when the accountant explicitly requests that basis; it
applies to the included Profit and Loss and Balance Sheet sections, while other
workpapers remain source-based or accrual-oriented review schedules. Tax basis
currently resolves through the cash-basis view plus tax adjustments.

When the accountant needs downloadable workpapers, use
`post-api-admin-export-accountant-package` for the same date range. Prefer
`format = xlsx` for a professional Excel workbook; use `format = zip` when the
recipient also needs each selected report as an independent XLSX workbook, the
JSON workpaper payload, and package manifest. ZIP report filenames include the
company, book, date range, and report language so extracted year-end packages do
not overwrite similarly named reports. Include a `sections` array only when the
accountant explicitly wants a subset; supported ids are
`trial_balance`, `general_ledger`, `journal_entries`,
`income_statement`, `balance_sheet`, `cash_flow`, `equity_rollforward`,
`ar_ap_aging`, `open_receivables`, `open_payables`,
`bank_reconciliation_summary`, `tax_summary`, `invoice_tax_detail`,
`evidence_exception_report`, `attachment_manifest`, and `jurisdiction_notes`.
In the desktop app, use `Reports > Accountant Package` for operator-driven
exports. Choose `Full fiscal year` for year-end handoff, `Fiscal year to date`
for interim accountant review, `Current period` for monthly close review, or
`Custom range` only when the accountant explicitly asks for a nonstandard
period. Leave all workpapers selected for the default accountant package, or
clear the reports the accountant did not request. The normal report export menu
is only a shortcut into this workflow.

Accountant packages use the same module-based report access for paid and Trial
grants, including historical grants; they do not require the `export_import`
module. Keep the export
operation's admin scope and each selected report's module requirements from
live discovery. Tax workpapers (`tax_summary`, `invoice_tax_detail`) require
`taxes`; omitting `sections` or sending an empty array selects the full package,
including tax workpapers. Without tax access, agree on an explicit non-tax
subset instead of silently omitting requested workpapers. Existing read-only
report access after expiry also applies to accountant packages.

An accountant package is for review, not a restorable book transfer or database
backup. Its attachment manifest lists evidence; it does not bundle the original
attachment files. Portable whole-book export/import and backup/restore retain
their separate module requirements. Check live discovery on the connected app;
an older app may require an upgrade to provide report-based package access.

## Tax Returns

Use `tax-returns` as the first-class filing workflow. Do not treat tax filing
as an ad hoc manual journal unless Vibooks truly lacks a first-class path for
the jurisdictional requirement.

Rules:

- prepare a draft return for the true filing period and review the summarized
  payable and recoverable rows before filing
- file the return only after the underlying period data is complete enough for
  filing; the filing action generates the tax settlement reclass entry
- use a dedicated clearing or settlement liability account as
  `offset_account_id`; do not point the return at a bank statement account
- keep statutory tax codes on source documents even when a purchase-side input
  tax is only partly claimable; express that by setting
  `tax_claimable_ratio` on the purchase line rather than inventing near-duplicate
  tax codes
- once a return is filed, corrections should normally happen through the
  underlying document correction flow plus a later amended return or later
  period settlement decision, not through silent mutation of the original filed
  result

## Evidence And Attachments

When the owner provides source documents, import them into Vibooks managed
evidence storage before or with the related bookkeeping work.

Use attachments for:

- supplier bills, vendor invoices, receipts, remittances, and payment
  confirmations
- customer counter receipts, POS summaries, cash-sale support, and immediate
  purchase support
- OTA statements, processor payout summaries, settlement reports, property
  owner statements, and channel remittances
- bank and card statements, statement exports, and fee notices
- contracts, loan schedules, adjustment support, and cutover trial balances
- manual journal support when no first-class document workflow exists

Do not fabricate attachments for internally generated records when no external
source file exists.

Attachment import rules:

- use `post-v1-books-book-id-attachments` to import the file into managed
  evidence storage
- for agents, CLI automation, and remote HTTP callers, prefer `name` +
  `content_base64` + `sha256` so the request does not depend on the server
  being able to read the caller's local filesystem
- local desktop or same-host callers may alternatively provide a local
  filesystem path or `file://` URI
- do not provide a remote HTTP URL
- provide the true SHA-256 of the file contents
- keep the original file content unchanged
- when the same source document already exists in Vibooks, reuse the existing
  attachment instead of importing duplicates when practical

Typical import flow:

1. compute the file's SHA-256 locally
2. if the caller is not on the same machine as Vibooks, base64-encode the file
   and include `name`
3. import the file as an attachment
4. capture the returned attachment id
5. pass that id in `attachment_ids` when creating the related invoice, sales
   receipt, customer refund, bill, expense, vendor refund, receipt, payment,
   or manual journal entry

When a supporting file arrives after the document was already posted:

- import the file first with `post-v1-books-book-id-attachments`
- then use the matching source-document `:add-attachments` action when Vibooks
  exposes one:
  - invoices, bills, sales receipts, customer refunds, expenses, vendor
    refunds, receipts, and payments
- use `entries/{entry_id}:add-attachments` only for true journal-entry-level
  evidence such as manual journals
- do not use `:replace`, `:cancel`, or reversal flows merely to add or swap
  support files when the business facts, amounts, dates, tax, and settlement
  state are unchanged
- if the new evidence shows the original economics or tax treatment was wrong,
  stop treating it as an attachment correction and use the proper document
  correction workflow instead

When a wrong or duplicate file was linked to a posted document:

- use the matching source-document `:remove-attachments` action with a short
  auditable `reason`
- do not use a reverse, replace, reopen, or batch-delete workflow merely to
  unlink evidence from a posted document
- if the removed file is still linked somewhere else, Vibooks removes only the
  current document link
- if the removed file was the last remaining document link, Vibooks may delete
  the managed attachment record and file as part of the same evidence cleanup

Example remote-safe attachment payload:

```json
{
  "name": "source-document.pdf",
  "content_base64": "<base64-encoded-file-bytes>",
  "sha256": "64-char-lowercase-hex",
  "mime": "application/pdf"
}
```

Local same-host callers may alternatively send:

```json
{
  "uri": "file:///absolute/path/to/source-document.pdf",
  "sha256": "64-char-lowercase-hex",
  "mime": "application/pdf"
}
```

Evidence-linking rules:

- invoices, sales receipts, customer refunds, bills, expenses, vendor refunds,
  receipts, payments, and manual journal entries should carry `attachment_ids`
  when supporting documents exist
- for bank or card reconciliation, import the statement file even if the
  reconciliation snapshot itself does not take `attachment_ids`
- for opening balances, attach the cutover trial balance, prior balance sheet,
  or equivalent closing package when available
- if one source document supports several transactions, link it only where the
  business relationship is real and clear

## Reconciliation

### Statement Lines

Use `post-v1-books-book-id-bank-lines` to capture imported or manually entered
bank, debit-card, and credit-card statement evidence before matching it to
posted ledger activity.

Rules:

- statement lines are statement evidence, not the primary business-document
  posting workflow
- statement evidence supports the observable account movement, amount, the
  transaction and posting dates actually shown for the individual line,
  displayed payee or memo, and reconciliation; it does not by itself prove the
  underlying business purpose, accounting classification, recognition period,
  deductibility, or commodity-tax entitlement
- create one `bank-line` per real statement line; do not collapse multiple
  lines into one net amount unless the source statement itself shows a single
  netted line
- record the line against the correct statement-backed account, with the real
  signed amount and meaningful payee or memo text from the source statement
- use the financial institution's per-line posting or clearing date as Vibooks'
  `statement_date` when the source shows both transaction and posting dates;
  retain the transaction date in the original evidence and the bank-line
  `reference` or `note`, and never substitute the statement period-end or
  closing date
- if the source shows only one per-line date, use it as `statement_date` and
  identify whether it is a transaction date, posting date, or unknown rather
  than silently relabeling it
- bank and debit accounts normally treat a positive statement line as an asset
  increase; credit-card liability accounts normally treat a positive statement
  line as a liability increase
- when matching, require the same statement account, the same source currency,
  and no duplicate reuse of an entry that is already matched to another
  statement line for the same account
- Vibooks may match within a controlled timing window around `statement_date`;
  matching does not make that field the transaction's recognition date
- one statement line may match multiple posted entries when their net movement
  on the statement account equals the signed statement amount
- when a statement line reveals a missing transaction and the full treatment is
  supported, create the appropriate formal posted receipt, payment, or journal
  entry from the bank-line workflow and let Vibooks auto-match it
- when the account movement is genuine but the offset classification or tax
  treatment is unresolved, do not invent revenue, expense, or tax: with
  explicit owner or accountant approval, use the bank-line create-entry flow to
  record the supported statement-account movement against a dedicated suspense
  or clearing balance, claim no tax, retain the source-date facts and review
  note, and auto-match the line; keep the business-nature, recognition-date, and
  tax-documentation checks unresolved until the suspense balance is
  reclassified through the normal correction or adjusting workflow
- use the temporary suspense path only when the statement-account date and
  movement are themselves supported; if they are not, or approval is absent,
  leave the line `unmatched` so reconciliation and period close remain blocked;
  do not convert a genuine unrecorded movement to `reviewed_exception`
- use reviewed exceptions only for lines that are explained and documented but
  cannot yet be formally matched
- when statement evidence proves only that money moved, keep the business
  nature, recognition date, and tax-documentation checks unresolved instead of
  inventing them from the bank memo

### Bank And Debit Accounts

1. map each real account to its own bank or cash asset account
2. import or create statement lines
3. match statement lines to posted entries, match them to multiple posted
   entries when the net movement ties, create a fully supported missing posted
   transaction, or—with explicit approval—record a genuine but unclassified
   movement against suspense without a tax claim; then auto-match it
4. ignore unmatched lines only with a reason
5. create a reconciliation snapshot
6. treat reconciliation as complete only when unmatched items and unexplained
   difference are zero

Statement-account review rule:

- when reviewing a bank or card account, inspect the statement account itself
  together with posted account activity, transfer journals, imported statement
  lines, and reconciliation snapshots
- do not treat a statement account as a balance-only summary

### Credit Cards

Use the same `bank-lines` plus `reconciliations` workflow for credit-card
statements, but keep the ledger account itself as a liability.

1. keep one liability account per card
2. classify statement-backed cards as `credit_card_liability`
3. post each charge to that liability account
4. post each payment against that liability account
5. import or create card statement lines for the same liability account
6. compare the liability balance to the card statement ending balance
7. investigate timing differences, missing charges, duplicate charges,
   interest, fees, and card-payment settlement timing
8. do not consider the card reconciled until the liability balance ties to the
   statement after documented timing items

Statement-balance direction rules:

- bank and debit accounts: a positive statement line normally means the asset
  increased
- credit cards: a positive statement line normally means the liability
  increased
- credit-card payments usually reduce the liability, so the statement line
  should reflect the liability decrease, not a cash increase

## Month-End Validation

Before closing a period:

1. run trial balance
2. run balance sheet
3. run income statement
4. run general ledger for review
5. review AR and AP aging when those modules are used
6. reconcile every bank and debit account
7. tie every credit card to its statement
8. confirm no unexplained unapplied receipts, unapplied payments, or orphan
   balances remain
9. when dimensions are used for departments, projects, branches, or locations,
   run grouped management reports with `group_by_dimension_id` and targeted
   slices with `dimension_filter`
10. when Canadian vacation pay is active, run the vacation-pay report as of the
    close date; require employee event balances to equal the active Vacation Pay
    Payable GL balance, each reference period's target/credit/true-up trace to
    agree with its server-selected published release and formula, payroll earning
    and payout dates to agree with the source run, every payment allocation to use
    an already-earned bucket, Québec protected-absence openings to retain their
    exact fact set and section-74 trace, owed to stay nonnegative, and no unresolved
    period blocker
11. when Canadian pay statements are active, list every statement for the
    payroll period and require one active statement for each active posted run;
    verify pay date selected the exact published rule interval, current gross
    minus employee deductions equals net, employer contributions do not reduce
    net, protected earning hours match the confirmed run facts, YTD agrees with
    active native payroll history, Québec formal language follows the effective
    request, and rendered artifact hashes remain stable on re-read
12. when payroll remittances are prepared, require each record to tie to the
    exact installed authority period, active source payrolls, and payroll
    liabilities; distinguish `prepared` from a recorded external payment,
    require the actual payment date and authority confirmation reference, and
    verify the active payment's atomically linked cash-to-liability journal,
    remaining obligation, authority credit, and append-only correction history
13. at Canadian payroll year-end, require the T4 data preview and, for Québec
    employees, the RL-1 preview to agree with active immutable payroll YTD,
    effective legal identities, opening YTD facts, and signed
    adjustment/reversal history; require zero blockers. While the exact annual
    government form package is absent, require T4 PDF/download/print to remain
    unavailable and keep filing and employee distribution explicitly incomplete
14. when an ROE is required, require the active interruption event, exact
    employment-history boundary, applicable typed statutory-payment facts, and
    complete field coverage to agree with posted payroll and effective legal
    identities before accepting a retained preparation worksheet; keep official
    completion, validation, and submission explicitly external to Vibooks

For a statement correction, verify the original remains reproducible, reversal
appends a new voided statement revision and exact artifact, replacement appends
a new generation/revision, and no view/render/ZIP action created a provision
event. Inspect paper-handoff events only as factual external-action records;
mistakes must have an append-only void/replacement successor, and Vibooks must
not infer payment, timeliness or legal qualification from the handoff timestamp.
Apply this workflow uniformly across every supported Canadian jurisdiction; a
province-specific employment-standard workflow does not narrow pay-statement
or paper-handoff support.

For paper-handoff verification, require the server-derived `paper_handoff`
projection to agree on statement list, detail and owning payroll-run responses.
Reject a handoff timestamp later than server time. An active `handoff` or
`correction_replace` may receive a `replace` or `void` successor; an active
`correction_void` may receive only a `replace` successor to restore the handoff;
`legacy_external_note` is read-only. Confirm the terminal current event drives
the projected status, last handoff, optional employee acknowledgement and source
reference, while every corrected event remains visible in the audit history.
Treat paper delivery and cash-wage payment as separate evidence domains.

For remittance verification, do not accept a prepared record as proof of
payment. Reconcile the remittance's active source payrolls and authority total
to the relevant payroll liabilities. After `:recordPayment`, verify that the
same response and re-read detail retain the actual external reference and date,
an active payment event, and its exact settlement journal; confirm that the
funding-account credit, payroll-liability debit, any explicit authority-credit
asset, paid amount, remaining amount and excess amount all agree. The atomic
action is the Vibooks bookkeeping record, but it is not proof that CRA or Revenu
Québec received or allocated the money; confirm that separately in the
authority account.

A confirmation-only correction must append a new reference version without
changing the journal. A withdrawal must neutralize the payment and append a
reversing journal link. A replacement must preserve both of those predecessors
and append the corrected payment and settlement. Reconcile the terminal active
event rather than summing neutralized events. A cancelled prepared record
remains in revision history; a record with payment history is never cancelled
or deleted to rewrite evidence. Preview, download and print must reproduce the
same retained remittance PDF bytes and must not change lifecycle state.

For T4, ROE, and RL-1 preparation, verify employee and province assignment,
effective employer and employee legal identities, active payroll and opening
YTD sources, box or field mappings, and every signed adjustment and reversal.
For T4, reconcile boxes 24 and 26 to the employee's annual earnings limits
across all provinces for the same employer. Verify QPIP employee premiums in
box 55 and distinguish an omitted box 56 from zero eligible earnings. A signed
box 56 correction uses retained eligible earnings, even when the unadjusted box
was omitted under the reporting rule. Review adjustment and reversal evidence;
never silently truncate an explicit correction to make it fit an annual limit.
If incomplete original payment chronology affects a cross-province allocation,
retain the preparation blocker instead of guessing the order from an opening
balance's entry date. Unrelated income limits must not require that chronology.
For T4, verify the on-screen preview facts and blockers and also verify that no
artifact, content, render, download, or print operation is offered while the
exact annual CRA form package is unavailable. For each retained ROE review PDF,
require the response and re-read detail to pin the exact form-definition
activation, schema revision, PDF-renderer release, source fingerprint, revision
lineage, immutable content hash, and byte length; rendering or downloading it
again must reproduce the same bytes. A successor must preserve the original and
point to its predecessor. A balanced preview or retained review report is still
only preparation: do not report filing, authority acceptance, employee
distribution, ROE Web validation, or Service Canada receipt unless a separate
supported workflow and retained external evidence prove that exact event.

For retained external payroll origins, reconcile the complete registered credit
and documentary components to the original posted journal without a second wage
or cash entry. Check current generation, actual source reversal, historical
payment associations and the separate settlement readiness result. Withdrawal
of an active payment association does not erase its retained history. After a
supported restore or clone, compare source and audit evidence: owned local IDs
may be rebased, but external business identifiers and correction text must keep
their meaning even if they equal an old internal ID. Matching aggregate totals
alone does not prove that history was preserved.

For a vacation correction, inspect the full append-only chain: source and
replacement openings, opening event and exact reversal, period close and
true-up history, payment parent and server-owned children, journal entries,
effective account version, post/reversal request IDs, approval identities,
`replaces_calculation_id` / `replaced_by_calculation_id`, and audit rows. Do not accept matching
aggregate totals when the exact payroll component, period allocation, account,
published rule release, or correction lineage differs.

For monthly compensation and employment facts, read all history pages and
compare the current source identities, effective/reviewed dates, predecessor
and authenticated author with the supplied evidence. Verify that an identical
request retry returns the same retained result without another fact, audit
record or journal. A changed source or connection authority is not the same
request. Read-only access must not write facts, and a claimed author in a
request header must not override the authenticated author. Source intake is
not proof that an obligation was posted or that any cash was paid.

For a current monthly vacation reassessment, verify the full active owner
version map and source IDs, then compare preview, post receipt, owning balances
and actual GL. All original/common prefixes and a terminal residual must use
the same assessment basis; an older owner's paid excess cannot discharge a
different owner or payment category. For example, a sourced provision changing
from 2,400.00 to 3,600.00 records a 1,200.00 difference, not another 3,600.00.
A later assessment must retain already final actual-use amounts rather than
reprice them solely because normal compensation changed.

Check the cutoff against all retained and newly proposed actual portions.
July 6–10 actual use cannot enter a July 1 or July 9 assessment; July 10 and
later cutoffs can include the complete retained episode. A refusal must leave
calculation, owner, claim and journal state unchanged. Preview success alone
adds no balance, time claim or payment. Posting must verify the current source
and ledger state atomically, and both positive and zero-net adjustments must
respect fiscal locks. A zero-net adjustment can still require separate owner
changes and immutable evidence without a zero journal.

Verify identical post and reversal retries against their original receipts,
with no duplicate events, claims or cash. Reversal must preserve actual outside
payment history and refuse changed downstream activity, including a payment
followed by its reversal that restored the same numerical balance. Check that
portable restore or clone preserves source and request identities while
mapping internal owner and ledger IDs correctly. A posted provision adjustment
or advance assessment is not evidence of payroll settlement, a bank movement
or actual leave taken; verify those through their own supported sources.

For monthly vacation openings, reconcile distinct actual payment sources and
their current period allocations as well as the liability total. Allocations
against one source must not exceed its complete gross amount. One 500.00 source
split 250.00 + 250.00 credits only 500.00; against 2,307.70 earned, 1,807.70
remains owed. The same source repeated on two rows cannot credit 1,000.00.
Check that replays add no journals or allocations, reversal does not refund
cash or release attribution, and corrected allocations retain their predecessor
and reviewed source evidence. Verify that a merged or retired source remains
resolved after subsequent ordinary reopening, so an obsolete identifier cannot
mint another payment allowance. Equal gross amounts such as 500, 500.0 and
500.00 have the same cent value; harmless formatting must not change capacity
or require correction of the original evidence. Unallocated gross and another period's paid
excess are not available to offset an unrelated obligation automatically.

For an ended monthly employment spell, verify the complete original/common
statutory comparison, the already earned annual obligations, and the separate
terminal residual. For example, a sourced 4,000.00 total with 1,209.86 already
owned by an annual obligation leaves a 2,790.14 residual; 1,200.00 actually paid
to that annual obligation leaves 2,800.00 owed across both owners. The gross
comparison is not a second payable or a statement that nothing was paid.
Check the actual row measurements and GL. A zero terminal residual must remain
visible in the source history without adding weeks, wages or a zero journal.
An anniversary on the termination day and that day's actual wages must remain
in their correct source windows. Later payments before the opening date must
not be lost merely because employment already ended. Reversal, reopening and
restore must preserve every owning obligation and its actual payment history.

`current_monthly_payment_history` is current source-attribution evidence,
including recognition status and obligation versions. It is not an as-of-date
balance report: use the report's dated financial totals and GL separately.
Consistent older stored records can retain their original interpretation;
ambiguous source history must be reconciled before fresh reuse. Exact old
operation replay and authorized reversal must remain available without
rewriting the saved request or inventing replacement payment identities.

Preferred verification command:

```bash
vibooks-cli verify \
  --book-id BOOK_ID \
  --as-of 2026-01-31 \
  --date-from 2026-01-01 \
  --date-to 2026-01-31
```

`--expect-account-balance ACCOUNT_OR_CODE=AMOUNT` compares the trial-balance
signed net: debits minus credits. Derive that expected value independently from
the original statement and account type. A bank asset balance of 670 is `670.00`;
a credit-card amount owed of 113 is `-113.00`, while a genuine card overpayment
of 113 is `113.00`. Do not copy the ledger's reported value merely to make the
check pass. Statement reconciliation separately uses the account's statement
balance direction, so the same card amount owed remains positive there.

Before closing a period, complete the source review, statement reconciliations,
and report checks, then read the current period and live close request schema.
Submit a non-empty checklist describing checks actually performed; do not invent
review evidence or treat a balanced trial balance alone as complete review.
When the effective policy requires approval, create the approval request for the
exact period action and intended request payload, have a different authorized
reviewer approve it, and submit that same payload with the resulting approval
ID. Creating an approval request does not approve or close the period. Do not
change policy, impersonate a reviewer, or grant access to bypass a refusal.
Reopening also requires the supported approval and a meaningful reason; fetch
its own live schema rather than reusing the close payload. After each action,
read back the period and retained close or approval history. Report the period
as open until the actual close succeeds.

Useful report commands:

```bash
vibooks-cli invoke get-v1-books-book-id-reports-trial-balance --path bookId=BOOK_ID --query as_of=2026-01-31
vibooks-cli invoke get-v1-books-book-id-reports-balance-sheet --path bookId=BOOK_ID --query as_of=2026-01-31
vibooks-cli invoke get-v1-books-book-id-reports-income-statement --path bookId=BOOK_ID --query date_from=2026-01-01 --query date_to=2026-01-31
vibooks-cli invoke get-v1-books-book-id-reports-general-ledger --path bookId=BOOK_ID --query date_from=2026-01-01 --query date_to=2026-01-31
vibooks-cli invoke get-v1-books-book-id-reports-income-statement --path bookId=BOOK_ID --query date_from=2026-01-01 --query date_to=2026-01-31 --query group_by_dimension_id=DIMENSION_ID
vibooks-cli invoke get-v1-books-book-id-reports-trial-balance --path bookId=BOOK_ID --query as_of=2026-01-31 --query dimension_filter=DIMENSION_ID:DIMENSION_VALUE_ID
```

When a user needs a PDF, use the live-discovered
`POST /v1/books/{book_id}/report-artifacts:render` contract. It returns the
canonical report PDF used by both API consumers and the desktop preview,
download, and print flow. Send a fresh `Idempotency-Key` for a new artifact;
retry the same key only with the same token, book, and normalized request.
Request JSON for a base64 artifact or `Accept: application/pdf` for the exact
same raw bytes.

The PDF contract supports Trial Balance, Profit and Loss, Balance Sheet, Cash
Flow, Changes in Equity, A/R and A/P Aging, Payroll Detail, Employee Payroll
Ledger, Payroll Liability Summary, and Employer Burden Summary. General Ledger
remains a paged JSON/CSV/XLSX workflow because it can be high volume. Profit
and Loss accepts one to 24 explicit date-range columns; Trial Balance, Balance
Sheet, and Aging accept one `as_of` column; the remaining reports accept one
date range. Only Profit and Loss and Balance Sheet accept `basis`. Only Profit
and Loss, Balance Sheet, and Trial Balance accept `presentation_mode` with
`clean` or `full`. Use live discovery for the exact request schema, filters,
module requirements, response representation, and size errors rather than
copying a stale payload.

Treat any imbalance or statement mismatch as blocking.

## Completion Standard

The job is complete only when:

- Vibooks is installed from official Vibooks packages
- secrets are stored safely
- the local API is not unnecessarily exposed
- a saved API token exists for routine automation, or the owner explicitly
  chose another approved token
- owner-provided source documents are imported into Vibooks evidence storage and
  linked with `attachment_ids` where the workflow supports it
- every material entry has evidence or an explicit owner-confirmed explanation
  for why no source document exists, and any unmet jurisdictional documentary
  requirement remains an explicit exception rather than being cleared by that
  explanation alone
- accounts and dates follow accounting logic
- bank balances tie to statements
- credit-card liabilities tie to statements
- reports and subledgers are internally consistent
