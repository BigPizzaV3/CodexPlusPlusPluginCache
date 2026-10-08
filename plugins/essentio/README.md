# Essentio

Invoice from a conversation with your AI assistant. This plugin pairs the Essentio connector —
Essentio's MCP server at `https://mcp.essentio.pro` — with two skills that teach the assistant the
order Essentio's work is done in: draft, check, issue, send; read the month's figures, then say what
is left.

[Essentio](https://essentio.pro) is invoicing software for small businesses in Europe: Invoices,
Proforma Invoices, Credit Notes and Quotes, Payments and Receipts, VAT by rate, and EN16931
e-invoices.

## What you can do

| You ask | The assistant |
|---|---|
| "Invoice Harbor & Co for 12 hours at €80, due in 30 days, and send it." | Finds the Client, creates a Draft with its Line, shows you Essentio's totals and VAT, then issues and emails it once you agree. |
| "Which Invoices are overdue, and by how much?" | Lists what is awaiting payment or overdue, with the amount due and the days overdue. |
| "Nordic Retail paid their oldest open Invoice yesterday by bank transfer." | Records the Payment against it; the document becomes Partially paid or Paid and a Receipt is made. |
| "How much VAT do I owe for September, and is anything unfinished?" | Reads the month's Reported VAT and Income, and names the Drafts and unpaid documents left. |
| "Add Bluebird Retail in Limassol, VAT CY10345678Z, and a Product 'Monthly support' at €150." | Creates the Client (the VAT number is checked with the EU's VIES) and the Product. |
| "The client accepted Proforma PF-2026-0007 — turn it into an Invoice." | Converts the Proforma Invoice into an Invoice that counts its Payments as prepaid. |

Every figure comes from Essentio, never from the assistant's own arithmetic: amounts are exact
decimals in the document's currency.

## Skills

- **draft-and-send-invoice** — finds or creates the Client, creates a Draft, shows it as a card with
  its Client, Lines, VAT and Total, checks the figures and which Actions are open, and issues and sends
  it only when you say so. A refusal stops the workflow, and the assistant tells you what it means and
  what to do.
- **close-vat-month** — reads a month's Reported VAT and Income from Essentio's own reports, lists the
  Drafts left and the documents still awaiting payment, and says what is done and what is not. It files
  nothing with a tax authority.

## The connector's tools

| Area | Tools |
|---|---|
| Business | `essentio_get_business_setup` |
| Clients | `essentio_search_clients`, `essentio_get_client`, `essentio_create_client`, `essentio_update_client` |
| Products | `essentio_search_products`, `essentio_create_product`, `essentio_update_product` |
| Documents | `essentio_search_documents`, `essentio_get_document`, `essentio_create_draft`, `essentio_update_draft`, `essentio_delete_draft`, `essentio_issue_document`, `essentio_send_document`, `essentio_cancel_document`, `essentio_convert_proforma` |
| Payments | `essentio_search_payments`, `essentio_record_payment`, `essentio_amend_payment`, `essentio_reverse_payment` |
| Reports | `essentio_get_report` (income, VAT, overdue, a Client's Statement) |

Tools that issue, send, cancel, delete or reverse are marked destructive, so your assistant asks
before it runs them. No tool moves money: recording a Payment notes money you already received.

## Use it

In Claude, add the plugin and connect Essentio from its Connectors tab.
Connecting Essentio's server sends you to Essentio: you sign in, choose one of your Businesses and the
Role the assistant acts with there. Every tool then acts for that Business alone, as that Role allows.
The skills tell the assistant to ask you before it creates a Client, issues or sends; your assistant's
own tool permissions decide whether it has to.

**What you need:** an Essentio account ([free sign-up](https://essentio.pro/register)) with a verified
email and a Business. The connector works on every plan: on the Free plan the Business's Owner reads
and writes (up to 200 issued documents a year) and other members read; on a paid plan every Role acts
as it does in Essentio.

**Try it first in a Test business:** its documents are marked as samples, their numbers start with
`TEST-`, and what it sends reaches you, never a Client.

## Data

The plugin holds no key or password. The connector sends what you ask for — Clients, documents, their
Lines, Payments and report periods — to the Business you connected, through `mcp.essentio.pro`, and
Essentio answers from that Business's records. The plugin stores nothing itself. Essentio is hosted in
the EU: [privacy policy](https://essentio.pro/privacy), [terms](https://essentio.pro/terms).

## Support

Write to support@essentio.pro; we answer within two working days, Cyprus time. How to disconnect the
assistant, and where the privacy policy and terms are: https://developers.essentio.pro/support.
Developer documentation: https://developers.essentio.pro · the MCP guide:
https://developers.essentio.pro/mcp.

## License

MIT — see [LICENSE](LICENSE).
