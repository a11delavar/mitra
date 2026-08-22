---
title: Participants & invitations
description: Invite people to an entry and follow their replies — Mitra writes the guest list, and your calendar account sends the invitations.
sidebar:
  order: 3
---

An entry can carry **participants** — the people invited to it. Mitra stores them the standard way (`ATTENDEE`/`ORGANIZER` in iCalendar), so the list is the same one every other calendar client connected to your account sees, and replies made in Apple Calendar, Thunderbird or a webmail show up here.

## Inviting people

Participants live in the entry editor, under the **people** row.

- **Type an e-mail and press Enter.** Several at once work too — separate them with commas, semicolons or spaces.
- The first invite makes the entry **group-scheduled** and enlists your own account address as its **organizer**.
- Each row shows an avatar with the person's initial, their e-mail, and — where the calendar provided one — their name, plus **Organizer** or **Optional**.
- A **reply badge** on the avatar tracks each answer: green ✓ accepted, red ✕ declined, grey ? tentative, and no badge while a reply is still pending. The line under the count summarizes them ("2 yes, 1 no, 3 awaiting").
- Long lists collapse after a few rows behind **See all N participants**.
- The **mail** icon opens your own mail client addressed to everyone; the **⋯** menu copies all e-mails, marks everyone required or optional, or removes them all at once.

E-mails are selectable, so you can copy a single address straight out of a row.

> [!IMPORTANT]
> **The e-mails are your calendar server's job, not Mitra's.** Adding someone saves them onto the event; your provider mails the invitation, the update when the event moves, and the cancellation when you remove them or delete the entry — and it is what writes each reply back, which is how the badges fill in. Most servers do this (Google, iCloud, Nextcloud, Fastmail, mailbox.org, Zimbra…); one that only stores the guest list mails nobody, so there no invitation arrives and every badge stays "awaiting".

> [!NOTE]
> **Only the organizer can change the list.** That's the scheduling standard's rule (iTIP), not Mitra's: on an entry someone else organized, the batch actions are disabled and the add box is hidden, and the server rejects the change even if something else tries it. Editing the entry's own fields — title, time, description — is unaffected.

## Troubleshooting

- **Everyone shows as awaiting, and no invitation arrived.** Your calendar server most likely doesn't do scheduling — inviting the same people from that provider's own app is the way to confirm it.
- **A reply came in but the badge didn't change.** Replies arrive through the calendar server, so they appear on Mitra's next sync rather than instantly.
- **Answering an invitation yourself.** Mitra shows everyone's reply but doesn't send yours — accept or decline from your mail client or another calendar app, and the answer syncs back here.
- **The add box is missing.** Someone else organizes that entry; only the organizer may change the list.
- **A meeting room isn't listed.** Rooms and equipment are resource attendees, not people, so they're left out of the list.
