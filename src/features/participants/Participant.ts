// `t` and the list formatter exist once something imports the Localizer, which a bare server module may not have done.
import '@3mo/localization'
import { type Converter } from '@a11d/converter'
import { description } from '@a11d/metadata'
import { z } from 'zod'
import { Type } from '../../infrastructure/model/orm.js'
import { validation } from '../../infrastructure/validation/validation.js'

/**
 * Participant role mappings based on RFC 5545 ATTENDEE ROLE.
 */
export enum ParticipantRole {
	Chair = 'chair',
	Required = 'required',
	Optional = 'optional',
	NonParticipant = 'non-participant',
}

/**
 * Participant response status mappings based on RFC 5545 PARTSTAT.
 */
export enum ParticipantStatus {
	NeedsAction = 'needs-action',
	Accepted = 'accepted',
	Declined = 'declined',
	Tentative = 'tentative',
	Delegated = 'delegated',
}

/** One person taking part (an ATTENDEE, RFC 5545), held as this wherever it is: in the database, on the wire, in a sync. */
export class Participant {
	@validation(z.email())
	@description('Their email address.')
	email!: string

	@validation(z.string().optional())
	@description('Their name.')
	name?: string

	@validation(z.boolean().optional())
	@description('Whether they organize it; a list has one organizer at most.')
	organizer?: boolean

	@validation(z.enum(ParticipantRole).optional())
	@description('How they take part; required unless said otherwise.')
	role?: ParticipantRole

	@validation(z.enum(ParticipantStatus).optional())
	@description('Their answer; needs-action until they give one.')
	status?: ParticipantStatus

	@validation(z.boolean().optional())
	@description('Whether they are the user.')
	self?: boolean

	constructor(init?: Partial<Participant>) {
		Object.assign(this, init)
	}
}

const roles = new Set<string>(Object.values(ParticipantRole))
const statuses = new Set<string>(Object.values(ParticipantStatus))

/**
 * First-class array collection of participants associated with an entry.
 */
export class Participants extends Array<Participant> {
	static readonly maxCount = 300

	static override get [Symbol.species]() {
		return Array
	}

	/**
	 * Normalizes raw participant array into deduplicated Participants collection, or none if empty/invalid.
	 */
	static normalize(raw: ReadonlyArray<Partial<Participant>> | null | undefined): Participants | undefined {
		if (!raw?.length) {
			return undefined
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
			byEmail.set(email, new Participant({
				email,
				...(name || existing?.name ? { name: name || existing?.name } : {}),
				...(organizer || existing?.organizer ? { organizer: true } : {}),
				role: roles.has(candidate.role as string) ? candidate.role! : existing?.role ?? ParticipantRole.Required,
				status: statuses.has(candidate.status as string) ? candidate.status! : existing?.status ?? ParticipantStatus.NeedsAction,
				...(candidate.self || existing?.self ? { self: true } : {}),
			}))
		}
		if (!byEmail.size) {
			return undefined
		}
		const participants = new Participants()
		participants.push(...byEmail.values())
		return participants
	}

	/** On the wire as the list of its people, read through `normalize`; none at all, `[]` as much as `null`, clears it. */
	static readonly converter: Converter<ReadonlyArray<Partial<Participant>> | null | undefined, Participants | null | undefined> = {
		schema: z.array(validation.schemaOf(Participant)),
		construct: value => value === undefined ? value : Participants.normalize(value) ?? null,
	}

	/** In its JSON column as the list of its people, read back as `Participant`s, which equality tells from plain objects. */
	static readonly Mapper = class extends Type<Participants | undefined, string | null> {
		override convertToDatabaseValue(value: Participants | null | undefined): string | null {
			return value?.length ? JSON.stringify(value) : null
		}

		override convertToJSValue(value: unknown): Participants | undefined {
			return Participants.normalize((typeof value === 'string' ? JSON.parse(value) : value) as ReadonlyArray<Partial<Participant>> | null)
		}

		override getColumnType(): string {
			return 'json'
		}
	}

	get organizer(): Participant | undefined {
		return this.find(participant => participant.organizer)
	}

	get self(): Participant | undefined {
		return this.find(participant => participant.self)
	}

	/** Returns all participants except the current authenticated account. */
	get others(): Array<Participant> {
		return this.filter(participant => !participant.self)
	}

	/** Whether the participant list is manageable by the current account under iTIP rules. */
	get manageable() {
		return !this.organizer || !!this.organizer.self
	}

	/** Returns copy with the organizer listed first. */
	get organizerFirst(): Array<Participant> {
		return [...this].sort((a, b) => Number(!!b.organizer) - Number(!!a.organizer))
	}

	/** Returns the uppercase initial glyph for avatar display. */
	static initialOf(participant: Participant): string {
		return [...participant.name || participant.email][0]?.toUpperCase() ?? '?'
	}

	/**
	 * Returns a new collection with added email addresses and assigned organizer if unorganized.
	 */
	inviting(emails: ReadonlyArray<string>, ownAddress?: string): Participants | undefined {
		const known = new Set(this.map(participant => participant.email))
		const additions = [...new Set(emails.map(email => email.trim().toLowerCase()))]
			.filter(email => email.includes('@') && !known.has(email))
			.map(email => ({ email, role: ParticipantRole.Required, status: ParticipantStatus.NeedsAction }))
		if (!additions.length) {
			return undefined
		}
		const own = ownAddress?.trim().toLowerCase()
		const organizer = !this.organizer && own && !known.has(own) && !additions.some(addition => addition.email === own)
			? [{ email: own, organizer: true, self: true, role: ParticipantRole.Required, status: ParticipantStatus.Accepted }]
			: []
		return Participants.normalize([...organizer, ...this, ...additions])
	}

	/** Returns a new collection with all non-organizer invitees assigned to role. */
	marked(role: ParticipantRole): Participants | undefined {
		return Participants.normalize(this.map(participant => participant.organizer ? participant : { ...participant, role }))
	}

	/** Returns a new collection with target email assigned to role. */
	withRole(email: string, role: ParticipantRole): Participants | undefined {
		const target = email.trim().toLowerCase()
		const affected = this.find(participant => participant.email === target && !participant.organizer && participant.role !== role)
		return !affected ? undefined : Participants.normalize(this.map(participant => participant === affected ? { ...participant, role } : participant))
	}

	/** Returns non-organizer participant by email. */
	invitee(email: string): Participant | undefined {
		const target = email.trim().toLowerCase()
		return this.find(participant => participant.email === target && !participant.organizer)
	}

	/** Returns a new collection without target email, clearing list if no invitees remain. */
	without(email: string): Participants | undefined {
		const removed = this.invitee(email)
		const remaining = this.filter(participant => participant !== removed)
		return Participants.normalize(remaining.some(participant => !participant.organizer) ? remaining : [])
	}

	/** Aggregates response counts across participant statuses. */
	get counts() {
		const count = (status: ParticipantStatus) => this.filter(participant => participant.status === status).length
		const yes = count(ParticipantStatus.Accepted)
		const no = count(ParticipantStatus.Declined)
		const maybe = count(ParticipantStatus.Tentative)
		return { yes, no, maybe, awaiting: this.length - yes - no - maybe }
	}

	/** Summarizes non-zero response counts (e.g. "3 yes and 1 no"), as the language lists them. */
	get summary(): string {
		const { yes, no, maybe, awaiting } = this.counts
		return [
			!yes ? undefined : t('${count:pluralityNumber} yes', { count: yes }),
			!no ? undefined : t('${count:pluralityNumber} no', { count: no }),
			!maybe ? undefined : t('${count:pluralityNumber} maybe', { count: maybe }),
			!awaiting ? undefined : t('${count:pluralityNumber} awaiting', { count: awaiting }),
		].filter(phrase => phrase !== undefined).map(String).formatAsConjunction()
	}

	get emails(): string {
		return this.map(participant => participant.email).join(', ')
	}

	get mailto(): string {
		const others = this.others.map(participant => participant.email)
		return `mailto:${(others.length ? others : this.map(participant => participant.email)).join(',')}`
	}
}
