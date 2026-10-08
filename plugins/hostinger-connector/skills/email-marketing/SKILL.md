---
name: email-marketing
description: Use when the user wants to work with Hostinger Reach, their email marketing product — listing and creating contacts, importing contacts in bulk, organising them into groups, building segments with custom criteria, reading segment membership, listing marketing profiles, and checking whether a sending domain's MX, SPF, DKIM and DMARC records are configured. Not for mailboxes or reading mail.
---

# Email marketing (Reach)

Binary: **`hostinger-reach-mcp`** — every tool named `reach_*`.

Run the `hostinger` router first. Its safety gates apply to everything here.

This is **marketing contacts and segments**, not email hosting. Creating a
mailbox, forwarding, or an autoreply is a different product and is not covered by
any skill in this plugin — say so rather than reaching for another binary.

## Start from the profile

Everything is scoped to a Reach profile. `reach_listProfilesV1` lists them; take
the identifier from there rather than guessing, and if there are several, ask
which one before writing anything.

`reach_getProfileDomainDNSStatusV1` reports the MX, SPF, DKIM and DMARC state for
the profile's sending domain. **Check this before the user sends anything to a
real list** — a domain missing SPF or DKIM gets its mail filtered as spam, and
that damages the domain's reputation in a way that is slow to undo. Fixing the
records themselves is the `domains` skill.

## Reading contacts, groups and segments

- `reach_listContactsV1` — paginated, filterable by group and subscription
  status. Respect the subscription status: an unsubscribed contact is a request
  the user is legally obliged to honour, not a row to work around.
- `reach_listContactGroupsV1` — groups the contacts are organised into.
- `reach_listSegmentsV1`, `reach_getSegmentDetailsV1` — segments and one
  segment's definition.
- `reach_listSegmentContactsV1`, `reach_listProfileSegmentContactsV1` — who is
  actually in a segment. Use these to show the user the size and shape of an
  audience *before* they act on it.

## Personal data — the constraint that shapes this whole skill

Contacts are named people with email addresses, and in many jurisdictions that
is regulated personal data. Treat it accordingly:

- **Never write contact data into project files, commits, deploy archives, or a
  summary that could be pasted elsewhere.** Show it in the conversation to the
  user who asked, and nowhere else.
- **Never import a list the user cannot account for.** Before
  `reach_createNewContactsV1`, ask where the addresses came from and confirm the
  people consented to marketing email. If the answer is a scraped list, a
  purchased list, or "found it somewhere", decline and say why: it is a legal
  problem for the user and it will burn their sending domain.
- **Never invent contacts.** Do not fabricate names or addresses to fill out a
  test, and do not derive an address from a pattern (`firstname@company.com`).
- **Do not enrich.** Adding data about a contact from another source is not what
  the user asked for and is exactly what data protection rules restrict.

## Writes

- `reach_createANewContactV1` — one contact. Read back the name, email and group
  before creating it.
- `reach_createNewContactsV1` — bulk. State **how many** contacts, which group
  they land in, and where the list came from, then take one confirmation. A bulk
  import is the highest-volume write in this skill; a mistake here is visible to
  every recipient.
- `reach_createANewContactSegmentV1` — a segment definition. Show the criteria in
  plain language and say roughly who it will match; a criterion the user misread
  means the wrong audience gets the next campaign.

## The destructive one

`reach_deleteAContactV1` **permanently removes a contact** from the email
marketing system, by UUID. Two confirmations, never batched:

1. First names the contact — email address and name, resolved from
   `reach_listContactsV1`, not the raw UUID the user pasted. State that the
   contact and their history cannot be restored.
2. Second in a separate turn.

Never delete more than one contact per approval, and never carry an approval
forward to another contact. If the user wants a contact to stop receiving mail,
unsubscribing is usually what they mean — check before deleting.

## Full tool list

Profiles: `reach_listProfilesV1`, `reach_getProfileDomainDNSStatusV1`

Contacts: `reach_listContactsV1`, `reach_createANewContactV1`,
`reach_createNewContactsV1`, `reach_deleteAContactV1`,
`reach_listContactGroupsV1`

Segments: `reach_listSegmentsV1`, `reach_createANewContactSegmentV1`,
`reach_getSegmentDetailsV1`, `reach_listSegmentContactsV1`,
`reach_listProfileSegmentContactsV1`
