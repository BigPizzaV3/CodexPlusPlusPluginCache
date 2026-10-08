# Canada SMB Jurisdiction Profile

Profile id: `ca_smb`

Status: `skill_guided`

Scope: ordinary Canadian private-enterprise and small-business bookkeeping on
the current shipped Vibooks product. This profile is not a full handbook or tax
advice substitute.

## Contents

- Use this profile when
- Authority order
- Reporting-basis default
- Evidence sufficiency and statement rules
- Current-product routing
- Canadian payroll and vacation-pay bookkeeping
- Chart-of-accounts rules
- Tax control accounts and tax codes
- Accountant handoff package
- Suggested optional accounts
- Account numbering guidance
- Units of measure
- Do not do
- Future product mapping
- Reference points

## Use This Profile When

- the book or company `country` is Canada
- the source documents, tax registration, or user instructions clearly show the
  business keeps its books under Canadian business rules
- the business is an ordinary small business or private enterprise rather than
  a public issuer, pension plan, or specialized regulated reporting entity

Do not choose this profile merely because the operator is Canadian.

## Authority Order

Use these sources in order:

1. explicit Vibooks book or company setup already saved
2. real tax registrations and the actual operating province or territory
3. source documents and business profile details
4. explicit user instruction
5. current device country only as a last-resort bootstrap suggestion

If Canada is clear but the province or territory matters for tax setup and is
still unknown, stop and ask before creating province-specific tax codes.

## Reporting-Basis Default

Default to `ASPE` for ordinary Canadian private-enterprise books.

Use `IFRS` only when one of these is clearly true:

- the user explicitly requests IFRS
- the entity is publicly accountable or preparing IFRS financial statements
- a lender, investor, owner, or regulator explicitly requires IFRS

Stop and ask before proceeding if the book appears to be for:

- a not-for-profit organization that may need Part III guidance
- a pension plan
- a publicly accountable enterprise
- a specialized sector with external reporting requirements outside ordinary
  small-business bookkeeping

## Evidence Sufficiency And Statement Rules

For ordinary Canadian small-business books, treat bank and card statements as
source records that support observable account movement and reconciliation.
Keep them with the book, but do not treat a statement or cancelled cheque as
blanket proof of the underlying business expense, income source, accounting
classification, or GST/HST treatment.

Rules:

- for ordinary business income and expense support, retain the available sales
  invoice, purchase invoice, receipt, agreement, contract, deposit slip,
  cancelled cheque, or other voucher that establishes the source and nature of
  the transaction; a bank statement may be one part of that evidence bundle
- if a supplier did not provide a receipt, do not invent one; obtain and record
  the supplier name and address, amount, payment date, and transaction details
  in the expense record or journal as permitted by current CRA guidance, and
  keep the missing-document limitation visible for review
- for a GST/HST input tax credit, mark `tax_documentation_supported` as `pass`
  only when the available invoice, receipt, agreement, or other prescribed
  documentation contains the information required for the claim
- an ordinary monthly credit-card statement that lacks the prescribed supplier
  and tax information is not sufficient documentary evidence for a GST/HST
  input tax credit; require a supporting receipt, invoice, or other qualifying
  documentation before treating the claim as supported
- do not apply that ordinary-statement rule to a documented exception merely by
  analogy: if the registrant relies on the CRA procurement-card policy or
  another documentary exemption, confirm and retain the current authorization,
  required controls, qualifying transaction scope, and issuer-report fields
  before treating the exception as supported
- an owner or accountant explanation may help classify a transaction, but it
  does not replace the documentary information required for a GST/HST claim
- for cash-basis reporting where it is actually applicable, statement evidence
  may support when an amount was paid or received; for ASPE or another
  accrual-basis book, use the underlying supply, invoice, service, or delivery
  evidence for recognition and cutoff instead of substituting the bank date

If the source supports payment but not business nature, recognition date, or
GST/HST entitlement, keep those checks `warning`, `fail`, `needs_user`, or
`unknown` as appropriate rather than passing the item from statement evidence
alone.

## Current-Product Routing

On the current shipped product, use the official jurisdiction-profile path for
Canada first, then keep the remaining chart and workflow choices conservative.
Use this routing:

1. create the company with `country = CA`; when known, also save the true
   province or territory and `commodity_tax_registration_status` there so new
   books inherit the same defaults
2. set or confirm `jurisdiction_profile_id = ca_smb`, the true province or
   territory, and `commodity_tax_registration_status` through the product
   create/apply flow when those facts are known and the operator explicitly
   wants the Canada profile applied
3. set the true operating currency, usually `CAD`
4. apply the nearest official Vibooks industry preset when one matches the
   business
5. review the chart of accounts and add only the Canadian statutory or common
   balances the book truly needs
6. configure tax codes only when the business is actually registered or the
   user explicitly wants tax-coded bookkeeping

Current official product path:

- set the fields at book creation when they are already known
- otherwise call `post-v1-books-book-id-jurisdiction-profile-apply`

Do not claim that Vibooks has a built-in CRA filing integration or a complete
Canadian chart package unless the shipped product actually exposes one.

## Canadian Payroll And Vacation-Pay Bookkeeping

Native Payroll requires the exact Canadian native module, an unused purchased
Canadian Payroll place explicitly enabled for the local Canadian Company, and
current statutory readiness. Check the live entitlement and allocation state
before calculation or posting. A standard bookkeeping subscription authorizes
recording results supplied by an accountant or external payroll provider; it
does not authorize Vibooks payroll calculation or employee pay-statement
generation. Never consume a Payroll place without the owner's explicit
selection. Once enabled, that place is fixed for the paid period; Company
archive or deletion does not release it.

If restore reconciliation reports more current-period Canadian Payroll
allocations than the signed limit, do not calculate a new payroll result or try
to clear or move an allocation. Follow the discovered billing recovery action:
increase the paid current-period quantity, resolve billing first when required,
or wait for/reactivate into a new paid period. Retained source-bound native
history may still use only the narrow correction rules below.

Historical corrections without a current Payroll place are limited to the
original posted source and its retained, verified authorization. They still
require an active base company and the official correction workflow. Do not
backdate a new payroll run, add a new employee to an amendment, or change the
original pay-date period to obtain historical access. If retained evidence or
whole-plan validation is missing, stop before reversal; never manufacture proof
or leave a partial correction. For a retained-source native preview, resolve
the live request schema and provide `correction_source_id` for the original
posted record. This does not authorize a new posting: keep the same employee,
economic event and pay-date period, and use the official correction operation.
Older records without verified retained authorization require a current Payroll
place. Current statutory readiness remains required.

For supported Canadian payroll dates, treat statutory payroll and vacation pay
as effective-dated, server-selected bookkeeping workflows. Never extend a prior
rule release because the next interval appears unchanged. If Vibooks reports a
missing official release, unresolved coverage, incomplete service history, an
unsupported employee class, or an unknown earning meaning, stop rather than
guessing.

Canadian pay statements are part of the posted payroll record, not a separate
document-import or POS workflow. Before activation, use setup readiness to
confirm one pay-date-effective employer payroll identity, each employee's sole
payroll identity and employee code, and an explicit employment-standards
jurisdiction. Tax province and employment-standards jurisdiction are separate;
never infer federal coverage from the business industry or tax province.

For actual-withholding correction matters, follow the live correction detail
and the payroll posting workflow at skill-root path
`references/workflows/posting.md`.
Retained actual amounts, calculation eligibility and unresolved legal remedies
are separate. A checkpoint never creates a refund, credit or amended filing;
later facts remain in immutable history and may require revalidation. Keep
unknown facts explicit and stop when the server reports unavailable rules or
missing evidence.

For an ordinary supported pay period:

1. read `/v1/books/{book_id}/payroll-rule-readiness`; Vibooks runs this check
   automatically when Payroll opens and before calculation, batch creation, or
   posting. If a headless workflow observes `pending`, POST the same resource to
   run the system-owned check; this is not a request for the user or Agent to
   certify statutory rules. Follow `calculation_state` and the server's posting
   guard: `pending` requires a fresh check and `blocked` requires reviewing the
   server's current correction target. The legacy aggregate `status` may remain
   `blocked` while `calculation_state` is `ready`; that does not resolve the
   correction matter or its legal remedy. A retained actual-withholding matter is
   reviewed through its correction detail, not automatically reversed. Other
   supported corrections use the statutory reverse/replace workflow. Run the
   check again after correction. Never ask Vibooks to use an older revision. Posted
   payroll keeps the exact revision originally used, while the payroll pay date
   selects the applicable legal interval regardless of the current or activation date
2. create the employer identity and employee statement profile through their
   first-class APIs and confirm setup readiness before posting; Vibooks
   automatically activates mandatory statement generation with the first
   supported native payroll post, and incomplete setup must fail that post
   atomically rather than leave a posted payroll without a statement. A generic
   calculation preview does not establish posting readiness: select the
   employee and complete the identities and statement setup for the actual pay
   date. The current setup overview cannot certify another pay date. Follow
   missing-field errors without removing native calculation evidence
3. treat a saved default-hours value only as a proposal; confirm the exact
   current-period paid, worked and payment hours from a timesheet, employer
   record, employee record or explicit operator confirmation
4. pass the typed `pay_statement_facts` through calculation preview and carry
   the server-returned draft and fingerprint unchanged into run or batch post
   (`salary_hours_worked` is supplied only for a salary profile; earning meaning
   always comes from the server's versioned payroll item and is never caller-set)
5. after post, read the statement through its payroll-run link or list API;
   render the retained PDF/HTML or export the batch ZIP without marking it as
   delivered
6. for every supported Canadian jurisdiction, read the statement's
   server-derived `paper_handoff` projection before acting; `not_recorded` means
   only that no current paper-delivery fact exists and never means the cash wage
   is unpaid
7. record `paper_in_person` only after the real paper handoff, binding the exact
   retained language artifact and a handoff timestamp no later than server time;
   optionally retain an employee-acknowledgement reference, source reference and
   note, but do not infer payment, timeliness, compliance qualification or
   recipient confirmation from any of them
8. correct a mistaken current handoff through preview/commit correction so the
   original fact remains and a void or replacement successor is appended; an
   active handoff or replacement may be replaced or withdrawn, while an active
   withdrawal may only be restored with replacement facts and imported legacy
   history is read-only
9. after any handoff write, re-read list, detail and owning-run views and require
   their `paper_handoff` status, active count, last handoff and correction-history
   flag to agree
10. use payroll reversal/replacement for payroll corrections; send the complete
   current statement facts and calculation fingerprint, and never edit a
   statement or regenerate historical content from current templates or rules

Treat Payroll work surfaced by `/v1/books/{book_id}/tasks` as a versioned
server projection, not as a durable client-side checklist. Payroll task IDs
contain an opaque instance token; preserve the complete ID, re-read
`/v1/books/{book_id}/tasks/{task_id}` immediately before acting, and follow only
the returned `actions[].target` for Review, Fix, or Correct payroll. Do not
construct an action from the task title, family name, or a cached count. A
`missing_scopes` action must remain unavailable. If the detail read returns
`TASK_INSTANCE_CHANGED`, discard the old ID and present the current task; if it
returns `TASK_VERIFICATION_REQUIRED`, run or complete the retained rule-impact
check before continuing; if the task is no longer found, treat it as resolved
rather than recreating it. These tasks report affected-item counts and must
never be converted into invented monetary exposure.

Provincial and territorial special-pay rules are outside Vibooks' automatic
calculation boundary. This includes overtime applicability, statutory-holiday
eligibility and formulas, reporting or call-in pay, minimum-wage top-ups,
scheduling rules, exemptions, and similar employment-standards questions. Do
not call the retired employment-standard setup, work-fact, tip/opening, preview,
or statutory-correction endpoints. If asked to have Vibooks determine one of
these rules, stop that automation path and explain that the amount must be
established externally.

When a payroll may contain special pay:

1. establish whether federal or provincial/territorial employment standards
   govern the work. Start with the Government of Canada's federal-jurisdiction
   and provincial/territorial directory at
   <https://www.canada.ca/en/services/jobs/workplace/federally-regulated-industries.html>;
   do not infer jurisdiction from UI language, residence, or payroll province
2. use the responsible government's legislation, regulations, orders, gazettes,
   and current employment-standards guidance for the actual work date. A search
   result, competitor example, blog, or prior-period worksheet is not authority
3. retain the source URL or publication, retrieval date, effective date,
   employee classification and exemption facts, time and holiday facts,
   formula, rounding, calculation worksheet, and unresolved assumptions
4. an agent may prepare the worksheet, but must not decide disputed legal
   coverage or post the result until the user, payroll professional, or legal
   adviser confirms the applicable rule and amount. Retain who confirmed it and
   the confirmation reference
5. use native payroll only when an existing supported effective-dated payroll
   item preserves the confirmed payment's exact legal and tax meaning; for
   example, use the supported `overtime` item with confirmed hours and rate when
   that is exact. Never relabel an amount merely to make it taxable or bypass an
   unsupported calculation
6. if no existing supported item is exact, do not use native payroll for that
   run. Complete it through a qualified external payroll process, then retain
   the detailed external result through Vibooks' discovered external-payroll
   workflow and preserve the authority, worksheet, review, and provider evidence
7. preview ordinary native payroll only after all applicable amounts are present
   in exact supported items. Vibooks then applies the selected CRA or Revenu
   Québec source-deduction release, posts the accounting, and produces the pay
   statement; PDOC, T4032, WebRAS, and deduction tables do not determine the
   underlying special-pay entitlement

Keep the workpaper and authority evidence attached or referenced with the
payroll support. If jurisdiction, employee class, exemption, effective rule,
formula, tax treatment, or amount remains uncertain, do not guess or enter zero;
leave payroll unposted and escalate for qualified review.

Québec statements default to French. Select English only when an effective
employee request has been retained. The desktop/UI language never chooses the
formal statement language. Vibooks may brand the shared English or French
template, while jurisdiction-specific protected content remains owned by the
effective rule package; do not create one appearance template per province.
When a request is recorded after payroll was posted, use the returned statement
successor IDs. If a future-dated request has since become effective, call the
employee language-companion materialization endpoint before rendering English;
the prior French revision and bytes remain retained.

If Vibooks returns `PAY_STATEMENT_RULE_NOT_PUBLISHED`, missing confirmed facts,
an unsupported earning meaning or incomplete setup, do not post the payroll or
create a manual stub. Retain the evidence, correct setup or use an external
payroll workflow until an exact verified rule interval exists.

### Payroll Remittances And Year-End Preparation

Treat payroll remittances, T4 previews, and RL-1 previews as preparation and
evidence workflows. They do not file a return, transmit a slip, distribute a
slip, or initiate a government payment.

When the connected API exposes an authority account's `ledger-origins`, use it
only to retain documentary ownership of an external payroll credit that is
already posted. Require the original journal and attached register, the complete
worker/payment/component decomposition, and both original CAD and book-currency
amounts. Registration must not post the wages or bank movement again. Do not
infer documentary source amounts from an account balance.

Read the discovered request contract. Supply explicit `origin_id: null` and
`expected_current_generation: null` for the first generation. A supported
evidence correction names the existing origin and exact current generation,
retains its correction reason and uses a new request ID. Retry the same operation
with its original `Idempotency-Key`, request ID, payload and authenticated
connection; do not turn a lost response into a second registration. Read current
detail and all history pages after correction or source reversal. A retained
historical receipt is not a current readiness result.

Source registration alone does not establish payment, declaration, or available
settlement capacity. In particular, `historical_payment_status: not_established`
is not zero paid, and `available_for_settlement: null` is not an amount available
to spend. Follow only a separately supported settlement workflow with its own
current proof; do not override `settlement_ready: false` or a rule-certification
blocker with manual totals.

For employer insurance, combined authority payments or payments between books,
read skill-root path `references/workflows/employer-insurance.md`. Use only
operations exposed and permitted by the connected API; an unavailable Québec
rule package remains a blocker even when documentary sources are retained.

For a supported remittance period:

1. require the pay-date-effective CRA or Revenu Québec authority account and
   its exact remitter type; do not infer frequency from payroll frequency or
   the size of the current payment
2. preview the exact installed official period and review its authority,
   period dates, due date, included active payroll sources, liability total,
   blockers, and fingerprint; if the assigned accelerated, weekly, or
   twice-monthly calendar is not installed, stop instead of substituting a
   monthly or quarterly period
3. create the prepared remittance from the unchanged preview; `prepared` means
   an amount and evidence package are ready for review, not that money was sent
4. preview or download the retained remittance evidence when the owner needs the
   exact amount breakdown and source-payroll support; preview, download and print
   must use the same retained PDF bytes and do not mark the remittance paid
5. make the real authority payment outside Vibooks, then call `:recordPayment`
   once with the actual date, authority confirmation reference, funding account,
   and unchanged remittance fingerprint. Vibooks atomically appends the payment
   fact and posts the cash-to-payroll-liability journal, so do not create a
   separate expense or manual journal for the same payment. If the payment is
   greater than the remaining obligation, use the real authority-credit asset
   account returned or selected for the excess instead of making the liability
   negative
6. re-read the remittance detail and require the active payment, confirmation
   reference, journal link, paid amount, remaining amount, and any authority
   credit to agree. Then confirm receipt or allocation independently in the CRA
   or Revenu Québec account; Vibooks records the owner's evidence but does not
   attest that the authority received or applied the funds
7. fix only the mistaken field: use `:correctReference` for a confirmation-only
   error without changing the journal; use `:withdrawPayment` to append the
   payment and journal reversal; use `:replacePayment` to reverse the old payment
   and atomically record its corrected successor. Carry the current snapshot
   fingerprint and any required exact reversal approval. After an ambiguous
   response, re-read the record before retrying and reuse identifiers only for
   the exact unchanged action
8. cancel only a mistaken prepared record that has no payment. Never delete or
   cancel a paid record to rewrite history; require the payment, reference,
   settlement and revision histories to retain every predecessor and successor

For year-end preparation, use
`/v1/books/{book_id}/payroll-tax-forms/t4:preview` for all included employees
and also use `/v1/books/{book_id}/payroll-tax-forms/rl1:preview` for Québec
employees. Require the previews to aggregate active immutable payroll history,
effective legal identities, verified opening YTD facts, and signed box
adjustments without blockers. Correct a box only through the employee's
first-class `payroll-tax-form-adjustments` resource and reverse an incorrect
adjustment through its reversal action; never rewrite a posted payroll snapshot
or YTD history to force a slip total.

The exact 2026 CRA T4 form package and the verified RL-1 filing package are not
installed. T4 is therefore on-screen data review only: do not create, download,
print, or synthesize a T4 PDF, and never fall back to another tax year's form.
Do not describe either preview as filed, provide it as a government-accepted
form, or mark the year complete merely because its totals balance. Export or
file externally using the authority's accepted process until Vibooks publishes
a separately verified filing workflow, then retain the external filing and
distribution evidence required by that workflow.

For ROE, use the discovered preparation options and retained non-official review
report. Attempt a Payroll Extract `.BLK` only when the live contract explicitly
returns `customer_export_ready: true`; otherwise complete the record in ROE Web.
Even when enabled, the file is a draft `Issue=D`, not an issued ROE. Never place
the full SIN or CRA payroll account number in HTTP API fields, CLI arguments,
agent prompts, logs, or screenshots. Service Canada alone supplies the official
PDF after issue.

Vacation pay is a general employee-liability capability, not a restaurant or
POS feature. Use it for any supported employer that must track money earned,
paid, and still owed to an employee:

1. propose the employee's jurisdiction, general-class status, service start,
   reference year, and policy mode from reviewed business evidence; ask the
   operator to confirm uncertain facts instead of making a legal-coverage claim
2. configure effective-dated Vacation Pay Expense and `Vacation Pay Payable`
   accounts, then create the effective employee policy; BC/ON pay-each policies
   also require the written or electronic agreement record
3. for a Sage or other cutover, analyze employee detail into explicit statutory
   earned, contractual extra, paid, owed, vacationable-wage, and reference-period
   facts; never propose a rule-release ID because Vibooks selects it from the
   employee jurisdiction and cutover date and recalculates the statutory amount;
   for Québec protected-absence history, record the reviewed exact-period
   absence fact set before preview so opening uses the section-74 formula;
   split history at a service-rate boundary when Vibooks asks for dated detail;
   the sum of positive openings must tie to the source control balance, while a
   fully paid pay-each history uses the zero-control history disposition
4. ordinary Canadian payroll previews each
   vacation earning from exact posted payroll components and dated earning
   semantics inside that payroll run's immutable pay period, using its exact pay
   date, then post only the returned calculation ID; retained mode posts expense/
   payable, while pay-each must bind the exact vacation-pay component already
   present in the posted payroll run
5. settle retained vacation only through the vacation-payment workflow, binding
   the exact payroll component that debits `Vacation Pay Payable`; use the source
   payroll run's pay date and never backdate it or allocate a later-earned balance;
   Vibooks owns the oldest-due employee allocation
6. close reference periods so the official whole-period target and any true-up
   are preserved with the exact published rule release, then use the report to
   prove employee owed equals the Vacation Pay Payable general-ledger balance
7. correct history through the owning vacation calculation's reversal using a
   fresh request ID and reviewed approver, then create a new preview with
   `replaces_calculation_id` and post it with another fresh request ID; never
   edit a posted vacation event, allocation, or journal

For Alberta monthly vacation source facts exposed by the connected API, first
read the current compensation and employment history using the employee's
`vacation-pay/compensation-facts` and `vacation-pay/entitlement-facts` routes.
Use live discovery for the complete request schemas and allowed operations.
Follow `next_cursor` until `has_more` is false; a partial page is not the full
source history. Read access requires `read`; recording facts requires
`draft_write` and the effective payroll module.

A compensation source requires `request_id`, `expected_revision_id` and typed
`facts`. Send explicit null only for the first revision; otherwise name the
highest numbered revision in the complete returned history; page order is not
revision order. To correct an earlier source, also
name its current `supersedes_id` and give `correction_reason`. Employment history
requires `request_id`, an explicit `supersedes_id` (null on first creation),
`reviewed_from`, `reviewed_through` and the complete typed facts. A replacement
names the active prior history and gives a correction reason. Keep original
source references and distinguish a real later compensation change from a
transcription correction. If history changed, read and review the current
sources before preparing a new request.

Reuse the same authenticated connection, request ID and facts only to retry
the same operation. The recorded author comes from that connection; request
headers cannot assign the operation to another person. Retaining source facts
creates neither a vacation payment nor a wage or bank journal. Verify the
result and retain its returned revision. A retry reproduces the original
creation result, so its employment-history status can describe an older active
version. Read the current active employment history and latest compensation
revision again before the subsequent supported opening workflow.

For current Alberta monthly obligations exposed by the connected API, use the
employee's `vacation-pay/valuations:preview` workflow before posting a sourced
reassessment. Read the current active employment fact, latest compensation
revision and every active owning obligation version from the live facts and
vacation report. Send the complete `expected_obligation_versions`, those fact
IDs, `assessment_date`, `source_reference`, `purpose`, `actual_episodes` and
`proposed_payment_allocations` required by the live request contract. For a
`reporting_estimate`, use an empty actual-episode array and empty payment map.
Do not supply an assessed total or replace missing source history with a
percentage estimate.

For `vacation_taken`, retain the actual dated work-day portions, evidence and
any required shorter-period agreement. Name each owning obligation and a
distinct source ID. An explicit correction identifies `replaces_source_ids`,
or uses `retired_episode_sources` for incorrectly recorded use; it does not
silently edit an older final amount. Both retained active use and new actual
portions must occur on or before `assessment_date`. A request before any such
portion, including one crossing the cutoff, is rejected; this current-state
workflow is not a retrospective report that can move future leave into an
earlier period. Equal-cutoff and later assessments preserve the original final
use evidence and amounts. Correct the source through its supported workflow
instead of changing dates merely to bypass the refusal.

Review every returned owner measurement, the complete original/common
comparison and any terminal residual. Verify statutory and contractual-extra
amounts separately from their actual owning payments. A preview records a
calculation without changing payable balances, actual use claims or cash.
Post the reviewed calculation with its live `post-valuation` operation and a
`request_id`, using the same authenticated connection. The product rechecks
sources, versions, actual use, payment history and fiscal locks in the posting
transaction. Retry the identical operation with the same ID only for its
original receipt. If a source changes or the preview becomes stale, read the
current facts and prepare a new preview; do not force the old calculation to
post.

A posted reassessment records only the provision difference. A null journal
ID can be correct when the net difference is zero but individual owners need
opposite adjustments. Neither a reassessment nor an `advance_payment`
assessment records a new cash payment, creates a payroll run or proves that a
planned vacation was taken. Use the separately supported owning payroll and
payment workflows for actual settlement. To undo a posted reassessment, use
its authorized calculation `reverse` operation with the required reason,
date and approval. It preserves outside payments and historical source
records. Changed downstream owners, actual use or payment history can block
reversal even when the displayed balance has returned to its earlier value;
resolve those dependencies rather than deleting or rewriting the history.

For a newly recognized or previously reversed terminated monthly spell, use
`new_termination_sources` with its actual `spell_started_on` and complete
ordinary `wage_history`. Include the current version of a reversed owner;
do not invent another obligation to recover recognition. Corrections to an
active terminal owner use its `termination_wage_histories` entry. Keep annual
and terminal owners separate, including when due on the same date, and review
the complete spell comparison before posting.

For an advance, use an `advance_payment` assessment on the actual payroll pay
date and explicitly allocate the intended gross amount to its owners. A
proposed vacation schedule is not evidence of actual use. Preserve an advance
when leave is postponed or cancelled; later actual leave is valued using its
applicable normal wages, with the existing payment credited once. Zero payable
does not establish that untaken leave is final or settled. A later increase
adjusts the liability only. A paid excess requires separate review, not an
automatic employee receivable or refund.

Prepare the actual native payroll through the supported calculation and post
its sealed draft. Retain its exact posted vacation earning component, pay
date, statement and journal. For the vacation payment preview, supply
`monthly_assessment_calculation_id`, `payroll_run_id` and
`vacation_pay_component_id` from the reviewed current workflow. A selected
terminal owner requires its complete spell wage evidence; an annual owner's
payment must not invent terminal evidence. If facts or owning balances have
changed, preserve the actual payroll and reassess the vacation rights before
linking it. Do not recreate payroll to bypass a stale assessment.

Post the stored payment preview using the same request identity for an
identical retry. Linking the gross vacation component records no second cash
movement. Keep that allocation separate from payroll deductions and net bank
payment. A correction must follow the owning payroll, bank-match and vacation
link dependencies and required approvals. Preserve the original receipt and
use a newly reviewed assessment for any replacement payroll.

The connected desktop monthly workflow can record compensation and employment
facts, prepare and post assessments, and review their reversal. Complex
historical opening reconciliation remains an agent/API preparation workflow.
Review the opening date, source-owned periods, actual paid allocations, unpaid
amounts and evidence in the opening view before recording the prepared
calculation. Distinguish retaining historical facts, linking an existing
payable and recording an opening liability. None records a new bank payment.
Do not substitute the percentage-wage opening form for monthly source facts.

For Alberta monthly opening calculations exposed by the connected API, obtain
the current request contract through discovery. Each historical payment in
`monthly_sources.actual_payments` needs its original `payment_id`, `paid_on`,
complete `gross_amount`, the `allocated_amount` belonging to that reference
period, and `source_reference`. Do not invent another payment identity for a
second allocation. One actual 500.00 payment can fund 250.00 in each of two
periods; it cannot fund 500.00 in each. Leave unallocated gross and an older
period's paid excess separate from other periods' unpaid amounts. A zero
allocation retains a known source without crediting the period; omitting the
required allocation field is not equivalent to zero. These historical facts do
not record another bank payment or create payroll wages.

For an ended Alberta monthly employment spell, retain the complete sourced
`termination_wage_history` required by the live opening contract. Its wage
slices have inclusive `earned_from` and exclusive `earned_to_exclusive` dates,
original component identities and reconciled component totals. Keep the
original-anniversary and common-anniversary wage windows separate; let the
product determine the statutory comparison and residual. Do not supply a
pooled wage or paid total as a substitute. Include the terminal obligation even
when its residual is zero or employment ended before the first annual award.
Use `history_only_zero_control` for a wholly zero opening; do not create a zero
journal. A monthly row's `vacationable_wages: null` means that scalar is not
applicable, not that the employee earned zero wages. Actual payments after the
termination date and before the opening date remain valid source facts, with
their existing owning allocation. Keep them distinct from recording new cash.

Reversing an opening journal reverses recognition, not the actual payment or its
attribution. Reuse the same retained attribution when reopening. To correct an
attribution, first reverse its owning opening recognition, then review the
report's `current_monthly_payment_history` for the employee. Submit
`payment_reconciliation` with all current `expected_obligation_versions`, a
reason and source reference; cover every prior owning period and retain every
actual source, including sources now allocated zero. Preview and post the
reviewed replacement using the live contract. If original evidence shows a
mistyped or duplicate payment identity, explicitly use the correction's
`source_replacements` mapping to its final canonical identity. A null target
retires an incorrectly recorded source; it does not record a refund. Do not
silently trim colliding IDs, drop a genuine payment or reuse a retired ID as new
capacity. Preserve evidence for the correction, including any reversal of an
earlier mistaken retirement. If the versions changed, refresh and review again. Resolve `VACATION_PAYMENT_SOURCE_RECONCILIATION_REQUIRED`
from the original evidence; never bypass it with new source IDs. An
`VACATION_OPENING_PAYMENT_SOURCE_OVERALLOCATED` result means the proposed
allocations exceed the actual source amount. Preserve the old operation's
replay and correction history instead of rewriting it. Use the capabilities exposed by the connected product version; a
prepared historical reconciliation does not imply a desktop editor for those
complex source inputs.

If a vacation post or reversal returns
`VACATION_STRICT_APPROVAL_UNSUPPORTED`, stop. The initial small-business
vacation workflow does not post while the book requires separate strict
approvals. Do not treat a free-text approver as authority and do not recreate
the vacation entry manually; ask whether the operator wants to use a supported
light/standard approval mode.

AI analysis of Sage reports, payroll registers, employment agreements, or other
source material produces proposed facts and first-class Vibooks calls; it is not
a file-import shortcut and must not bypass the same preview, approval,
reconciliation, and correction controls.

Keep the scope bookkeeping-first. Vibooks records vacation money and the
payable; it does not schedule PTO, approve leave, calculate a restaurant tip
pool, operate a POS, submit government filings, or replace professional legal
advice.

## Chart-Of-Accounts Rules

Rules:

- do not use CRA GIFI as the operating chart of accounts; treat GIFI as a
  mapping or reporting layer, not as the day-to-day ledger structure
- start from the official Vibooks generic or industry preset, then add Canada-
  specific balances only where the business facts require them
- preserve one real account per real bank account, card, loan, tax balance,
  and clearing balance
- prefer current shipped-product-compatible control-account roles over
  inventing local aliases that drift from Vibooks' account semantics

Common Canadian additions that may be appropriate when the business facts
require them include:

- sales tax payable or recoverable balances
- payroll deductions payable
- shareholder loan balances
- industry-specific deposits, gift-card liabilities, or deferred revenue

Do not create these just because they are common in Canada. Create them only
when the real book needs them.

## Tax Control Accounts And Tax Codes

On the current shipped product, keep the control-account roles stable even if a
future localized UI later changes the display labels.

Current shipped-product-compatible default roles:

- payable control account:
  - new-profile default name: `GST/HST Payable`
  - legacy-compatible reused name: `Sales Tax Payable`
  - `report_category`: `tax_payable`
- recoverable control account:
  - new-profile default name: `GST/HST Recoverable`
  - legacy-compatible reused name: `Sales Tax Receivable`
  - `report_category`: `tax_receivable`

Current product behavior for explicit `ca_smb` opt-in:

- `post-v1-books` can save `country`, `region`, `jurisdiction_profile_id`,
  and `commodity_tax_registration_status`, but it does not itself create the
  Canadian tax defaults
- actual tax-control-account and tax-code creation happens only when the
  operator explicitly runs `post-v1-books-book-id-jurisdiction-profile-apply`
- if Vibooks creates the tax control accounts for a new or empty book, it uses
  the localized Canadian names above
- if the book already has compatible generic `Sales Tax Payable` /
  `Sales Tax Receivable` accounts, Vibooks reuses them without forcing a rename

Preserve the account role first and do not force a cosmetic rename over a
correct existing control account.

Tax-code rules:

- create only the real statutory tax codes the book actually needs
- keep ordinary Canadian federal GST as `GST5` with the standard statutory
  name and rate when that is the real regime
- use the real participating-province HST code only when the business truly
  operates or files under that HST regime, for example `HST13`, `HST14`, or
  `HST15` depending on the province and the current CRA rate schedule
- before creating or revising HST codes, confirm the current CRA rate for the
  province instead of assuming an older rate schedule
- do not create synthetic near-duplicate codes such as `HST1501` merely to
  absorb rounding or partial recoverability
- for partial input-tax claimability, keep the statutory tax code and use the
  normal claimability controls on the document line instead of cloning tax code
  master data
- if the business is not yet registered, keep `tax_mode` conservative and do
  not create GST, HST, PST, or QST codes pre-emptively

Quebec, PST, and other province-specific commodity-tax setups can require extra
jurisdiction detail. Stop and ask before creating them when the obligation is
not explicit.

## Accountant Handoff Package

For Canadian books, the accountant handoff is a bookkeeping workpaper package,
not a CRA filing output.

Use `get-v1-books-book-id-accountant-handoff` for the review date range to
prepare the accountant-facing financial statements, trial balance, general
ledger, journal entries, A/R and A/P aging and open items, bank reconciliation
summary, GST/HST summary, evidence review, attachment manifest, and Canada
jurisdiction notes.

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

Do not claim that the package files a GST/HST return, T2, T1 business schedule,
payroll return, or other CRA filing.

## Suggested Optional Accounts

When the product applies `ca_smb`, it may also surface optional chart
recommendations instead of auto-creating them.

Common high-signal suggestions include:

- `2210 Payroll Deductions Payable`
- `2400 Shareholder Loan`

Treat these as operator-reviewed suggestions, not mandatory defaults. Create
them only when the real business facts require them.

## Account Numbering Guidance

Account numbering is recommended, not mandatory.

Use a stable Canadian-style numbering range when the book wants numbered
accounts, but do not renumber an existing clean chart solely to match a
template. A practical small-business default is:

- `1000-1999`: assets
- `2000-2999`: liabilities
- `3000-3999`: equity
- `4000-4999`: revenue
- `5000-5999`: cost of sales or direct costs
- `6000-7999`: operating expenses
- `8000-8999`: other income and other expense

Prefer stable numbers that match the current book structure over performative
re-numbering.

## Units Of Measure

Canada may require metric and non-metric units to coexist in practice. If the
book uses item quantities or inventory-style units:

- keep one base unit plus any related purchase, sales, or shipping units
- record the true unit used by the source documents and operations
- define explicit conversions instead of freehand mental conversion
- do not assume that every Canadian business uses metric-only units
- do not rename an existing base unit into a different physical unit once
  transactions rely on it; create a new unit set instead

## Do Not Do

- do not choose this profile from operator nationality alone
- do not treat CRA GIFI codes as the live operating account list
- do not mix jurisdiction rules into industry preset ids
- do not create province-specific tax codes without the actual province or
  territory context
- do not create cosmetic near-duplicate tax codes or control accounts
- do not imply that current shipped Vibooks automatically files Canadian tax
  returns unless the product actually exposes that first-class workflow

## Future Product Mapping

When Vibooks later ships deeper first-class Canada localization beyond the
current jurisdiction-profile routing, keep this profile id and prefer the
official product setup. The skill should then switch from manual guidance to:

1. choosing the official `ca_smb` or equivalent product-native setup
2. reusing the product's official Canadian chart and tax defaults
3. keeping this document as a safety and interpretation layer, not as the
   primary creator of Canadian master data

## Reference Points

- CRA IFRS and taxable-income guidance:
  [canada.ca IFRS](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/international-financial-reporting-standards-ifrs.html)
  and
  [CRA taxable income](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/international-financial-reporting-standards-ifrs/impact-ifrs-on-taxable-income.html)
- CRA GIFI reporting guidance:
  [CRA GIFI](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-income-tax-return/completing-your-corporation-income-tax-t2-return/general-index-financial-information-gifi/preparing-your-financial-statements-using-gifi.html)
- CRA GST/HST rates and place-of-supply rules:
  [CRA GST/HST rates](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-place-supply.html)
- CRA business-record and expense-documentation guidance:
  [CRA business records](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/business-records.html),
  [CRA business expenses](https://www.canada.ca/en/revenue-agency/services/tax/businesses/small-businesses-self-employed-income/business-income-tax-reporting/business-expenses/what-business-expenses.html),
  and
  [current Input Tax Credit Information (GST/HST) Regulations](https://laws-lois.justice.gc.ca/eng/regulations/SOR-91-45/section-3.html),
  [CRA input tax credits](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit.html),
  and
  [CRA procurement-card policy](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/notice199/procurement-cards-documentary-requirements-claiming-input-tax-credits.html)
- Canadian reporting-framework overview:
  [BDC IFRS and Canadian GAAP overview](https://www.bdc.ca/en/articles-tools/entrepreneur-toolkit/templates-business-guides/glossary/international-financial-reporting-standards)
  and
  [FRAS Canada consultation paper](https://www.frascanada.ca/-/media/frascanada/aspe/documents/acsb-cp-exploring-scalability-canada-2023.pdf)
- Canadian measurement-law basis:
  [Weights and Measures Act](https://laws-lois.justice.gc.ca/eng/acts/W-6/page-7.html)
- mainstream Canadian SMB software alignment:
  [QuickBooks Canada sales tax setup](https://quickbooks.intuit.com/learn-support/en-ca/help-article/sales-taxes/set-collect-sales-tax-quickbooks-online/L1Nu6wYj7_CA_en_CA)
  and
  [QuickBooks Canada account numbers](https://quickbooks.intuit.com/learn-support/en-ca/help-article/chart-accounts/use-account-numbers-chart-accounts-quickbooks/L7lRLN0Do_CA_en_CA)
