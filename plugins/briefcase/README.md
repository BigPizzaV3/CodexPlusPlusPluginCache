# Briefcase

[Briefcase Ledger](https://briefcase.so) is AI-native accounting software for UK businesses and their accountants. It codes every bill and receipt line by line, explains each decision, learns from corrections and publishes on its own when it is confident.

This plugin lets Claude work in your Briefcase account. Ask for a profit and loss, balance sheet or aged debtors, see what needs review and why, publish transactions, raise invoices, post journals and run month-end schedules. It also works for Xero and QuickBooks books through Briefcase Connect.

## Getting started

1. Install the plugin.
2. Sign in to Briefcase when Claude asks you to. In Claude Code, run `/mcp` and choose Briefcase. Choose the clients Claude may work on and approve.
3. Ask: *Check my Briefcase connection.*

Your Briefcase workspace needs assistant connections enabled. If the sign-in page says it is not enabled, ask your Briefcase contact.

## Skills

- **Transaction review**: review bills and receipts awaiting review, explain Autopilot decisions and warnings, fix extracted values, and publish or archive them.
- **Document submission**: upload a bill, receipt, bank statement or supplier statement to a client and follow it through to the resulting transaction.
- **Financial close review**: check what is left to clear for a period and which balance sheet accounts are reconciled and signed off, and review and maintain prepayments, deferred income, accruals and depreciation at period end.
- **Ledger reports**: read and explain profit and loss, balance sheet, trial balance, aged creditors and aged debtors, and drill into the journals and documents behind a figure.
- **Management accounts**: prepare a monthly or quarterly pack for a Briefcase Ledger client as a draft for the accountant, with readiness checks, KPIs, commentary on what moved and why, and a verification appendix that ties every figure to the ledger.
- **Sales invoicing**: raise sales invoices, add customers without duplicating contacts, list what is unpaid and fetch invoice PDFs.
- **Manual journals**: post corrections, reclassifications and period-end adjustments with the accounts and lock date checked.
- **Expense claims**: group a claimant's receipts into an expense claim and publish it.

## What it connects to

The plugin connects to one service: the Briefcase MCP server at `https://api.briefcase.so/mcp`. You sign in with your Briefcase account through OAuth. The plugin stores no credentials, runs no local code and sends data nowhere else. The skills are instructions that guide Claude; the server enforces every permission.

## How Claude acts

Claude acts as you, on the clients you choose, with your Briefcase permissions. It asks before every change, previews anything that posts to the books, and every change is recorded in Briefcase under **Settings → AI assistants**. It never moves money.

## Support

Email [support@briefcase.so](mailto:support@briefcase.so). [Privacy policy](https://briefcase.so/privacy-policy).

## License

MIT. See [LICENSE](LICENSE).
