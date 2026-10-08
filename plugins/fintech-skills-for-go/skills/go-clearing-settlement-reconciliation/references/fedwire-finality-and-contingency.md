# Fedwire finality and contingency

This reference applies only when the deployed contract is the Fedwire Funds Service under the current Operating Circular 6 and Regulation J. Do not project these rules onto ACH, cards, instant-payment systems, internal ledgers, or provider abstractions.

## Preserve the rail evidence states

Keep the stable customer or treasury instruction separate from each transmission attempt and rail message identity. Persist receipt timestamp, acknowledgment, rejection, Advice of Credit, statement or activity report, business day, and the exact operating-contract version. Absence of an acknowledgment after a connection failure does not prove rejection.

For an accepted Fedwire payment order, the Reserve Banks settle by debiting the sender's Master Account, crediting the receiver's Master Account, and sending an Advice of Credit; Reserve Bank records are conclusive for acceptance and payment timing. A request to cancel or amend is a separate nonvalue message and does not guarantee that an accepted order is undone.

## Reconcile before contingency resend

Messages sent over the normal electronic connection before or during an outage may remain queued or later process. Before using the Import Contingency Feature, reconcile earlier submissions as the circular requires. A contingency send under a new local operation identity can create a second economic transfer while the first remains unresolved.

Represent `submitted`, `receipt unknown`, `rejected`, `accepted`, `paid`, `return requested`, and any corrective movement as evidence-backed states rather than one mutable success flag. Do not release reserved liquidity or report definite failure merely because a local timeout fired. If duplicate economic movement occurs, preserve both rail records and repair through authorized, linked reconciliation or return work rather than deleting history.

## Bind finality to the exact mechanism

Cutoffs, operating days, acceptance, cancellation, outage processing, and finality come from the active circular and procedures. The circular's protracted-outage mechanism can make a critical payment final and irrevocable on Reserve Bank oral confirmation even before related accounting entries are visible. That is specific legal and operational evidence, not a generic rule that every provider `paid` status is final.
