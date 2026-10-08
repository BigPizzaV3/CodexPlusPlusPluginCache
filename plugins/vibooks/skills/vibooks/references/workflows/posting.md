# Posting Workflows

## Contents

- Hard accounting rules
- Source-document extraction and visual confirmation
- Resource-creation defaults
- Customer invoicing
- Recurring bookkeeping
- Customer-facing document templates
- Chart-of-accounts rules
- Date rules
- Prefer first-class workflows
- Common posting patterns
- Opening balances

## Hard Accounting Rules

- use first-class business-document workflows before manual journals
- use recurring templates for predictable repeats instead of cloning prior-period
  invoices, bills, or journals by hand
- post from evidence, not guesses
- before editing an existing draft journal or recurring journal template, read
  its full current detail and live update schema. Preserve original currencies,
  exchange rates, source and functional amounts, tax and dimension facts, and
  attachment and external-document links in the required replacement payload;
  do not assume a description-only update preserves omitted fields. If the
  desktop form cannot edit the record's currency or rate, use the supported
  agent/API update with those original facts, then read back and compare the
  result. Do not convert the record to the book currency merely to make the
  simplified form accept it
- never net receivables, payables, taxes, or clearing balances against revenue
  or expense
- do not overwrite posted history; use reversal, cancellation, credit-note,
  reopen, or the dedicated posted tax-code correction workflow
- keep statutory tax separate from non-tax levies, remittances, tips, rebates,
  and similar document components; do not force those into tax codes or tax
  summaries
- create one ledger account per real bank account, debit card, credit card, and
  loan
- reconcile every bank and debit account to statements
- tie every credit-card liability account to the card statement
- do not use manual journals to create normal AR, AP, immediate cash-sale, or
  immediate cash-purchase or refund activity when invoice, sales receipt,
  customer refund, bill, expense, vendor refund, receipt, payment, or apply
  workflows exist
- do not move dates only to make reconciliation easier
- do not use opening balances to smuggle in current-period activity
- treat void and reversal workflows as dated accounting events, not as silent
  deletion of historical activity
- do not use `resources:batchDelete` to remove posted invoices, bills, sales
  receipts, customer refunds, receipts, expenses, vendor refunds, payments,
  payroll runs, inventory activity, or fixed-asset activity
- permanently delete an employee only when the record was created by mistake
  and has no saved payroll setup, legal identity, payroll run, pay statement,
  vacation record, statutory record, accounting entry, or other retained
  history. Use `POST /v1/books/{book_id}/resources:batchDelete` with
  `resource: "employees"`, the confirmed employee IDs, Payroll module access,
  and the normal idempotency controls. Treat `DELETE_CONFLICT` as authoritative:
  never remove dependent payroll records to force deletion; edit the employee
  and set the status to inactive instead
- permanently delete a pay schedule only when it was created by mistake and has
  never been assigned to an employee or referenced by payroll records. Use
  `POST /v1/books/{book_id}/resources:batchDelete` with
  `resource: "payroll_schedules"`, the confirmed schedule IDs, Payroll module
  access, and the normal idempotency controls. Treat `DELETE_CONFLICT` as
  authoritative and deactivate a referenced schedule instead
- if an old hard-delete bug already left a posted invoice, bill, sales
  receipt, customer refund, receipt, expense, vendor refund, payment, payroll,
  inventory, or fixed-asset entry orphaned with no owning source row, confirm
  the source row is gone and then use
  `entries/{entry_id}:reverse` to repair the GL
- when voiding or reversing a posted source-aware document such as an invoice,
  bill, sales receipt, customer refund, receipt, expense, vendor refund, or
  payment, set the economically correct `action_date`; when using generic
  `entries/{entry_id}:reverse`, set `reversal_date` instead; if the
  workflow-specific date is optional and omitted, Vibooks defaults it to
  today
- financial reports follow posted entry dates, not the current document status
  alone

## Source-Document Extraction And Visual Confirmation

OCR, scripts, parsers, and model extraction may prepare normal bookkeeping, but
they are not source evidence. Treat every extracted field as a candidate until
it has been checked against the original receipt, invoice, statement, payout
report, or other source document.

Before presenting a proposed entry to the user or posting a Vibooks resource,
visually confirm every material field that is visible in the source document:

- counterparty name and any relevant merchant, legal, or payee alias
- document number, statement reference, or payout reference when present
- document, transaction, payment, sale, expense, or statement date
- currency
- subtotal, statutory tax such as GST/HST, VAT, or sales tax, adjustments,
  tips, shipping, discounts, fees, and total
- payment account, statement account, card, bank line, or payout line when
  visible from the evidence
- item, account, category, tax code, or first-class workflow treatment when it
  is directly supported by the source document, saved master data, prior
  confirmed pattern, or user/accountant instruction

Run deterministic arithmetic checks before relying on the proposal:

- subtotal plus or minus adjustments plus statutory tax must reconcile to the
  total, allowing only rounding differences supported by the source document,
  tax rounding policy, or a clearly mechanical one-cent calculation difference
- statutory tax amount must be plausible for the jurisdiction, tax code, and
  claimability available in the book
- bank or card statement amount must reconcile to the payment, receipt,
  expense, bill payment, transfer, refund, settlement, or payout treatment

Compare the visually confirmed source facts to the Vibooks create or correction
payload before posting. If a material field is unreadable, missing,
contradictory, or only supported by OCR or script output, do not silently fill
it as confirmed. Ask the user, leave the field unresolved when the workflow
allows it, or classify the proposed posting as needing user confirmation.

When asking the user to confirm a proposed source-backed posting, include a
brief readable check summary in the user's language:

- visually confirmed fields
- fields supported only by statement evidence, saved master data, prior
  confirmed pattern, or user/accountant explanation
- unresolved fields and why they need confirmation
- the proposed Vibooks workflow and accounting treatment

Do not reuse stale OCR, parser, cache, or importer output from an earlier run as
confirmation. Rendering a PDF to an image, cropping, zooming, rotating,
enhancing readability, or using scripts for arithmetic is allowed because those
steps help inspect the original evidence rather than replace it.

## Resource-Creation Rule

When the user does not explicitly say which Vibooks business resources to
create, infer and fill the normal first-class resources directly from the
materials provided.

Default priority:

- if the materials identify a customer, vendor, invoice, bill, sales receipt,
  customer refund, receipt, expense, vendor refund, payment, item, bank
  statement line, or credit-card statement line, create or update those
  resources instead of waiting for the user to enumerate each one
- create supporting master data such as `customers` or `vendors` when the
  source materials clearly establish the party and that master record is needed
- create `items` when repeated products, services, or purchase categories
  clearly need reusable default accounts, tax codes, or prices
- use `bank-lines` for real bank, debit-card, and credit-card statement lines
  when the materials are statement evidence
- prefer first-class document workflows over manual journals when the materials
  support them
- populate as many fields as the materials support, but do not invent parties,
  amounts, dates, tax treatment, currencies, or statement details
- when the materials are source documents, populate material fields only after
  the extraction and visual-confirmation rule above has been satisfied
- if the source materials are incomplete but still sufficient for a normal
  business-document workflow, create the supported resource and leave only the
  unsupported fields unresolved

## Customer Invoicing

Use this workflow for customer sales, invoices, later collection, and customer
prepayments. Inspect the live discovered schemas before acting; do not invent a
field or lifecycle that the current contract does not expose.

Choose the first-class sale before preparing lines:

- use an `invoice` only for a sale on credit where accounts receivable should
  remain open
- use a `sales-receipt` for a sale paid immediately; do not create an invoice
  and an immediate receipt merely to imitate a cash sale
- when cash arrives after an invoice, create a `receipt` and use
  `receipt:apply`; applying the receipt settles AR and does not recognize the
  sale a second time
- when cash arrives before an invoice or before revenue is earned, first record
  it as unapplied customer cash in the customer-deposit liability, then choose
  exactly one of the supported prepayment paths described below
- if the user needs an unsupported advance, pro-forma, tax, or deferred-revenue
  invoice, stop and explain the boundary; do not post premature revenue or
  invent a normal invoice, recognition schedule, or generic-journal workaround

Reuse or create the customer deliberately:

- search the current book before creating a customer and reuse a trusted,
  active match; do not create casing, spelling, or alias duplicates
- create a customer only when source evidence or confirmed user instruction
  establishes a new party
- use the supported customer merge workflow for confirmed duplicate masters;
  never rewrite invoice or receipt history manually

Decide whether the line needs an Item:

- **Inventory goods:** require an active inventory-backed Item. Verify its
  inventory, COGS, sales, statutory tax, unit, quantity, and cost meaning.
  Never omit `item_id` from a real inventory sale, because that would omit the
  deterministic stock issue and COGS/inventory support posting.
- **Repeated products and standardized services:** normally reuse or create an
  active `inventory`, `non_inventory`, or `service` Item when a stable name,
  unit, sales account, tax code, default price, or reporting identity will be
  used again.
- **One-off non-inventory work:** an Item is optional when permanent catalog
  master data would have no continuing value. The explicit line must still
  contain an evidence-supported description, amount or quantity and unit
  price, sales account or supported default, statutory tax treatment, and
  required dimensions.

Before creating an Item, search active Items by stable ID, code, SKU, exact
name, and relevant aliases. Do not create one Item per invoice merely to retain
free-form wording; keep transaction-specific detail in the line description.
Stop instead of reusing an Item whose tax, account, inventory, or unit meaning
conflicts with the sale. Treat all Item defaults as proposals: confirm that the
current evidence still supports the account, tax code, price, unit, and
dimensions, and use supported line overrides for a one-time exception instead
of changing the shared Item.

For every invoice proposal, review at least:

- intended company, book, and customer
- credit-sale status rather than immediate payment
- `issue_date`, `posting_date` when different, required explicit ISO
  `due_date`, currency, and exchange rate when required. Payment terms may
  explain or support the proposed due date, but they are not a substitute API
  field; show the derivation and stop when the actual date is unresolved
- each line's Item decision, description, quantity, unit price or amount,
  sales account or supported default, statutory tax code, tax-rounding
  evidence, and dimensions
- separate non-tax fees, levies, tips, rebates, and similar components in
  `adjustments[]` rather than disguising them as tax
- supporting attachment IDs and source provenance where available
- an AR control-account override only when the book uses a supported
  non-default control account
- whether the goods or services reached the recognition point supported by the
  book's policy; invoice date, cash receipt, and Item defaults are not proof by
  themselves

Visually confirmed source facts, saved master data, prior confirmed patterns,
and user statements remain distinct evidence sources. Never invent customer
identity, delivery or performance completion, taxability, payment state, price,
terms, due date, or recognition timing.

After the user authorizes the proposal:

1. create the invoice through the live first-class endpoint with an idempotency
   key; never post normal AR through a generic journal
2. read it back and verify the documented customer, issue/posting/due dates,
   currency, line facts including stored `item_id`, tax, adjustments, total,
   amount due, attachments, and status
3. when an Item is used, read the current Item separately and verify its
   documented type, accounts, tax, unit, and inventory meaning; do not depend
   on undocumented Item-snapshot fields
4. verify AR and GL results; for inventory sales also verify the stock issue and
   COGS/inventory support posting
5. render the customer-facing document when the user needs a preview or
   handoff. Say that Vibooks rendered it; do not claim it was emailed,
   delivered, acknowledged, accepted, filed, or fiscally submitted without
   separate evidence

Choose one prepayment lifecycle and do not mix them:

- **Future-invoice settlement:** if a supported future invoice will create AR
  and the cash must settle it, keep the receipt unapplied in the
  customer-deposit liability and do not create a receipt recognition schedule.
  Create the invoice only when its supported recognition point is reached,
  then use `receipt:apply`.
- **Direct deferred-revenue recognition:** use
  `receipt:create-recognition-schedule` only when evidence and the effective
  accounting policy support releasing the deposit liability directly without
  later applying this receipt to an invoice. Confirm the recognition account,
  start date, cadence, period count, dimensions, and performance facts; never
  infer them from payment date, invoice terms, or Item defaults.

An active or paused non-cancelled receipt-linked recognition schedule and
receipt application are mutually exclusive. Before applying, unapplying,
replacing, cancelling, or reopening a receipt, read it and inspect
`linked_recognition_schedules`. Do not retry or work around the protected
conflict. To return the receipt to its ordinary lifecycle:

1. reverse every posted recognition line latest-first with `:reverseLatest`,
   reading the schedule after each reversal
2. cancel the schedule only after no posted lines remain
3. read back both the schedule and receipt
4. then apply or correct the receipt through the supported action and verify
   the resulting deposit, AR, revenue, and GL balances

Obtain the normal authorization for every mutation. For invoice corrections,
use void only before allocations, reopen a valid void when supported, replace
a structurally wrong posted invoice through `:replace`, use
`:replace-tax-code` for a tax-code-only correction, issue a credit note for a
valid reduction of the remaining receivable, and use attachment actions when
only evidence links changed. Never hard-delete, silently rewrite posted
history, or use a generic journal as the primary invoice correction.

## Recurring Bookkeeping

- create recurring templates for activity that repeats on a schedule and should
  stay first-class, such as rent bills, subscription invoices, monthly
  depreciation journals, or standing accruals
- create `receipt:create-recognition-schedule` when a fully unapplied customer
  receipt should become deferred revenue
- create `payment:create-recognition-schedule` when a fully unapplied vendor
  payment should become a prepaid expense
- create `recognition-schedules` directly only when there is no better
  first-class source workflow for the originating balance-sheet position, such
  as accrued revenue or accrued expense entries
- choose `invoice`, `bill`, or `entry` template kinds based on the real source
  workflow; do not turn recurring AR or AP into manual journals
- do not use recurring templates to imitate prepaid or deferred recognition
  schedules line by line when one originating balance should be amortized or
  recognized over time
- use `recognition-schedules/{scheduleId}:cancel` only before any due line has
  been posted; once releases are posted, reverse the latest release first and
  keep the source-aware trail intact
- use `post-v1-books-book-id-recognition-schedules-schedule-id-post-due` to
  catch up every due recognition line through an `as_of` date
- use `:reverseLatest` on the recognition schedule when the latest release was
  posted on the wrong date or into the wrong period; do not correct those
  schedule-backed entries with generic entry reverse
- use `post-v1-books-book-id-recurring-templates-run-due` to catch up missed
  scheduled work through an `as_of` date
- pause a recurring template when the business event has stopped temporarily;
  patch the schedule when the cadence changed; resume only after the next
  remaining occurrence is correct
- for recurring journal templates, keep `source_type` business-meaningful and
  prefer a stable `source_ref_prefix` so generated entries remain auditable

## Customer-Facing Document Templates

- use `document-templates` for customer- or vendor-facing HTML/PDF presentation
  of invoices, bills, sales receipts, purchase receipts, customer refunds,
  expenses, vendor refunds, receipts, and payments
- do not use `recurring-templates` for presentation/layout; recurring templates
  create scheduled bookkeeping documents or journals
- list `get-v1-books-book-id-document-templates` before editing so you can see
  built-in ids, current global defaults, current-book overrides, and supported
  `document_type` values
- create a custom template with `post-v1-books-book-id-document-templates`
  using `name`, `document_type`, `scope` (`global` or `book`), `book_id` for
  book scope, and `html`
- patch an existing custom template, or patch a built-in template id to store a
  built-in override; use `:reset` to clear a built-in override rather than
  deleting built-ins
- use `:setDefault` on a global template for the global default, or on a
  book-scoped template for that book's default
- render a real source document with
  `post-v1-books-book-id-documents-document-type-document-id-render`; omit
  `template_id` to use the effective default or pass a template id explicitly
- template HTML supports escaped `{{variable_name}}` tokens such as
  `company_name`, `company_address`, `book_code`, `doc_title`, `doc_number`,
  `doc_date`, `doc_due_date`, `doc_party`, `doc_currency`, `doc_subtotal`,
  `doc_adjustment_total`, `doc_tax`, `doc_total`, `doc_amount_due`,
  `doc_description`, `generated_at`, `theme_color`, and `font_family`
- helper HTML tokens are also available for conditional issuer/totals sections:
  `company_tax_id_html`, `company_address_html`, `company_contact_html`,
  `doc_subtotal_row_html`, `doc_tax_row_html`, `doc_adjustment_rows_html`,
  `doc_adjustment_summary_html`, and `doc_amount_due_row_html`
- use `{{doc_adjustment_rows_html}}` inside line tables and
  `{{doc_adjustment_summary_html}}` inside totals blocks when the rendered
  document should show separate non-tax adjustments distinctly from subtotal
  and statutory tax
- do not show `book_name` or `book_code` in customer-facing output unless a
  legacy customer template explicitly requires it; starter templates treat book
  identity as internal operator metadata

## Chart Of Accounts Rules

Create a new account only when the reporting or reconciliation meaning is
genuinely different.

Common patterns:

- bank account, checking account, debit card account, petty cash: `asset`,
  `debit`, `cash` or `bank`; when tied to statements, use statement role
  `bank_asset`
- accounts receivable: `asset`, `debit`, `current_asset`
- inventory: `asset`, `debit`, `inventory`
- prepaid expense: `asset`, `debit`, `prepaid`
- fixed asset: `asset`, `debit`, `fixed_asset`
- vendor advances: `asset`, `debit`, `current_asset`
- accounts payable: `liability`, `credit`, `current_liability`
- credit card payable: `liability`, `credit`, `current_liability`; when tied
  to statements, use statement role `credit_card_liability`
- customer deposits: `liability`, `credit`, `current_liability`
- owner capital or retained earnings: `equity`, `credit`, `equity`
- operating revenue: `revenue`, `credit`, `revenue`
- other income: `revenue`, `credit`, `other_income`
- cost of goods sold: `expense`, `debit`, `cost_of_sales`
- normal operating expenses: `expense`, `debit`, `expense`
- bank fees, interest expense, and FX loss: `expense`, `debit`,
  `other_expense`

## Date Rules

Use the correct field for the correct date:

- `transaction_date`: when the economic event happened
- `posting_date`: when the ledger recognizes it
- `issue_date`: the document date on an invoice or bill
- `due_date`: the contractual due date
- `sale_date`: the document date on a sales receipt
- `refund_date`: the document date on a customer or vendor refund
- `expense_date`: the document date on an immediate paid purchase
- `receipt_date`: when cash was received
- `payment_date`: when cash left the funding account
- `deposit_date`: when already-held funds were deposited into the bank account
- `statement_date`: the per-line date Vibooks uses for statement matching and
  reconciliation; use the financial institution's posting or clearing date
  when both transaction and posting dates are shown, retain the transaction
  date in the original evidence and the bank-line `reference` or `note`, and
  never use the statement period-end or closing date
- `application_date`: when a receipt or payment is applied to AR or AP
- `action_date`: the accounting date for cancellation or void workflows on
  posted source documents

Posting rules:

- invoice: use the invoice issue date
- sales receipt: use the sale date
- customer refund: use the refund date
- invoice credit note or vendor credit: use the credit document's own date,
  not the parent invoice or bill date
- bill: use the supplier bill date
- expense: use the purchase date
- vendor refund: use the refund date
- receipt or payment: use the actual settlement date
- bank deposit: use the date the deposit hits the bank account
- bank fee, transfer, owner contribution, loan funding, loan repayment: use the
  evidence-supported transaction and posting dates under the payment method and
  book policy; do not use the statement period-end or closing date
- accrual or month-end adjustment: use the last day of the affected period
- opening balances: use one verified cutover date

If a closed period must change, stop and ask before proceeding.

## Prefer First-Class Workflows

Use:

- `items` for reusable products, services, and inventory defaults that should
  populate source-document lines consistently
- keep `item_id` on normal sales and purchase document lines whenever the
  activity is about a real tracked product or service, so the platform can
  apply the saved revenue, expense, inventory, COGS, and tax defaults
- `invoice` for customer sales on credit
- `sales-receipt` for customer sales paid immediately
- `customer-refund` for customer returns, cash refunds, and customer-balance
  refunds
- `receipt` then `receipt:apply` for customer cash collection
- `bill` for vendor purchases on credit
- `vendor-credit` for supplier credits, rebates kept on account, overbilled
  purchase corrections, and mixed bill-plus-over-credit situations that should
  stay on the vendor subledger until allocated to current or future bills
- `expense` for immediate payee outflows that should not leave AP open, such as
  vendor purchases, loan repayments, owner draws, and tax remittances
- `vendor-refund` for supplier cash refunds, card credits, and returned vendor
  advance balances that actually leave the supplier account and hit a funding
  account
- `payment` then `payment:apply` for vendor settlement
- `transfers` for bank, debit, cash, and credit-card statement-account
  movements between the business's own accounts
- `settlements` for platform, payment-processor, POS-summary, OTA, and other
  external payout events where gross activity, fees, refunds, taxes, reserves,
  adjustments, and net cash settle together; use `lines[]` when the statement
  has variable processor components instead of forcing every amount into the
  fixed gross/tax/fee/refund/reserve fields
- on invoices, bills, sales receipts, and expenses, use document
  `adjustments[]` for separate non-tax fee, levy, tip, rebate, or similar
  components instead of hiding them inside subtotal lines or tax setup
- on document-mode customer refunds and vendor refunds, use `adjustments[]`
  only for separate non-tax components that belong on the same refund document;
  balance-mode refunds stay on `refund_amount` plus `refund_account_id`
- choose the adjustment account explicitly: sales-side adjustments may post to
  revenue or liability accounts such as levy/remittance liabilities; purchase-
  side adjustments may post to the same business-account families allowed by
  the document workflow
- use `mode: percent` only when the source component is a real percentage of
  the tax-exclusive subtotal; otherwise use `mode: fixed`
- use `operator: subtract` for rebates, credits, and other non-tax reductions
  that belong on the same source document
- if a charge, rebate, or deposit has its own tax treatment, quantity, item,
  or partial-credit semantics, keep it as a normal document line instead of an
  adjustment
- `bank-deposits` when cash, undeposited funds, owner contributions, loan
  proceeds, direct income, customer-deposit holding balances, or similar
  non-statement source accounts are deposited into a bank statement account
- `payroll-runs` for payroll results that post wages, withholdings, employer
  tax, liabilities, and cash settlement
- `opening-balances` for cutover balances
- `bank-lines` plus `reconciliations` for bank, debit, and credit-card
  statement accounts
- `bank-lines/{lineId}:create-processor-settlement` only as a statement-line
  shortcut when the evidence is a payout that should still become a canonical
  `settlement`
- for Stripe, payment processor, marketplace, POS, or OTA payout evidence,
  choose the accounting depth before posting: never record only the net bank
  deposit as revenue; either post a summary settlement from the payout report,
  or post customer/order-level sales first and then settle them. Customer-level
  `sales-receipt` detail is required when the user needs customer history,
  order-level reporting, refund tracing, or invoice-like support. Summary
  settlement is acceptable for anonymous POS, restaurant, retail, marketplace,
  or Stripe batches when the external report is retained as evidence and
  Vibooks only needs gross sales, tax, refunds, reserves, fees, adjustments,
  and net payout at the batch level
- for Stripe, payment processor, marketplace, POS, or OTA evidence that
  identifies customer-level sales, create the customer sale first as a
  `sales-receipt` with `payment_account_id` set to the configured processor
  clearing account such as `Merchant Clearing`, then create a `settlement`
  for the payout. Prefer `settlement.lines[]`: gross/sales lines increase the
  payout and credit the same clearing account, fee/refund/reserve/custom
  deduction lines decrease the payout and debit their expense, refund, reserve,
  or clearing accounts. Link the settled sales with `sales_receipt_ids`, or
  put `sales_receipt_id` on the gross line when tracing one receipt to one
  processor component
- if discovery does not expose `SalesReceiptCreateRequest.payment_account_id`
  or settlement `sales_receipt_ids`, do not invent hidden fields or bypass the
  workflow with manual journals; use the supported legacy settlement-only
  summary workflow, attach the processor evidence, and tell the user that
  customer-level Sales Receipt reporting requires a newer Vibooks version
- manual journal entries only when no better workflow exists

Subledger integrity rules:

- invoices create receivables; receipts settle receivables through apply
  workflows
- sales receipts recognize revenue and debit the selected payment account
  immediately; for direct cash sales that account is bank or cash, and for
  processor-funded sales it is a clearing account that remains open until the
  payout settlement
- when a settlement links `sales_receipt_ids`, the settlement must clear the
  same processor payment account through gross/sales settlement lines; do not
  credit revenue again on the settlement
- customer refunds either reverse immediate-sale revenue/tax lines or return
  customer deposits and overpayments without creating new AR
- inventory item lines on customer refunds receive stock automatically and
  reverse the inventory versus COGS leg inside the same refund posting
- bills create payables; payments settle payables through apply workflows
- when goods arrive before the supplier bill, create a purchase receipt first,
  then create the later bill with `purchase_receipt_ids` so the bill clears the
  receipt accrual instead of receiving inventory a second time
- expenses recognize the immediate outflow and funding movement immediately and
  do not leave AP open; expense lines may debit expense, asset, liability, or
  equity accounts as long as they are real non-statement business accounts
- inventory item lines on invoices and sales receipts issue stock
  automatically and add the required COGS versus inventory support lines
- inventory item lines on bills and expenses receive stock automatically into
  inventory instead of requiring a separate inventory receipt or adjustment
- do not use purchase receipts for same-day billed purchases; use bills or
  expenses directly when the supplier tax document is already available
- vendor credits create payable-side supplier credit that stays available for
  current or future bill allocation until `vendor-credit:apply` uses it up
- vendor refunds either reverse purchase-side expense/asset and tax lines or
  return vendor advances or supplier cash back to the chosen funding account
  without creating new AP
- inventory item lines on vendor refunds issue stock automatically using the
  refund line value instead of requiring a separate inventory issue
- bank deposits debit the destination bank statement account and use signed
  source lines: positive lines credit non-statement sources such as
  undeposited funds, cash on hand, revenue, equity, loan liabilities, or
  customer-deposit holding balances; negative lines debit deductions such as
  merchant fees so the bank line stays at the net deposit
- do not replace receipt or payment application with ad hoc journal lines
  against AR or AP control accounts
- if a document or settlement uses a non-default control account, pass the
  explicit `ar_account_id` or `ap_account_id` at creation time and keep later
  apply, credit-note, and correction workflows on that same control account
- if a posted supplier credit needs structural or tax correction, use the
  first-class `vendor-credit` workflow: `:unapply` it first when any bill
  allocations exist, then `:replace` the vendor credit itself; do not reverse
  the parent bill entry, and do not rely on a generic journal reverse as the
  primary correction path
- if an upgraded book contains historical legacy bill credit-note entries,
  Vibooks migrates them into first-class `vendor-credit` records while keeping
  the original immutable journal rows for audit; all new supplier credits
  should use `vendor-credit` directly
- use `unapplied_account_id` for real customer deposits or vendor advances that
  should remain open outside the main receivable or payable balance
- do not record payroll through generic journal entries when the payroll
  workflow can express it
- for supported Canadian payroll, configure the employee's effective-dated
  payroll profile, schedule, statutory payroll items, jurisdiction, and verified
  YTD history before calculation; use the employee payroll-calculation preview
  instead of entering tax deductions as operator-calculated amounts
- before any Canadian payroll calculation preview, show the live request
  schema's unsupported special-tax-situation list to the operator. Send
  `unsupported_tax_situations_confirmed_absent: true` only after the operator
  confirms none applies; omission or `false` must stop the calculation. Review
  the returned `calculation.limitations` with the preview instead of discarding
  them
- when pay, schedule, province, or tax setup changes on a later date, append a
  successor employee payroll profile through the payroll-profile API. The
  server atomically closes the unique predecessor on the prior calendar day and
  keeps historical selection intact. Never overwrite the earlier profile or
  patch its dates directly; same-start, future, or ambiguous overlaps fail
  closed and require reviewing the retained profile timeline
- before an ordinary Canadian payroll post, read
  `/v1/books/{book_id}/payroll-rule-readiness`. Vibooks runs the same idempotent
  check automatically when Payroll opens and before calculation, batch creation,
  or posting. A headless client may POST that resource when it observes `pending`,
  but neither the operator nor the Agent certifies statutory rules. Use
  `calculation_state` and the actual server guard for calculation/posting
  eligibility. `pending` requires a fresh check; `blocked` requires reviewing
  the protected result or evidence that could not be replayed. A compatible
  checkpoint can produce `calculation_state: ready` while the legacy aggregate
  `status` remains `blocked`. Read `correction_state` and `remedy_status`
  separately; neither can be inferred from calculation eligibility. Do not choose an older
  revision, alter the posted payroll, or guess a replacement amount. Keep
  preview and correction planning available and follow the server's current
  correction target. Review actual-withholding matters through their retained
  correction detail; do not automatically reverse actual payments. Use the
  statutory reverse/replace workflow for other supported corrections, then
  refresh readiness before the next
  ordinary post. The legal interval is selected from the payroll pay date, not
  the activation date, current date, or date the user opens Vibooks
- for a retained actual-withholding correction matter, discover the live
  `payroll-rule-correction-roots` routes and schemas. Start from the task's
  `root_id`/`detail_url`, or from a current readiness observation candidate:
  retain the observation and open its stable matter using separate idempotency
  keys. A candidate does not establish that a checkpoint is legally eligible.
  Read the original actual payroll, statement and journal links, current facts,
  blockers and `allowed_actions`. Follow only those exact action targets and
  request schemas: record evidenced intent, project a plan, review actual versus
  comparison amounts and zero financial effects, approve the exact plan, then
  execute. Execution leaves calculation pending until a fresh update check;
  the correction remains unresolved and its remedy requires determination.
  Do not treat a checkpoint as a refund, employee balance, authority credit,
  remittance, amended slip or filing authorization. An unavailable installed
  rule package cannot be replaced with a prior or caller-selected rule.
- retain later claims, agreements, directions, refunds, offsets, credits,
  recoveries, payment conflicts or uncertain evidence through the matter's
  development action. Preserve unknown dates or money with a reason; never
  invent zero or infer an economic event from a source link. Use the current
  required fact revisions for every affected matter. Correct mistakes,
  subsequent changes and evidence-only additions through the explicit
  successor action, preserving the original history. Follow a server-offered
  revalidation intent through the same review stages when needed. After a
  stale conflict, reload current detail/history and preserve the operator's
  draft for review before a fresh submission. Follow every history cursor with
  unchanged filters; a first page is not the full audit history. On success,
  reload `detail_url` rather than treating an idempotent receipt as current
  permission or readiness.
- for any payroll that may include provincial or territorial overtime,
  statutory-holiday pay, reporting or call-in pay, minimum-wage top-ups,
  scheduling effects, exemptions, or similar special pay, follow the on-demand
  official-source and professional-review workflow in
  `jurisdictions/ca/smb.md`. Vibooks does not determine those rules. Use native
  payroll only when an existing supported payroll item preserves the confirmed
  payment's exact meaning. Otherwise complete payroll through a qualified
  external process and retain its detailed result through the discovered
  external-payroll workflow. Do not call retired PEI setup, work-fact,
  tip/opening, special preview, or statutory-correction endpoints, relabel an
  unsupported amount, or turn an unknown amount into zero
- use `/v1/books/{book_id}/tasks` as the shared Overview, Tasks, UI and Agent
  projection for open Payroll work. Preserve the complete versioned task ID,
  re-read its detail immediately before acting, and follow only the returned
  scope-aware action target. Never infer a correction from display copy or a
  cached member count. On `TASK_INSTANCE_CHANGED`, discard the stale task and
  review the replacement; on `TASK_VERIFICATION_REQUIRED`, complete the
  retained rule-impact check; when the task is no longer found, treat it as
  resolved. Count-only Payroll tasks are not dollar exposure
- for an ordinary Canadian pay period on a light- or standard-approval book,
  use the guided payroll batch workflow: choose one schedule and exact period
  dates, preview every selected employee, review the server-returned totals and
  posting defaults, create one draft batch, approve it, and post it atomically;
  keep the individual-run workflow for genuine one-employee exceptions rather
  than preparing a normal multi-employee period one run at a time
- send an explicit employee `calculation_mode`: use `profile_regular` for
  profile-derived salary or hourly pay with no item input,
  `itemized_regular` for a complete assigned regular earning set, and
  `profile_regular_with_items` for profile-derived salary or hourly pay plus
  assigned fixed deductions or employer contributions; never infer the mode
  from whether `payroll_items` happens to be present
- regular item calculations support only assigned `regular_salary`,
  `regular_hourly`, `overtime`, `fixed_pre_tax`, `fixed_post_tax`, and
  `fixed_employer` meanings. Do not turn a percentage, bonus, retroactive pay,
  vacation payout, accumulated overtime, commission, taxable benefit,
  vacation-taken line, reimbursement, inactive item, or unknown future type
  into a fixed dollar amount; use its dedicated supported workflow or stop
- generate one stable UUID `client_operation_id` and one stable idempotency key
  for a logical payroll-batch create. After an ambiguous response, read
  `/v1/books/{book_id}/payroll-batches/by-client-operation/{client_operation_id}`
  before retrying; reuse the same identifiers only for the exact unchanged
  request, and use stable action keys while reconciling approve or post results
- guided payroll batches are intentionally unavailable for books whose current
  `approval_level` is `strict`. Stop on
  `PAYROLL_BATCH_STRICT_APPROVAL_UNSUPPORTED`; do not create an arbitrary
  approval, claim another principal, or suggest weakening the book policy
- for Quebec employees, record the current-period Fonds de solidarité FTQ and
  Fondaction share-purchase withholdings on the payroll profile when they
  apply; preserve the combined prior-period amount in verified YTD history so
  current plus YTD never exceeds the official $5,000 annual limit. Vibooks
  records the full Q/Q1 amounts as employee deductions as well as applying the
  tax credit, so never repeat the same purchase in generic pre-tax or post-tax
  deductions and never combine Q/Q1 with the alternative 75% gross-
  remuneration-reduction method. Send explicit zero values outside Quebec so
  TP-1015.F factors `Q` and `Q1` are never inferred from a generic deduction
  line
- let Vibooks select the statutory release from the book country, employee
  jurisdiction, and pay date; never request an older release, extend a prior
  release, or substitute a draft rule when the preview reports that no
  officially verified published release covers the date
- treat missing payroll-rule coverage as an unsupported calculation boundary;
  retain the external provider calculation and source evidence when an external
  payroll workflow must be used instead of guessing statutory amounts
- carry the preview's calculation snapshot, published release ID, formula ID,
  official verification identity, and fingerprint unchanged into the payroll
  batch or run; the server-authenticated keyed snapshot fingerprint also binds the normalized component
  posting contract, so do not rename, remove, reclassify, or change a
  calculated component even when aggregate totals would remain unchanged;
  ordinary reviewed account selections remain separate, but never supply a
  liability override for the canonical Quebec FTQ or Fondaction components,
  whose dedicated payable accounts are assigned by the server; use the payroll
  reversal, replacement, or correction workflow
- every supported native Canadian payroll post must create its immutable pay
  statement in the same transaction. Select the employee and complete the
  pay-date-effective employer identity, employee payroll identity/code, and
  employee statement profile before posting. `/pay-statements/setup-readiness`
  is a current setup overview; it does not prove readiness for a different pay
  date or the exact payroll facts. Keep tax province separate from the explicit
  employment-standards jurisdiction and never infer federal coverage
- a successful generic calculation preview is calculation evidence, not proof
  that the payroll can be posted. An employee name alone cannot supply the
  employee identity needed for a native pay statement. Follow actionable
  missing-field errors, complete the employee and statement setup, and use a
  fresh preview when protected facts change. Never strip calculation evidence
  or switch to an external payroll variant to bypass native statement checks
- for every supported current period, submit exact typed
  `pay_statement_facts` to calculation preview. Saved hours are proposals only;
  confirm actual worked hours, hours paid/for which payment is made, salary
  hours only for salary profiles, and the permitted source kind. Do not send a
  caller-selected statement semantic: the versioned payroll item owns the
  earning meaning. Phase one ordinary periods require an
  explicit confirmation that there are no paid non-work hours
- carry the server-returned statement facts, calculation snapshot and
  fingerprint unchanged into individual or batch post. A missing/mismatched
  fact, unpublished pay-date rule, unsupported earning meaning or incomplete
  setup must stop before any payroll, journal or statement mutation
- reverse or replace Canadian payroll only with the complete retained
  employee/profile identity, calculation release/snapshot/fingerprint,
  pay-statement facts, detailed component arrays, cash account, date, and
  correction reason required by the typed request. For standard or strict
  approval, request `entry.reverse` approval for the exact request body and
  consume only an approved record whose `target_id` and `payload_hash` still
  match. If any date, fact, amount, account, or reason changes, request a new
  approval. Keep one stable idempotency key for the unchanged approval request
  and one for the unchanged final reverse or replacement until the outcome is
  known; after an ambiguous response, retry those exact identifiers instead of
  creating a second correction
- after posting, use the statement list/detail/payroll-run-link/render and
  batch-export APIs. Viewing, downloading, printing or creating a ZIP does not
  prove delivery. Record `paper_in_person` only after the real handoff, with the
  exact retained language artifact and strict factual timestamp. This event
  does not assert payment, timeliness or legal qualification. Correct a mistake
  only through the append-only provision-event preview/commit correction APIs
- Québec statement language is French unless an effective employee English
  request exists. UI language is irrelevant. Use shared English/French branded
  templates with the one protected statement-content slot; never hide or
  rewrite statutory content and never make province-specific appearance
  templates. A current request appends successor statements with retained
  English companions; when a future-dated request becomes effective, call
  `/employees/{employeeId}/pay-statement-language-companions:materialize`
  before rendering or handing off the English artifact
- prepare CRA or Revenu Québec remittances only from the exact effective
  authority account, installed remitter calendar, active payroll sources, and
  unchanged preview fingerprint. `prepared` is not paid. Complete the real
  authority payment outside Vibooks, then call `:recordPayment` with its actual
  date, confirmation reference, funding account, and unchanged remittance
  fingerprint. That action atomically records the external-payment fact and
  posts the cash-to-payroll-liability settlement; do not post a separate expense
  or journal for the same payment. For an overpayment, provide a real authority-
  credit asset account instead of driving the payroll liability below zero.
  A corrected confirmation uses `:correctReference` and does not rewrite the
  journal. Reverse or replace a mistaken recorded payment only through
  `:withdrawPayment` or `:replacePayment` so the original fact, reversal entry,
  and successor stay in the append-only history. Do not substitute an installed
  monthly or quarterly calendar for an unsupported accelerated, weekly, or
  twice-monthly obligation, and do not claim authority receipt from the Vibooks
  record alone
- review T4 data only through the discovered
  `/payroll-tax-forms/t4:preview` operation, using active immutable payroll,
  legal identity, opening YTD, and signed box-adjustment records. Correct boxes
  through `payroll-tax-form-adjustments` and its reversal action, not by editing
  payroll history. An omitted QPIP earnings box is not a zero correction basis:
  reconcile any signed box 56 adjustment to the retained eligible earnings.
  Resolve annual-limit and original-payment-order blockers using source records;
  do not replace missing chronology with the date an opening balance was entered.
  While the exact annual CRA form package is unavailable,
  there is no T4 artifact, PDF, download, print, or employee-copy workflow; do
  not call a removed preparation-artifact operation, construct a lookalike
  document, or reuse another tax year's form. A balanced preview is data review
  only and does not prove filing, acceptance, or distribution
- prepare an ROE data-review report only after creating the employee interruption event,
  its employment-period boundary, each applicable typed statutory-payment fact,
  and a complete statutory-input coverage review. Then create the discovered
  ROE preparation artifact and use its retained render for handoff to the person
  completing and validating the official record in ROE Web. Before attempting
  any payroll-extract file, read `payroll_extract_export` from the discovered ROE
  preparation options. If `customer_export_ready` is false, do not construct or
  claim a `.BLK` file; retain the non-official review report and complete the
  record in ROE Web. Never put the full SIN or payroll account number in ordinary
  API fields. If Block 19 special payments or another unsupported field applies,
  stop instead of approximating it. Only Service Canada supplies the official
  ROE PDF after issue. Optional external-completion evidence records only what
  the user says happened outside Vibooks; it is not a Service Canada receipt
- an ROE review-report correction creates a successor preparation artifact
  through the discovered successor operation, using the expected active
  head/fingerprint and a factual correction reason. Never overwrite the
  original report or its PDF. T4 data corrections instead use append-only box
  adjustments and their reversal action; no T4 artifact exists to replace while
  official PDF output is unavailable. A later verified form-definition revision
  or renderer release applies only to new output and remains independently
  identifiable from the payroll calculation release
- use RL-1 previews only for year-end preparation from active immutable payroll,
  legal identity, opening YTD, and signed box-adjustment records. Until its
  verified annual PDF package and government workflow are installed, do not
  claim the preview was filed, accepted, or distributed; follow the authority's
  external filing process
- for Canadian vacation pay, use the dedicated vacation resources for approved
  jurisdiction/class facts, service history, policy/arrangement, effective-dated
  accounts, opening, earning, period close, payment allocation, correction, and
  reporting; do not recreate vacation liability through generic payroll
  deductions or manual journals. Vacation post/reversal responses expose any
  pay-statement successor IDs; follow those immutable successors instead of
  continuing to use a superseded statement revision
- treat each source earning meaning and earned-date segment as protected input;
  unknown semantics, uncovered dates, incomplete service or coverage, and rule
  gaps fail closed instead of falling back to taxable wages or a prior release;
  `effective_date` must equal the source payroll pay date and every segment must
  remain inside that immutable payroll period
- when moving from Sage or another prior ledger, provide complete historical
  employee vacation detail decomposed into vacationable wages, statutory earned,
  contractual extra, statutory paid, contractual-extra paid, and owed by
  reference period; do not provide `rule_release_ids` because Vibooks selects the
  release. For NT, preserve evidenced provider-recorded earnings and payments;
  dated `nt_sources` inventory and attributions establish a separate current
  target, without replacing the imported balance. Other supported profiles
  validate statutory earned against their certified jurisdiction, service dates,
  wages, and cutover date. Split a row when a service-rate boundary
  requires dated detail; for a Québec protected-absence period, create the exact
  reviewed section-74 fact set first so the opening uses that official formula;
  positive employee openings must equal the source Vacation Pay Payable control
  total, and historical wages must never be inferred from a liability balance
- for pay-each earnings, bind the exact posted payroll vacation-pay component;
  for a later retained payout, bind the exact component that debits Vacation Pay
  Payable and use its immutable payroll pay date. A matching payroll total,
  caller-supplied date, or label is not sufficient, and a payout cannot consume
  a balance earned after that pay date
- after each retained accrual, true-up, payment, reversal, replacement, or
  control-account transfer, verify the employee vacation event balance equals
  the active Vacation Pay Payable balance and every reference period preserves
  `owed = recognized total - paid` with owed nonnegative. Recognized total is
  known statutory plus known contractual extra plus any explicitly recognized
  amount awaiting classification; that last amount is part of the total, not
  another liability or payment. Target credit never creates a second bucket or
  GL amount
- for NT, retain actual same-employer service spells and the complete reviewed
  interval through `service-facts`; do not supply a guessed count of service
  years. Keep the stable vacation profile when revising service evidence. Retain
  a genuine employer policy through `policies` only when it establishes a total
  vacation-benefit floor on the same ordinary wage base. Never invent a policy
  to make an uncertain calculation proceed or silently raise an old numeric rate
- NT earnings need actual amounts split at every applicable service, policy and
  rule boundary. An unresolved total cannot be posted. A genuine policy may
  establish the total while statutory/contractual classification remains
  unresolved; a null classification is not zero. Read `current_target` and
  `measurement_issues` separately from the immutable recognized/paid balances
- read the current `authenticated_writer_id` from the employee's `service-facts`
  or `policies` response and use that identity as `approved_by` for NT corrections.
  This does not grant write permission. If the authenticated connection or its
  permissions change, reload and create a fresh preview; never reuse another
  reviewer's preview or substitute a historical author or default identity
- use `reference-periods:correctionPreview` with the retained period and proposed
  date, then `post-correction` for an unchanged preview. Vibooks traces prior
  credit to the original dated rights, retains over-recognized amounts without
  automatic recovery, and adds only the supported shortfall. Do not net an
  excess on one dated right against another shortfall or treat rounded display
  shares as separate entitlements. Missing historical credit attribution may
  leave the current target known while blocking automatic correction
- a zero-amount NT classification correction creates no payment or new capacity.
  A positive correction creates only its additional payable capacity; a
  `recognized_total` bucket means a confirmed amount available for allocation,
  not an additional economic category or a statutory/contractual split of past
  payments. Use the ordinary payroll-backed payment workflow for a later payout
- financial reports and accountant exports preserve `measurement_status` and
  `measurement_issues`. A `qualified_draft` retains recorded ledger amounts but
  must not be presented as a fully measured vacation liability. This also applies
  to actual posted wages whose vacation obligation has not yet been recognized.
  For an explicit report date, later economic activity may prevent reconstruction;
  do not substitute today's correction or payment into the historical balance.
  Follow the identified employee and payroll source when no reference period exists.
- unresolved NT measurement or an unapplied required correction blocks the
  affected book-period close; an exact reconciled total with classification
  pending can still close. Review the current vacation Task and report rather
  than treating an already paid recorded amount as proof of final settlement
- vacation-payment allocation children are server-owned and use the documented
  oldest-due order; never submit caller-calculated children or account overrides
- every vacation post and reversal needs a new `request_id` plus the reviewed
  `approved_by` identity. Retry only the exact same request. After a reversal,
  create a fresh supported replacement preview with `replaces_calculation_id`
  so the report retains the original, reversal, approver, and replacement chain.
  For an NT target correction, instead reassess the current reference period
  through its correction preview; the retained source and correction history
  determines whether any additional amount remains
- if posting returns `VACATION_STRICT_APPROVAL_UNSUPPORTED`, stop and explain
  that vacation posting is unavailable while the book requires separate strict
  approvals. Do not change `approved_by`, retry, or recreate the result through
  a generic journal; ask the operator whether the book should use a supported
  light/standard approval mode
- source files and AI extraction do not directly import vacation transactions.
  Analyze and visually verify the evidence, propose explicit facts, then call
  the same first-class preview/post/correction endpoints used by every client
- keep vacation scope bookkeeping-only: do not represent PTO scheduling, leave
  approval, POS operation, or tip-pool allocation as Vibooks vacation features
- use a full database backup and restore when moving natively authenticated
  payroll history; a portable book bundle cannot prove the source payroll key
  and must not turn an embedded, self-consistent component contract into native
  posting, remittance, or year-end evidence; an older portable snapshot retained
  only under a public integrity hash is marked untrusted by the receiving
  installation and remains blocked from automatic YTD and all statutory use
  until a complete append-only `legacy_run_attestation` links the posted run to
  retained source records and supplies every applicable employee and employer amount;
  never overwrite either the retained snapshot or attestation for later changes
- before the first full backup, the owner must deliberately display the backup
  recovery code in the local desktop, save it outside the backup location, and
  confirm that separate copy. A backup from another or replacement installation
  must be previewed with that recovery code before restore. Agents must not call
  the reveal endpoint or pass a recovery code into backup preview/restore unless
  the user explicitly requests that local recovery operation. Never place a
  recovery code in chat, logs, filenames, bookkeeping evidence, or portable bundles
- when purchase-side tax is only partly claimable, keep the statutory
  `tax_code_id` on the purchase line and set `tax_claimable_ratio` between `0`
  and `1`; Vibooks will keep the non-claimable portion inside the business
  line and only carry the claimable portion into tax returns
- if a transaction is partially settled, keep the remaining open amount in the
  subledger instead of forcing full settlement
- use inventory adjustments only for stock counts, shrinkage, spoilage,
  reclassifications, opening stock corrections, or other true exceptions; do
  not split normal buy/sell activity into both a source document and a second
  manual inventory movement

Reimbursement and vendor-advance rule:

- for employee reimbursements, owner-paid expenses, or other AP items that
  should settle through a dedicated payable such as `Reimbursement Payable`,
  create the bill and payment with the same `ap_account_id`, then use
  `payment:apply` on that same payables control account
- when a bill was funded personally by an owner, shareholder, or other non-bank
  source, set `payment.funding_account` to the real balance-sheet funding
  account such as `Cash from owner` or `Shareholder Loan`
- if the payment exceeds the open bill and should remain as a vendor advance or
  prepayment, route the excess through `unapplied_account_id`

## Common Posting Patterns

- direct cash sale: prefer `sales-receipt`; economically it debits bank or
  cash and credits revenue
- processor-funded customer sale: prefer `sales-receipt` with
  `payment_account_id` set to processor clearing, then a linked `settlement`
  when the payout arrives; economically the receipt debits clearing and
  credits revenue, while the settlement debits bank and fees and credits
  clearing
- bank transfer or credit-card payment: prefer `transfers`; economically it
  debits the destination statement account and credits the source statement
  account
- bank deposit: prefer `bank-deposits`; economically it debits the destination
  bank statement account, credits positive source lines such as cash, tax
  receivable, clearing, revenue, equity, loan, or holding balances, and debits
  negative deduction lines such as merchant fees so the deposit matches the
  bank's net amount
- platform payout, merchant-processor remittance, OTA remittance, or other
  net settlement without customer-level sale evidence: prefer flexible
  `settlements` with `lines[]`; economically it ties gross activity, fees,
  refunds, reserves, taxes, custom adjustments, and net cash to one
  source-aware event
- summary-based restaurant or small-lodging close: use sales receipts,
  expenses, receipts or payments, and settlements plus dimensions such as
  store, channel, or property; do not model POS or PMS front-office activity
  inside Vibooks
- customer refund or deposit return: prefer `customer-refund`; economically it
  credits the funding account and debits revenue/tax reversal lines or a
  customer-balance liability
- owner contribution: debit bank or cash, credit equity
- owner draw: prefer `expense` for the withdrawal itself; debit drawings or
  equity and credit bank, card, or cash
- loan proceeds: debit bank, credit loan payable
- loan repayment: prefer `expense`; debit loan principal, debit interest
  expense if any, and credit bank for the full payment
- tax remittance: prefer `expense`; debit the tax liability being settled and
  credit bank or cash
- tax return preparation: prefer `tax-returns`; prepare a draft return for the
  filing period, review the summarized payable and recoverable rows, then file
  the return so Vibooks generates the settlement reclass entry through the
  chosen tax-settlement clearing account
- debit-card purchase: prefer `expense`; economically it debits expense,
  prepaid, inventory, fixed asset, liability settlement, or equity draw lines
  and credits bank
- credit-card purchase: prefer `expense`; economically it debits expense,
  prepaid, inventory, fixed asset, liability settlement, or equity draw lines
  and credits the specific card liability
- vendor refund or rebate: prefer `vendor-refund`; economically it debits the
  receiving bank/card account or another real refund destination such as vendor
  advances, and credits expense, inventory/asset, tax, or a vendor-balance
  account
- credit-card payment: debit the specific card liability; credit the paying
  bank account
- payroll run: use the payroll workflow so wages, employee withholdings,
  employer tax, payroll liabilities, and cash settlement stay grouped as one
  payroll posting

For credit cards, do not force card activity into a cash account just to use
the statement reconciliation workflow.

## Opening Balances

- use `post-v1-books-book-id-opening-balances`; obtain its current request
  schema through live discovery and describe before submitting
- load only asset, liability, and equity balances at cutover; this operation
  does not accept revenue or expense accounts
- the opening balance entry must tie to a verified prior balance sheet or
  opening trial balance
- creation immediately posts the opening balance entry; do not attempt a
  separate opening-balance post action
- read back the returned entry and verify its posted status, cutover dates,
  supporting evidence, and amounts against the source and ledger reports
