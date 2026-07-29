/**
 * The people invited to an entry — the domain reading of RFC 5545's ATTENDEE and ORGANIZER
 * properties. A {@link Participant} is a plain value record (like `UserTimeZone`); {@link Participants}
 * is the first-class collection the domain operates through.
 *
 * Permissions follow iTIP (RFC 5546): only the *Organizer* of a group-scheduled entry may change its
 * participant list; everyone else is limited to replying with their own participation status. The
 * organizer is one of the participants (`organizer: true`), and "is that me?" is resolved against the
 * account's own calendar-user addresses (`Integration.addresses`) and stamped as `self` at sync time.
 */

/** RFC 5545 ROLE, in domain terms. Absent means {@link ParticipantRole.Required} (the RFC default) —
 * {@link Participants.normalize} makes it explicit so structural comparison never sees a phantom diff. */
export enum ParticipantRole {
	Chair = 'chair',
	Required = 'required',
	Optional = 'optional',
	NonParticipant = 'non-participant',
}

/** RFC 5545 PARTSTAT. Absent means {@link ParticipantStatus.NeedsAction} (the RFC default). */
export enum ParticipantStatus {
	NeedsAction = 'needs-action',
	Accepted = 'accepted',
	Declined = 'declined',
	Tentative = 'tentative',
	Delegated = 'delegated',
}

export interface Participant {
	/** Lowercased e-mail address — the participant's identity (RFC 5545 CAL-ADDRESS sans `mailto:`). */
	email: string
	/** Display name (the CN parameter), when the provider carries one. */
	name?: string
	/** Whether this participant is the entry's ORGANIZER — the only one iTIP lets manage the list. */
	organizer?: boolean
	role?: ParticipantRole
	status?: ParticipantStatus
	/** Whether this participant is the account itself (matched against `Integration.addresses`). */
	self?: boolean
}

const roles = new Set<string>(Object.values(ParticipantRole))
const statuses = new Set<string>(Object.values(ParticipantStatus))

/**
 * An entry's participant list as a domain collection. An `Array` subclass on purpose: it serializes
 * as a plain JSON array, so the DB column, the wire and structural equality (`Object[equals]`, which
 * drives `Entry.editEquals` and the provider diffs) all see the same shape as a hydrated plain array.
 * Value semantics throughout — operations return a NEW list (clones share the array, so the list is
 * always replaced, never mutated; see `Entry`'s participant methods).
 */
export class Participants extends Array<Participant> {
	/** A list may not exceed this — a sanity bound for the JSON column, not a product limit. */
	static readonly maxCount = 300

	/** Derived-array methods (`map`/`filter`/`slice`) yield plain arrays, not `Participants` — the
	 * subclass is a domain entry point (via {@link normalize}), not a type to propagate through
	 * projections; keeps results comparing equal to plain-array literals and free of stray behavior. */
	static override get [Symbol.species]() {
		return Array
	}

	/**
	 * The canonical form of a raw (client-, provider- or store-supplied) list: trimmed lowercase
	 * e-mails (invalid ones dropped), explicit role/status defaults, deduplicated by e-mail with at
	 * most one organizer, and `null` for "none" — the same tri-state convention as `reminders`, so a
	 * hydrated empty column and a cleared list compare equal. Idempotent, so re-entering the domain
	 * from an already-normalized array is free of surprises. (Named to not collide with `Array.from`.)
	 */
	static normalize(raw: ReadonlyArray<Partial<Participant>> | null | undefined): Participants | null {
		if (!raw?.length) {
			return null
		}
		const byEmail = new Map<string, Participant>()
		let hasOrganizer = false
		for (const candidate of raw.slice(0, Participants.maxCount)) {
			const email = candidate.email?.trim().toLowerCase()
			if (!email || !email.includes('@') || email.length > 320) {
				continue
			}
			const name = candidate.name?.trim().slice(0, 128)
			const organizer: boolean = !!candidate.organizer && !hasOrganizer
			hasOrganizer ||= organizer
			const existing = byEmail.get(email)
			byEmail.set(email, {
				email,
				...(name || existing?.name ? { name: name || existing?.name } : {}),
				...(organizer || existing?.organizer ? { organizer: true } : {}),
				role: roles.has(candidate.role as string) ? candidate.role! : existing?.role ?? ParticipantRole.Required,
				status: statuses.has(candidate.status as string) ? candidate.status! : existing?.status ?? ParticipantStatus.NeedsAction,
				...(candidate.self || existing?.self ? { self: true } : {}),
			})
		}
		if (!byEmail.size) {
			return null
		}
		const participants = new Participants()
		participants.push(...byEmail.values())
		return participants
	}

	get organizer(): Participant | undefined {
		return this.find(participant => participant.organizer)
	}

	/** The account itself among the invitees (see `Integration.addresses`). */
	get self(): Participant | undefined {
		return this.find(participant => participant.self)
	}

	/** Everyone but the account itself — whoever "Email participants" (or any scheduling message the
	 * account sends about the entry) actually addresses; one doesn't notify oneself. */
	get others(): Array<Participant> {
		return this.filter(participant => !participant.self)
	}

	/** Whether the account may change this list. iTIP (RFC 5546) reserves attendee-list changes for
	 * the ORGANIZER: a list without one belongs to the account's own entry (inviting someone makes
	 * the account the organizer), a group-scheduled one is manageable only when the organizer is
	 * `self`. */
	get manageable() {
		return !this.organizer || !!this.organizer.self
	}

	/** Organizer first — how every calendar UI lists them; the rest keep their stored order. */
	get organizerFirst(): Array<Participant> {
		return [...this].sort((a, b) => Number(!!b.organizer) - Number(!!a.organizer))
	}

	/** The avatar glyph for a participant: the first grapheme of the display name, or of the e-mail. */
	static initialOf(participant: Participant): string {
		return [...participant.name || participant.email][0]?.toUpperCase() ?? '?'
	}

	/**
	 * This list with `emails` newly invited — pending, required, asked to reply — skipping anyone
	 * already on it. Inviting turns the entry group-scheduled, which per iTIP makes the account its
	 * organizer: a list without one also enlists `ownAddress` as such (when the integration knows it).
	 * `null` when nothing would change (every address already invited, or none valid) — so callers
	 * can tell a real change from a no-op without diffing.
	 */
	inviting(emails: ReadonlyArray<string>, ownAddress?: string): Participants | null {
		const known = new Set(this.map(participant => participant.email))
		const additions = [...new Set(emails.map(email => email.trim().toLowerCase()))]
			.filter(email => email.includes('@') && !known.has(email))
			.map(email => ({ email, role: ParticipantRole.Required, status: ParticipantStatus.NeedsAction }))
		if (!additions.length) {
			return null
		}
		const own = ownAddress?.trim().toLowerCase()
		const organizer = !this.organizer && own && !known.has(own) && !additions.some(addition => addition.email === own)
			? [{ email: own, organizer: true, self: true, role: ParticipantRole.Required, status: ParticipantStatus.Accepted }]
			: []
		return Participants.normalize([...organizer, ...this, ...additions])
	}

	/** This list with every invitee marked `role` — the organizer isn't an invitee and stays untouched. */
	marked(role: ParticipantRole): Participants | null {
		return Participants.normalize(this.map(participant => participant.organizer ? participant : { ...participant, role }))
	}

	/** How the invitees stand: everything not an explicit yes/no/maybe — needs-action and delegated
	 * alike — is still "awaiting" a reply. */
	get counts() {
		const count = (status: ParticipantStatus) => this.filter(participant => participant.status === status).length
		const yes = count(ParticipantStatus.Accepted)
		const no = count(ParticipantStatus.Declined)
		const maybe = count(ParticipantStatus.Tentative)
		return { yes, no, maybe, awaiting: this.length - yes - no - maybe }
	}

	/** "3 yes, 1 no, 1 maybe, 2 awaiting" — the replies aggregated, zero groups omitted. */
	get summary(): string {
		const counts = this.counts
		return ([['yes', counts.yes], ['no', counts.no], ['maybe', counts.maybe], ['awaiting', counts.awaiting]] as const)
			.filter(([, count]) => count > 0)
			.map(([label, count]) => `${count} ${label}`)
			.join(', ')
	}

	/** A paste-ready comma-separated list of the e-mails — what "Copy participants' emails" copies. */
	get emails(): string {
		return this.map(participant => participant.email).join(', ')
	}

	/** The `mailto:` behind "Email participants" — {@link others}, falling back to everyone when the
	 * account is alone, so the link always opens a composable draft. */
	get mailto(): string {
		const others = this.others.map(participant => participant.email)
		return `mailto:${(others.length ? others : this.map(participant => participant.email)).join(',')}`
	}
}
