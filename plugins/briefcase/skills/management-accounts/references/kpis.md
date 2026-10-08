# KPIs

Choose 5 to 8 that suit the business and audience. Show each with its formula, inputs and the comparison figure. If an input is missing, leave the KPI out and say why rather than approximating silently.

## Core set

| KPI | Formula | Inputs from Briefcase | Notes |
|---|---|---|---|
| Revenue growth | (period revenue − comparison revenue) ÷ comparison revenue | P&L `total_revenue` for the period and comparison | Show against the prior period and the same period last year |
| Gross margin % | (revenue − cost of sales) ÷ revenue | P&L lines; cost-of-sales accounts as chosen in step 3 of the skill | Leave out when no cost-of-sales accounts were identified |
| Net margin % | `net_profit` ÷ `total_revenue` | P&L | Before tax unless corporation tax is accrued |
| Overheads % of revenue | (total expenses − cost of sales) ÷ revenue | P&L | |
| Cash | Sum of bank accounts on the balance sheet, and movement against the comparison date | Balance sheet; reference data `is_bank_account` | State overdrafts separately |
| Current ratio | Current assets ÷ current liabilities | Balance sheet, reference data `type` | Treat `FIXED_ASSET` and `ACCUMULATED_DEPRECIATION` as non-current. Treat liabilities as current unless the account name says the debt is long term, and say so |

## Working capital (accrual basis only)

| KPI | Formula | Inputs | Pitfalls |
|---|---|---|---|
| Debtor days | Trade debtors ÷ gross credit sales for the last 90 days × 90 | Aged debtors `totals.total`; gross sales from `briefcase_list_sales_invoices` (`total`, invoices issued in the 90 days) | Debtors include VAT and P&L revenue does not, so comparing them overstates days by up to 20%. Use gross invoice totals. If most sales are recorded from uploaded documents rather than Briefcase sales invoices, use P&L revenue for the 90 days and say the result is overstated by the VAT rate on standard-rated sales |
| Creditor days | Trade creditors ÷ gross purchases on credit for the last 90 days × 90 | Aged creditors `totals.total`; P&L expenses excluding payroll, depreciation and other non-supplier costs | Using all expenses understates days; using net purchases against gross creditors overstates them. State the basis |
| Quick ratio | (Current assets − stock) ÷ current liabilities | Balance sheet | Briefcase Ledger has no stock type; treat assets named stock or inventory as stock |

Use a trailing period rather than annualising one month, and the same period length for the comparison figure.

## Solvency and cash (when relevant)

| KPI | Formula | When | Pitfalls |
|---|---|---|---|
| Gearing | Debt ÷ equity, or debt ÷ (debt + equity) | Business has loans | Two definitions exist; state which you used |
| Net burn and runway | Average monthly fall in cash over the last three months; cash ÷ net burn | Loss-making or investor-backed | Needs three month-end balance sheets; skip if they are not available |
| Payroll % of revenue | Wages, salaries and directors' remuneration ÷ revenue | People-heavy businesses | Name the accounts included |
| Director's loan account | Balance of the account named for it | Companies | A debit balance means the director owes the company; flag it for the accountant rather than giving tax advice |

## Sector KPIs

Use when the business clearly fits and the inputs exist in the ledger; otherwise mention that the sector KPIs need non-ledger data:

- Hospitality: food and drink cost %, wage cost %.
- Construction: contract margin, retentions held.
- Professional services: lock-up days ((work in progress + debtors) ÷ fees × 365).
- Retail and e-commerce: gross margin by channel, stock days.
- Subscription businesses: recurring revenue and churn usually need data from outside the ledger.

## RAG ratings

Only rate a KPI red, amber or green against a target the user gave you. Use: green at or better than target, amber within 10% of it, red beyond that. Without targets, show the direction of travel instead.
