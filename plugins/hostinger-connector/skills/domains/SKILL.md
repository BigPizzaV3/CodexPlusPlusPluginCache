---
name: domains
description: Use when the user wants to work with domain names or DNS at Hostinger — checking availability and buying a domain, reading domain details and renewal dates, changing nameservers, setting up forwarding, managing registrar lock, WHOIS privacy and WHOIS contact profiles, getting an authorization code for a transfer, and reading, editing, validating, resetting or restoring DNS records.
---

# Domains and DNS

This skill spans **two** binaries. They are separate installs and separate tool
groups; loading one does not give you the other.

| Binary | Covers |
| --- | --- |
| `hostinger-domains-mcp` | registration, nameservers, forwarding, lock, privacy, WHOIS, transfers |
| `hostinger-dns-mcp` | DNS zone records and snapshots |

If the user's request touches both — "point my new domain at my site" — say up
front that both binaries are needed, and stop if only one is loaded rather than
half-completing the task.

Run the `hostinger` router first. Its safety gates apply to everything here.

## Buying a domain — the one billable path

`domains_purchaseNewDomainV1` charges the user. It requires the router's
two-confirmation billable gate, and it must never run off an implied request.
"Get my site online" is not permission to buy a domain; suggest the free
`*.hostingersite.com` subdomain from `websites` first and let the user
choose.

1. `domains_checkDomainAvailabilityV1` — check the exact name.
2. State the **price and the term** to the user, and the fact that domain
   registrations are generally non-refundable.
3. First confirmation, naming the domain and the price.
4. Second confirmation in a separate turn.
5. `domains_purchaseNewDomainV1` needs a WHOIS profile — see below.

## WHOIS profiles

Registries require registrant contact data. `domains_createWHOISProfileV1`
stores it; `domains_getWHOISProfileListV1` and `domains_getWHOISProfileV1` read
it back; `domains_getWHOISProfileUsageV1` shows which domains use a profile.
`domains_setWHOISProfileAsDefaultV1` marks one as the default for future
purchases, per TLD; `domains_unsetDefaultWHOISProfileV1` clears that. Setting a
default means later purchases silently reuse those contact details — say which
profile you are making the default, and never set one the user has not seen.

This is personal data — a real name, address, email and phone. Collect only
what the registry requires, take it from the user directly, and never copy it
into project files, commits or summaries. `domains_deleteWHOISProfileV1` fails
or orphans domains if the profile is still in use, so check usage first.

`domains_enablePrivacyProtectionV1` hides those details from public WHOIS;
`domains_disablePrivacyProtectionV1` exposes them again. Disabling is a privacy
regression — say so explicitly and get a confirmation, even though nothing is
destroyed.

## Reading state

- `domains_getDomainListV1` — every domain on the account.
- `domains_getDomainDetailsV1` — status, expiry, nameservers, lock and privacy
  state for one domain. Run this before changing anything.
- `domains_getDomainRenewalInformationV1` — renewal date and pricing.
- `v2_getDomainVerificationsDIRECT` — domain verification records.

## Nameservers, forwarding and lock

- `domains_updateDomainNameserversV1` — **this is the highest-blast-radius tool
  in the skill.** Pointing nameservers away from Hostinger takes the domain's
  entire DNS zone out of service: website, email, everything. Show the current
  nameservers from `domains_getDomainDetailsV1`, spell out what will stop
  resolving, and confirm before changing them. Propagation takes up to 24–48
  hours and is not instantly reversible.
- Forwarding: `domains_getDomainForwardingV1`,
  `domains_createDomainForwardingV1`, `domains_updateDomainForwardingV1`,
  `domains_deleteDomainForwardingV1`.
- Registrar lock: `domains_enableDomainLockV1`, `domains_disableDomainLockV1`.
  The lock exists to prevent unauthorised transfers. **Disabling it is a
  security downgrade** — only do it as a deliberate step in a transfer the user
  is actively performing, and offer to re-enable it afterwards.

## Transfers

`domains_getDomainAuthorizationCodeV1` returns the EPP/auth code that lets
another registrar take the domain. Treat it as a secret: show it to the user in
the conversation, never write it to a file, and never include it in a summary.
Track incoming transfers with `domains_getTransferListV1` and
`domains_getTransferV1`.

## DNS records

Read first: `DNS_getDNSRecordsV1`. Validate before you commit:
`DNS_validateDNSRecordsV1` checks a record set without applying it — use it on
every non-trivial change, because a bad zone is a live outage.

`DNS_updateDNSRecordsV1` applies changes. Be explicit with the user about what
each record does, and remember that TTL governs how long a mistake persists in
resolver caches.

### Snapshots are the safety net — use them

`DNS_getDNSSnapshotListV1` and `DNS_getDNSSnapshotV1` read historical zone
states; `DNS_restoreDNSSnapshotV1` rolls back to one. **Take stock of the
current snapshot list before any destructive record change**, and tell the user
which snapshot they can roll back to. This turns an outage into a two-minute
fix.

### The two destructive DNS tools

Both need two confirmations, never batched:

- `DNS_deleteDNSRecordsV1` — removes specific records. Name each record being
  deleted, with its type and value, not "the selected records".
- `DNS_resetDNSRecordsV1` — discards the entire zone and returns it to
  Hostinger defaults. This will break custom mail routing (MX, SPF, DKIM,
  DMARC), verification records for third-party services, and any subdomain
  pointing elsewhere. State that plainly, list what is currently in the zone,
  and confirm the snapshot the user can restore from before running it.

Restoring a snapshot is itself a full-zone overwrite. It is the recovery path,
but it discards every change made since that snapshot — confirm it the same way.
