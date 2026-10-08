# Business time and cutoff authority

Financial time is a versioned contract. Keep these values distinct:

- the instant an instruction or artifact was observed;
- the source-supplied event instant and offset;
- local civil time in the governing named timezone;
- the rail or institution business-day label;
- processing-window, participant, message-type, and value cutoffs;
- an approved extension, early close, holiday override, or contingency window;
- the effective version of every governing schedule and rule.

## Compute from the governing contract

Load an IANA location such as `America/New_York` when rules use Eastern Time; a fixed `-05:00` or `-04:00` offset cannot represent both daylight and standard time. Parse ambiguous or nonexistent local times only under an explicit product rule. Do not derive the next business day with `Add(24*time.Hour)`, assume every Monday through Friday is open, or equate a UTC date with the rail's business-day label.

Go's monotonic clock reading is useful for elapsed time inside one process but is stripped by serialization and is not shared authority for a persisted cutoff. Persist absolute instants plus the named timezone, calendar/schedule identity, effective version, and resulting business-day classification needed to reproduce the decision.

Treat schedule changes as temporal data with `effective_from` and, when known, `effective_to`. An announced future operating-day expansion must not alter current admission. Roll out new schedule readers before activating the new version, keep rollback able to interpret both, and retain the decision inputs for audit and reconciliation.

## Separate admission from outcome

A local clock check can decide whether the service may attempt submission; it cannot prove the rail received, accepted, rejected, or settled the instruction. Persist the instruction's stable identity, chosen window, attempt time, rail message identity, acknowledgment, acceptance or rejection evidence, and later settlement evidence separately.

Near a cutoff, budget queueing, connection, protocol, and evidence time. If clock authority, schedule version, extension status, or submission outcome is unknown, route to an explicit exception or reconciliation state rather than silently assigning another business day or reporting definite failure.

An extension or early close is its own authenticated, time-bounded evidence. Do not mutate a global cutoff in place without source, authority, effective interval, affected service or message class, and operator audit.

## Fedwire example, not a universal rail rule

The current published Fedwire Funds Service schedule defines a funds-transfer business day in Eastern Time and may open on the preceding calendar day. It also distinguishes message and service cutoffs and permits operating-hour extensions. Bind code to the verified schedule and Operating Circular version used by the participant; do not project those hours, holidays, or future expansion announcements onto ACH, card, RTP, or another rail.

Derive restartable scheduler and batch identities from the governing rail, participant, business-day label, message class, and schedule generation. Seal or advance them conditionally so a crash, repeated wall-clock interval, host-timezone change, or updated calendar cannot originate the same economic batch twice or skip it.

Test host timezone changes, daylight-saving gaps and repeats, holidays, preceding-calendar-day openings, cutoff minus and plus one instant, approved extensions, early closes, future effective schedules, clock uncertainty, restart before and after batch seal, and authoritative evidence arriving after the local window closes.
