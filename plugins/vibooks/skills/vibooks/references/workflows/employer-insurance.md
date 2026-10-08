# Employer Insurance And Combined Remittance Evidence

Use this workflow only when the connected API exposes the relevant employer
insurance and settlement operations. Read live discovery, the complete current
request contract and the returned readiness first. A Québec payroll or
remittance certification refusal remains a stop: this guide does not enable a
blocked operation or authorize an estimated manual substitute.

These operations retain bookkeeping and evidence. They do not send money,
submit a declaration, or confirm receipt by CNESST or Revenu Québec.

## Contents

- First use
- Tasks and current review
- Public RQ preparation
- Payments between books
- Repeat use and corrections

## First Use

1. Select the actual employer, book, authority account, financial file and
   coverage year. Retain the authority's decision and its effective dates,
   supporting documents and the required employer facts. Do not infer an
   insurance jurisdiction from the payroll tax province or the UI language.
2. Retain the complete worker and provider coverage requested by the live
   contract. Use actual paid wage sources, their exact periods and the
   supported work classifications. Missing coverage, an unknown source or an
   unsupported earning meaning is not zero insured wages. Do not reuse annual
   or year-to-date totals as an arbitrary shorter-period source.
3. Review the server's calculation, source identities, currentness and
   accounting reconciliation. Keep provisional estimates, recognized
   assessments, notices, declarations and actual cash as separate facts.
   Calculation or recognition alone does not prove an authority payment.
4. Record an actual combined bank payment once, with its real bank evidence,
   date and reference. Use the owning workflow's explicit allocations for
   insurance, notice charges and payroll withholding. Leave any unallocated
   amount visible in its clearing position; do not create another bank entry
   simply because one transfer covers several obligations.
5. For the payroll-withholding portion, select the exact current native payroll
   or retained external source and the server's component reconciliation and
   allocation readiness. Original CAD amounts and book-currency carrying
   amounts must remain distinct. A shared payable account, a source journal
   link or a balanced total does not establish unused settlement capacity.
   Include previous payments only through their supported retained evidence.
6. Re-read the complete current context and all history pages. Match the actual
   payment, allocations, retained liabilities and linked journals. Resolve
   returned discrepancies through their owning correction workflow before
   describing the file as reconciled.

## Tasks And Current Review

Use the returned task's review target to open the exact book, authority account
and employer insurance context. Refresh the target and its current generation
before acting; a task is a review prompt, not a payment instruction or proof of
completion. If it changed or resolved, refresh Tasks and the employer file.

The seven task reasons identify different work:

- `source_review`: coverage or calculation is missing, or its source changed.
- `declaration`: a calculated period has no retained declaration; review and
  retain the actual declaration rather than implying it was submitted.
- `payable`: recognized premium or charges remain payable; review their actual
  allocations before recording any further cash.
- `unapplied_cash`: an existing payment has clearing capacity to allocate.
- `estimate`: a current cumulative calculation needs provisional recognition,
  subject to the returned readiness and existing assessment.
- `assessment`: a disputed assessment needs review and actual successor evidence.
- `reconciliation`: ledger or counterpart evidence is unresolved; resolve it
  before further settlement.

## Public RQ Preparation

When live discovery exposes the RQ owner preparation response, use the existing
insurance context. Bind the request to its `insurance_context_id`,
`expected_current_generation`, current `calculation_event_id`, authority account
and exact `period_start` / `period_end`. A calculation for another period, a
changed generation or an inactive authority account cannot substitute.

Handle `kind: rq_insurance_owner_preparation` as its own response. Review its
`preparation` and follow the returned `owner.context_url` and `owner.events_url`.
Use the existing owner's declaration, actual-payment and explicit RQ/insurance
allocation commands. This response does not create a legacy remittance record:
do not request a legacy preview fingerprint or create a second payment owner.
Reuse already recorded cash only through its current allocation readiness.

The installed Québec rules must be certified for the requested period. If the
API returns `PAYROLL_RQ_CNESST_NOT_CERTIFIED`, stop native RQ preparation and
retain only actual evidence through operations the connected API permits.
A complete context, a task or this guidance does not activate pending rules.

## Payments Between Books

When one book pays another book's liability, use the discovered interbook
instruction and each book's owning settlement operation. Review the exact
funding source, liability source, amount, date, currency and reciprocal
accounts. Complete the required approvals and period checks in each book.
A completed step in one book does not imply completion in the other.

Read the current instruction position after each step. Follow its returned
funding and liability sides and their actual journal links. Do not find a
counterpart by a matching amount, account, reference text or foreign instruction
ID alone. Retain each side's own book currency; do not reinterpret its carrying
amount as CAD or calculate a replacement exchange rate from the other side.

A later reimbursement is a separate actual bank transfer between the parties,
not another payment to the authority. Link the actual reimbursement entries
through the supported instruction workflow. Do not manufacture reimbursement
cash merely to make both sides show completion.

A copied or imported half can retain foreign identifiers while its counterpart
remains unresolved. Unconfirmed evidence is not proof that no entry exists.
Do not silently reconnect those identifiers to another book, recreate the
payment or mark the pair complete. Use the supported review or restore path
and retain the unresolved state until the server establishes current ownership.
The desktop's interbook panel can review status and actual entries; it does not
create the other book's settlement or reimbursement.

## Repeat Use And Corrections

Start from the current context, generation, effective payment and complete
history. A historical receipt or previously successful preview is not current
readiness. On a changed source or stale result, reload and prepare a fresh
supported action. Do not reuse a former completion after switching books,
financial files or instructions, or after a failed evidence refresh.

Use the discovered payment-recording correction for mistaken recorded bank
facts, and the allocation-recording correction for a mistaken allocation.
Retain the exact predecessor, current generation, reason, evidence and required
reversal approval. Withdrawing an allocation does not reverse the original
gross bank payment. Correcting evidence must not erase an actual earlier
refund, authority credit or employee remedy; those effects require their own
native evidence and correction paths.

After an uncertain response, inspect the owning current record. Retry only the
same supported operation with its unchanged request identity, payload and
credentials; a changed correction is a fresh operation. After success, refresh
both the effective position and history and inspect the linked journals.
Neither a theoretical tax difference nor a source association creates a refund,
a credit, another payment or an employee repayment.
