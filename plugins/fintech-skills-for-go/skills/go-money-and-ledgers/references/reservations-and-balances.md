# Reservations and available balance

“Balance” is not one number. Define posted, pending, reserved, and available dimensions per account and currency, including which entry states and effective-time rules contribute. A cache or projection used to authorize spend must be transactionally current enough for that authority or guarded by an authoritative version/balance predicate.

## Reserve atomically

Two requests can each observe enough funds and together overspend. Commit the sufficiency predicate, reservation mutation, stable operation claim, and any required journal/projection change in one serializable or conditionally versioned boundary. A process mutex cannot protect other replicas. Retrying the same canonical operation must return the existing reservation; reusing its identity with a different payload must fail before disclosing or changing financial state.

## Model the reservation lifecycle

Persist reservation identity, account, currency, exact original and remaining amount, source operation, version, expiry contract, and legal states. Capture consumes reserved amount at most once and posts the corresponding immutable journal in the same durable transition. Define whether partial capture releases or retains the remainder from the actual product or rail contract.

Release, expiry, reversal, and correction are transitions with audit evidence, not row deletion. Do not free availability solely because a local timer fired when provider capture may still arrive; use authoritative expiry/effect evidence and define late-event or reconciliation handling. Projection repair must rebuild reservations and their effects without inventing spendable funds.
