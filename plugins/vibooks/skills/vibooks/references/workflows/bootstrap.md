# Bootstrap Workflows

## Contents

- Discover the API first
- Jurisdiction profiles
- Bootstrap a new book
- Cleanly rebuild a book

## Discover The API First

Before mutating unfamiliar data, inspect the available operations:

```bash
vibooks-cli doctor --json
vibooks-cli ops --search invoice
vibooks-cli describe post-v1-books-book-id-invoices
vibooks-cli schema InvoiceCreateRequest
```

Useful operations include:

- `post-v1-companies`
- `post-v1-books`
- `post-v1-books-book-id-jurisdiction-profile-apply`
- `post-v1-books-book-id-replace`
- `post-v1-books-book-id-policies`
- `post-v1-books-book-id-fiscal-years`
- `get-v1-book-presets`
- `post-v1-books-book-id-presets-apply`
- `get-v1-books-book-id-periods`
- `post-v1-books-book-id-accounts`
- `post-v1-books-book-id-customers`
- `post-v1-books-book-id-vendors`
- `post-v1-books-book-id-items`
- `post-v1-books-book-id-attachments`
- `get-v1-books-book-id-attachments`
- `post-v1-books-book-id-opening-balances`
- `post-v1-books-book-id-invoices`
- `post-v1-books-book-id-invoices-invoice-id-add-attachments`
- `post-v1-books-book-id-invoices-invoice-id-remove-attachments`
- `post-v1-books-book-id-invoices-invoice-id-replace-tax-code`
- `post-v1-books-book-id-sales-receipts`
- `post-v1-books-book-id-sales-receipts-sales-receipt-id-add-attachments`
- `post-v1-books-book-id-sales-receipts-sales-receipt-id-remove-attachments`
- `post-v1-books-book-id-customer-refunds`
- `post-v1-books-book-id-customer-refunds-customer-refund-id-add-attachments`
- `post-v1-books-book-id-customer-refunds-customer-refund-id-remove-attachments`
- `post-v1-books-book-id-bills`
- `post-v1-books-book-id-bills-bill-id-add-attachments`
- `post-v1-books-book-id-bills-bill-id-remove-attachments`
- `post-v1-books-book-id-bills-bill-id-replace-tax-code`
- `post-v1-books-book-id-purchase-receipts`
- `post-v1-books-book-id-expenses`
- `post-v1-books-book-id-expenses-expense-id-add-attachments`
- `post-v1-books-book-id-expenses-expense-id-remove-attachments`
- `post-v1-books-book-id-vendor-refunds`
- `post-v1-books-book-id-vendor-refunds-vendor-refund-id-add-attachments`
- `post-v1-books-book-id-vendor-refunds-vendor-refund-id-remove-attachments`
- `post-v1-books-book-id-receipts`
- `post-v1-books-book-id-receipts-receipt-id-add-attachments`
- `post-v1-books-book-id-receipts-receipt-id-remove-attachments`
- `post-v1-books-book-id-receipts-receipt-id-apply`
- `post-v1-books-book-id-receipts-receipt-id-create-recognition-schedule`
- `post-v1-books-book-id-payments`
- `post-v1-books-book-id-payments-payment-id-add-attachments`
- `post-v1-books-book-id-payments-payment-id-remove-attachments`
- `post-v1-books-book-id-payments-payment-id-apply`
- `post-v1-books-book-id-payments-payment-id-create-recognition-schedule`
- `post-v1-books-book-id-entries`
- `post-v1-books-book-id-entries-entry-id-add-attachments`
- `post-v1-books-book-id-entries-entry-id-remove-attachments`
- `post-v1-books-book-id-recognition-schedules`
- `post-v1-books-book-id-recognition-schedules-schedule-id-cancel`
- `post-v1-books-book-id-recognition-schedules-schedule-id-post-due`
- `post-v1-books-book-id-recognition-schedules-schedule-id-reverse-latest`
- `post-v1-books-book-id-recurring-templates`
- `post-v1-books-book-id-recurring-templates-run-due`
- `get-v1-books-book-id-document-templates`
- `post-v1-books-book-id-document-templates`
- `patch-v1-books-book-id-document-templates-template-id`
- `delete-v1-books-book-id-document-templates-template-id`
- `post-v1-books-book-id-document-templates-template-id-set-default`
- `post-v1-books-book-id-document-templates-template-id-reset`
- `post-v1-books-book-id-documents-document-type-document-id-render`
- `post-v1-books-book-id-bank-lines`
- `post-v1-books-book-id-bank-lines-line-id-create-processor-settlement`
- `post-v1-books-book-id-settlements`
- `post-v1-books-book-id-settlements-settlement-id-reverse`
- `post-v1-books-book-id-settlements-settlement-id-replace`
- `post-v1-books-book-id-reconciliations`
- report operations under `get-v1-books-book-id-reports-*`
- `post-api-admin-export-accountant-package`

When you already know a Vibooks resource id, fetch it with the matching detail
`GET` operation instead of listing the collection and filtering client-side.
Use collection `GET` for search, browse, and pagination; use detail `GET` as
the authoritative read path for one known resource.

## Jurisdiction Profiles

Before choosing country-specific defaults, route the book through a
jurisdiction profile.

Rules:

- use the book or company country, tax registration, and other explicit setup
  as the authority when they already exist
- treat company-level country, region, and commodity-tax registration as the
  default source for new books unless the book explicitly overrides them
- use source documents or the business profile next when they clearly establish
  the jurisdiction
- use the current device country only as a last-resort bootstrap suggestion
- treat the operator's nationality or UI language as non-authoritative
- choose the jurisdiction profile before choosing the industry preset
- keep jurisdiction and industry as separate layers
- keep accountant-facing report language explicit on the book; for Japanese
  accountant workpapers use `report_export_language = ja` instead of inferring it
  from the desktop UI language
- if the shipped product later exposes first-class jurisdiction setup, prefer
  that official product path over skill-only manual setup

Current public profiles:

- `generic_global`: conservative fallback when no stronger jurisdiction profile
  is documented. Skill-root path: `jurisdictions/generic-global.md`.
- `ca_smb`: ordinary Canadian small-business and private-enterprise books
  Skill-root path: `jurisdictions/ca/smb.md`.
- `us_smb`: routing skeleton for ordinary United States small-business books
  with explicit state and local tax stop conditions
  Skill-root path: `jurisdictions/us/smb.md`.
- `jp_smb`: ordinary Japanese small-company books with explicit consumption-
  tax, qualified-invoice evidence, and accountant-review stop conditions
  Skill-root path: `jurisdictions/jp/smb.md`.

Reference:

- jurisdiction routing and support states:
  skill-root path `jurisdictions/index.md`

## Bootstrap A New Book

Run setup in this order:

1. inspect the active License and live capacity before creating a Company; a
   new quota subscription is enforced from retained local counts, while an
   existing `company_subscription_v1` License still uses its shipped assignment
   flow, as described in skill-root path `references/install-access.md`, section
   “Company capacity, Payroll places, and existing licenses”; always reuse an
   existing Company's identity rather than creating a duplicate
2. list the Company's existing Books and continue in its primary Book when it
   already represents the same legal entity and accounting history; do not
   create a new Book for a later fiscal year
3. use Dimensions for branches, departments, projects, locations, or other
   reporting segments that belong in the same accounting history
4. create another Book only for a named isolation need such as a setup sandbox,
   migration validation, or a retained historical predecessor, after verifying
   that the live entitlement has an available Book place; all archived Books
   and Companies still count
5. set the company country, region, and commodity-tax registration status when
   known so new books inherit them by default
6. create the Book only when the preceding checks establish that one is needed
7. apply or confirm the jurisdiction profile
8. create the accounting policy
9. create the fiscal year
10. confirm the active period is open
11. choose and apply an official Vibooks preset when it matches the business
12. create or review the chart of accounts
13. create customers and vendors when needed
14. load opening balances if migrating from prior books
15. start routine posting only after the opening balances tie out

Bootstrap defaults:

- infer the first book name from the owner or business profile when it is clear
- if no user-profile detail helps name the book, use `Primary Book`
- infer company `country` and base currency from the owner or business profile
  when the profile is clear, but treat the saved book or company setup as the
  authority when it already exists
- if the user profile does not make `country` or base currency clear, use the
  current device country and its normal operating currency only as a bootstrap
  suggestion
- treat that base currency as Vibooks `functional_currency`, and keep
  `presentation_currency` the same unless the user explicitly wants something
  different
- choose the jurisdiction profile before choosing the industry preset
- when the product exposes jurisdiction fields on `post-v1-books`, send
  `country` and `region` there when they are already known
- treat `jurisdiction_profile_id` as an explicit opt-in to country-specific
  defaults rather than something Vibooks should silently infer onto existing
  books
- when collecting jurisdiction metadata at creation time, also send
  `commodity_tax_registration_status` when it is already known
- `post-v1-books` stores jurisdiction metadata but does not itself apply the
  country profile; use `post-v1-books-book-id-jurisdiction-profile-apply`
  when the user explicitly wants the defaults created or refreshed
- when the country, province or state, or registration posture must be
  confirmed or changed after book creation, use
  `post-v1-books-book-id-jurisdiction-profile-apply` before applying an
  industry preset
- when a documented jurisdiction profile applies, follow its chart, tax,
  numbering, and measurement guidance instead of inventing local defaults
- when a jurisdiction profile returns optional chart recommendations, review
  them before creating extra liability or equity accounts; do not auto-create
  optional accounts just because they are common in that country
- when the business shape is clear, inspect `get-v1-book-presets` and use the
  nearest official preset:
  `generic_smb` for most service businesses, `ecommerce_platform` for
  marketplace or channel-heavy sellers, `restaurant_summary` for summary-based
  restaurant books, and `lodging_summary` for Airbnb, short-term rental, or
  small lodging books
- keep jurisdiction setup separate from industry preset selection; do not
  invent combined pseudo-presets
- treat `get-v1-book-presets` as the authority for preset availability; if the
  catalog marks a preset unavailable, do not try to force it through another
  surface
- `ecommerce_platform`, `restaurant_summary`, and `lodging_summary` require the
  Industry Presets entitlement because they rely on official industry-specific
  defaults
- `restaurant_summary` and `lodging_summary` are summary-based post-facto
  bookkeeping presets; they do not mean Vibooks replaces a POS, PMS, or other
  front-office operating system

Preferred setup command:

```bash
vibooks-cli books bootstrap \
  --company-name "COMPANY NAME" \
  --book-name "Primary Book" \
  --fiscal-year-start 2026-01-01 \
  --fiscal-year-end 2026-12-31 \
  --currency USD \
  --tax-mode none
```

Canada example:

```bash
vibooks-cli books bootstrap \
  --company-name "COMPANY NAME" \
  --book-name "Primary Book" \
  --country CA \
  --region NS \
  --jurisdiction-profile ca_smb \
  --commodity-tax-registration-status registered \
  --fiscal-year-start 2026-01-01 \
  --fiscal-year-end 2026-12-31 \
  --currency CAD \
  --tax-mode exclusive
```

After bootstrap:

1. verify the created company, book, policy, and fiscal year
2. review or add the chart of accounts before posting
3. load opening balances only after confirming the cutover trial balance

## Cleanly Rebuild A Book

If a book must be rebuilt from a clean baseline but it already contains
accounting history, do not hard-delete it resource by resource.

- use `post-v1-books-book-id-replace` to archive the current book and create a
  clean replacement under the same company
- prefer this flow in single-book environments when the current total book
  limit still has room for the archived source plus the new replacement
- provide the replacement `code` and `name`
- Vibooks copies the latest accounting policy and latest fiscal year by default
  when they exist; review the copied setup before posting
- after replacement, continue migration work in the new book and keep the
  archived source as read-only history

Example:

```bash
vibooks-cli invoke post-v1-books-book-id-replace \
  --path bookId=BOOK_ID \
  --body '{"code":"PRIMARY-REBUILD","name":"PRIMARY BOOK"}'
```

If the source book was created in error and should not remain as read-only
history, permanently delete it only after it has been archived. Use
`post-v1-books-batchdelete` with exactly one archived book id,
`confirm_delete: true`, and a `confirmation_code` matching the book code.
Never attempt to hard-delete book-scoped records one resource at a time to
rebuild a book.

Recommended defaults for a normal small business:

- `accounting_basis`: `accrual`
- `functional_currency`: the true operating currency of the business
- `presentation_currency`: usually the same as `functional_currency`
- `scale`: `2`
- `rounding_mode`: `half_up`
- `posting_scale`: omit unless the book needs a currency-specific posting
  scale; omitted values inherit `scale`
- `reporting_scale`: omit unless accountant-facing reports need a different
  scale; omitted values inherit `posting_scale`
- `calculation_scale`: omit for the default high-precision calculation policy
- `tax_rounding_mode`: omit for `half_up`; for registered Japanese JPY
  consumption-tax books use `floor` unless the accountant or source documents
  require `half_up` or `ceiling`
- `tax_rounding_scope`: omit for default line-level behavior; set
  `invoice_rate` only when the official jurisdiction workflow or accountant-
  approved policy requires invoice/rate-level tax rounding, such as Japanese
  qualified-invoice consumption-tax books
- `year_close_mode`: `closing_entries`
- `tax_mode`: `none` unless the user explicitly wants tax-coded bookkeeping

Do not treat UI display formatting as a substitute for posting precision. For
example, an ordinary Japanese JPY company book should post whole-yen functional
amounts while keeping higher internal calculation precision for tax, FX, and
allocations.

When tax registration or tax handling changes later:

- create a new accounting policy version with
  `post-v1-books-book-id-policies`
- set `effective_from` to the real tax change date
- set the new `tax_mode` for that date and later
- when the new policy omits `effective_to`, Vibooks automatically ends the
  previously effective policy on the prior day
- do not leave overlapping policy ranges in place
