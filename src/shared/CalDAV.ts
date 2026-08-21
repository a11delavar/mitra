import { type EntityManager } from '@mikro-orm/sqlite'
import { converter } from '@a11d/converter'
import { equals } from '@a11d/equals'
import '@a11d/bidirectional-map' // registers the global BidirectionalMap the iCalendar mappings below use
import { createDAVClient } from 'tsdav'
import ICAL from 'ical.js'
import { model } from './model.js'
import { buildVTimezone } from './vtimezone.js'
import { Source } from './Source.js'
import { Integration, integration, withheld } from './Integration.js'
import { Entry, TaskStatus, Transparency, Visibility, FLOATING_TIME_ZONE } from './Entry.js'
import { EntryType } from './EntryType.js'
import { Recurrence } from './Recurrence.js'
import { Relation } from './Relation.js'
import { RelationType } from './RelationType.js'
import { calendarDateOf, midnightOf } from './calendarDate.js'
import { Participants, ParticipantRole, ParticipantStatus, type Participant } from './Participant.js'
import { Color } from './Color.js'
import { createLogger } from './Logger.js'

const logger = createLogger('CalDAV')

export interface CalDAVCredentials {
	username: string
	/** The Basic-auth secret. Optional so credential shapes without one (see GoogleCalendar) stay assignable. */
	password?: string
}

@model('CalDAV')
@integration('caldav')
export class CalDAV extends Integration<CalDAVCredentials> {
	// Typed `string` (not the inferred literal) so subclasses can override with their own values —
	// a narrowed literal type would reject an override on the static side.
	static readonly label: string = 'CalDAV'
	static readonly logo: string = 'caldav'
	static readonly description: string = 'Nextcloud, Fastmail, Radicale — any CalDAV server'

	/** The password authorizes the account; the username identifies it. */
	@converter(withheld<CalDAVCredentials>('password')) override credentials!: CalDAVCredentials

	constructor(init?: Partial<CalDAV>) {
		super()
		// The blank credential shape is the provider's own knowledge, so it seeds it here. Empty strings,
		// not undefined: the edit form binds these keyPaths straight to `input.value`, and an undefined
		// there renders as the literal text "undefined". `init` (a stored/edited copy) overwrites them.
		this.uri = ''
		this.credentials = { username: '', password: '' }
		Object.assign(this, init)
	}

	override toString() {
		return `${this.type} integration for "${this.credentials.username}" at ${this.uri}`
	}

	override merge(incoming: CalDAV) {
		this.uri = incoming.uri || this.uri
		if (incoming.credentials.username !== this.credentials.username) {
			this.addresses = undefined // another account — its own addresses get re-discovered on sync
		}
		this.credentials = {
			username: incoming.credentials.username,
			// A blank incoming password keeps the stored secret — the edit form leaves it empty.
			password: incoming.credentials.password || this.credentials.password,
		}
	}

	/** Transient: a live connection, not state. `out: {}` is how a member says "never serialized" — the
	 * API's shape is the domain's, and a socket is not part of it. */
	@converter({ out: {} }) private client?: ReturnType<typeof createDAVClient>

	/** The tsdav client configuration — the one thing a differently-authenticated provider
	 * (see GoogleCalendar's OAuth) swaps out; everything else about the protocol is shared. */
	protected get clientParameters(): Parameters<typeof createDAVClient>[0] {
		return {
			defaultAccountType: 'caldav',
			authMethod: 'Basic',
			serverUrl: this.uri ?? '',
			credentials: {
				username: this.credentials.username,
				password: this.credentials.password,
			},
		}
	}

	// Memoized so a multi-step operation (discover + sync entries) shares one account discovery.
	private getClient(): ReturnType<typeof createDAVClient> {
		return this.client ??= createDAVClient(this.clientParameters)
	}

	/**
	 * The account's own calendar-user addresses off the principal's `calendar-user-address-set`
	 * (RFC 6638) — what identifies "me" among an entry's participants and lets scheduling servers
	 * accept an ORGANIZER we write. Sticky once found; falls back to an e-mail-shaped username on
	 * servers without scheduling support (their PROPFIND lacks the property).
	 */
	private async discoverAddresses(): Promise<void> {
		if (this.addresses?.length) {
			return
		}
		let addresses = new Array<string>()
		try {
			const client = await this.getClient()
			// tsdav injects the client's discovered account (principal URL included); passing our own
			// would clobber it — hence the empty params object the bound type doesn't know is complete.
			const fetch = client.fetchCalendarUserAddresses as unknown as (params: object) => Promise<Array<string>>
			addresses = await fetch({})
		} catch {
			// No scheduling support (or the PROPFIND failed) — fall through to the username.
		}
		const emails = addresses
			.filter(address => /^mailto:/i.test(address))
			.map(address => address.replace(/^mailto:/i, '').trim().toLowerCase())
			.filter(address => address.includes('@'))
		if (!emails.length && this.credentials.username.includes('@')) {
			emails.push(this.credentials.username.trim().toLowerCase())
		}
		this.addresses = emails.length ? [...new Set(emails)] : undefined
	}

	protected override async fetchSources() {
		const client = await this.getClient()
		await this.discoverAddresses()
		const calendars = await client.fetchCalendars()
		logger.debug(`Discovered ${calendars.length} calendar(s) at ${this.uri}`)
		// ONE source per collection, carrying the TYPES it accepts — never an event/task sibling pair for
		// the same URL (which cost two sync passes, two tokens and a cross-source duplicate guard, all to
		// re-split what the server keeps together).
		return calendars.map(cal => {
			const name = typeof cal.displayName === 'string' ? cal.displayName : 'Untitled'
			const color = typeof cal.calendarColor === 'string' ? cal.calendarColor : Color.get(cal.url || name).value
			// Per RFC 4791 §5.2.3 an absent/empty supported-calendar-component-set means the
			// collection accepts every component type — so an empty list supports both.
			const components = cal.components ?? []
			const supports = (component: string) => components.length === 0 || components.includes(component)
			const types = [
				...supports('VEVENT') ? [EntryType.Event] : [],
				...supports('VTODO') ? [EntryType.Task] : [],
			]
			return new Source({ uri: cal.url, entryTypes: types, name, color, enabled: false })
		// A collection that accepts neither (a VJOURNAL-only one) holds nothing mitra models — drop it.
		}).filter(source => source.entryTypes.length > 0)
	}

	/** Build a DTSTART/DTEND/DUE/EXDATE value. All-day entries are written date-only (`VALUE=DATE`) —
	 * that's what makes a real all-day event (not a 00:00→00:00 timed one); `DTEND` stays the exclusive
	 * next day. All-day bounds are CANONICAL date encodings — UTC midnights (see calendarDate.ts) — so
	 * the DATE is simply the instant's UTC calendar day, whatever zone the server runs in. */
	static toICALTime(date: Date, allDay: boolean) {
		if (!allDay) {
			return ICAL.Time.fromJSDate(date, true)
		}
		// Explicit fields, not a spread — a PlainDate's fields are prototype getters (spread to {}).
		const { year, month, day } = calendarDateOf(date, 'UTC')
		return ICAL.Time.fromData({ year, month, day, isDate: true })
	}

	/** Whether a parsed timed value is an RFC 5545 FLOATING time — a bare local date-time that came
	 * with neither a `Z` suffix nor a TZID, which ical.js models as its zone-less "local" zone. */
	private static isFloating(value: unknown): boolean {
		return value instanceof ICAL.Time && !value.isDate && value.zone === ICAL.Timezone.localTimezone
	}

	/** Whether Temporal can resolve a TZID as an IANA zone — what decides if it's stored as an entry's
	 * `timeZone` and used for wall-clock math (an unresolvable id would throw on every expansion). */
	static resolvableZone(tzid: string | null | undefined): tzid is string {
		try {
			return !!tzid && !!Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(tzid)
		} catch {
			return false
		}
	}

	/**
	 * The stored instant of an iCalendar time — the ONE decoder every read goes through, with Temporal
	 * (not the resource) as the zone authority:
	 * - a date-only value (all-day) is its canonical UTC-midnight date encoding, read off the value's
	 *   own y/m/d fields — NEVER `toJSDate()`, which lands on the SERVER's local midnight;
	 * - a value whose property carried a `tzid` is that zone's wall clock (ical.js keeps the literal
	 *   fields whether or not it resolved the TZID), converted by Temporal — so a zoned time reads
	 *   correctly even when the resource omits its VTIMEZONE (RFC 7809 timezones-by-reference servers),
	 *   with a non-IANA TZID (a Microsoft zone name, say) falling through to the value's own resolution;
	 * - a FLOATING value reads off its own fields as-if-UTC — deterministic wherever the server runs,
	 *   and the exact reverse of how the write path emits it, so a floating wall clock round-trips;
	 * - anything else (`Z`-suffixed, or VTIMEZONE-resolved under a non-IANA TZID) via `toJSDate()`.
	 */
	static instantFrom(time: { isDate?: boolean, year: number, month: number, day: number, hour?: number, minute?: number, second?: number, toJSDate(): Date } | null | undefined, tzid?: string): Date | undefined {
		if (!time) {
			return undefined
		}
		if (time.isDate) {
			return midnightOf(Temporal.PlainDate.from({ year: time.year, month: time.month, day: time.day }), 'UTC')
		}
		if (CalDAV.resolvableZone(tzid)) {
			return new Date(Temporal.PlainDateTime
				.from({ year: time.year, month: time.month, day: time.day, hour: time.hour ?? 0, minute: time.minute ?? 0, second: time.second ?? 0 })
				.toZonedDateTime(tzid, { disambiguation: 'compatible' }).epochMilliseconds)
		}
		if (CalDAV.isFloating(time)) {
			return new Date(Date.UTC(time.year, time.month - 1, time.day, time.hour ?? 0, time.minute ?? 0, time.second ?? 0))
		}
		return time.toJSDate()
	}

	/** mitra TaskStatus ↔ CalDAV VTODO STATUS (RFC 5545 §3.8.1.11). */
	private static readonly icalTaskStatus = new BidirectionalMap<TaskStatus, string>([
		[TaskStatus.ToDo, 'NEEDS-ACTION'],
		[TaskStatus.Doing, 'IN-PROCESS'],
		[TaskStatus.Done, 'COMPLETED'],
		[TaskStatus.Cancelled, 'CANCELLED'],
	])

	/** CalDAV VTODO STATUS → mitra TaskStatus. A missing/unknown STATUS falls back to PERCENT-COMPLETE
	 * (>= 100 means done), then to ToDo — so a VTODO with no status is shown as ToDo, never mutated.
	 * A pure static like the participant mappings, so it is unit-testable on its own. */
	static statusFromICal(status: string | undefined, percentComplete: number): TaskStatus {
		return CalDAV.icalTaskStatus.getKey(status?.toUpperCase() ?? '')
			?? (percentComplete >= 100 ? TaskStatus.Done : TaskStatus.ToDo)
	}

	/** Write a task's three coupled completion properties consistently: STATUS, PERCENT-COMPLETE, and the
	 * COMPLETED instant (stamped/cleared server-side — there's no UI for it). Manual percent comes later
	 * with sub-tasks; for now it tracks completion (100/0). */
	private writeTaskStatus(component: ICAL.Component, status: TaskStatus | undefined) {
		const effective = status ?? TaskStatus.ToDo
		component.updatePropertyWithValue('status', CalDAV.icalTaskStatus.get(effective))
		component.updatePropertyWithValue('percent-complete', effective === TaskStatus.Done ? 100 : 0)
		if (effective === TaskStatus.Done) {
			component.updatePropertyWithValue('completed', ICAL.Time.now())
		} else {
			component.removeProperty('completed')
		}
	}

	/** mitra {@link Transparency} ↔ iCalendar TRANSP (RFC 5545 §3.8.2.7). */
	private static readonly icalTransparency = new BidirectionalMap<Transparency, string>([
		[Transparency.Busy, 'OPAQUE'],
		[Transparency.Free, 'TRANSPARENT'],
	])

	/** mitra {@link Visibility} ↔ iCalendar CLASS (RFC 5545 §3.8.1.3). */
	private static readonly icalVisibility = new BidirectionalMap<Visibility, string>([
		[Visibility.Public, 'PUBLIC'],
		[Visibility.Private, 'PRIVATE'],
		[Visibility.Confidential, 'CONFIDENTIAL'],
	])

	/** iCalendar TRANSP → mitra {@link Transparency}. A missing value stays `null` rather than being
	 * filled in with the OPAQUE default: both read as "Busy" in the editor, and keeping the absence
	 * means a later edit of some other field never quietly adds a TRANSP the resource never had. An
	 * unknown word is treated as absent — the RFC allows only these two. A pure static, like the
	 * task-status and participant mappings, so it is unit-testable on its own. */
	static transparencyFromICal(transparency: string | undefined): Transparency | null {
		return CalDAV.icalTransparency.getKey(transparency?.toUpperCase() ?? '') ?? null
	}

	/** iCalendar CLASS → mitra {@link Visibility}. Absent (or a value outside the three the RFC names —
	 * CLASS permits private extensions) is `null`: "whatever the calendar defaults to". */
	static visibilityFromICal(visibility: string | undefined): Visibility | null {
		return CalDAV.icalVisibility.getKey(visibility?.toUpperCase() ?? '') ?? null
	}

	/** Write (or drop) TRANSP. Only ever called for a VEVENT — RFC 5545 gives VTODO no such property. */
	private static writeTransparency(component: ICAL.Component, transparency: Transparency | null | undefined) {
		if (transparency) {
			component.updatePropertyWithValue('transp', CalDAV.icalTransparency.get(transparency)!)
		} else {
			component.removeProperty('transp')
		}
	}

	/** Write (or drop) CLASS. "Default visibility" is the ABSENCE of the property, which is what the
	 * calendar's own sharing settings then decide — so picking it removes the line rather than writing
	 * PUBLIC, which would be a different (and stronger) statement. */
	private static writeVisibility(component: ICAL.Component, visibility: Visibility | null | undefined) {
		if (visibility) {
			component.updatePropertyWithValue('class', CalDAV.icalVisibility.get(visibility)!)
		} else {
			component.removeProperty('class')
		}
	}

	static collectionUrl(sourceUri: string): string {
		return sourceUri.endsWith('/') ? sourceUri : `${sourceUri}/`
	}

	static resolveMemberUrl(sourceUri: string, href: string | null | undefined): string {
		if (!href) {
			return ''
		}
		try {
			return new URL(href, CalDAV.collectionUrl(sourceUri)).href
		} catch {
			return href
		}
	}

	static memberUrlsMatch(sourceUri: string, a: string | null | undefined, b: string | null | undefined): boolean {
		return !!a && !!b && CalDAV.resolveMemberUrl(sourceUri, a) === CalDAV.resolveMemberUrl(sourceUri, b)
	}

	static partitionMemberResponses(sourceUri: string, responses: ReadonlyArray<{ href?: string, status?: number }>): { changedUrls: Array<string>, deletedUrls: Array<string> } {
		const collection = CalDAV.resolveMemberUrl(sourceUri, sourceUri)
		const members = responses
			.filter(r => r.href)
			.map(r => ({ url: CalDAV.resolveMemberUrl(sourceUri, r.href), status: r.status }))
			// Drop the collection itself, tolerant of a trailing-slash difference between it and its href.
			.filter(m => m.url !== collection && m.url + '/' !== collection && m.url !== collection + '/')
		return {
			changedUrls: members.filter(m => m.status !== 404).map(m => m.url),
			deletedUrls: members.filter(m => m.status === 404).map(m => m.url),
		}
	}

	/** A stored recurrence-id as epoch ms (occurrence instants are compared by ms throughout), or
	 * undefined for none — tolerant of the column surfacing as a Date or a raw ms number. */
	static instantOf(recurrenceId: Date | number | null | undefined): number | undefined {
		return recurrenceId === null || recurrenceId === undefined ? undefined : new Date(recurrenceId).getTime()
	}

	/** A TZID resolved against the resource's own VTIMEZONEs — a zoned resource always carries the
	 * definitions of every TZID it uses (RFC 5545 §3.6.5). When `generate` is set (WE are authoring a
	 * user-picked zone the resource doesn't carry yet), the definition is built off the runtime's zone
	 * data ({@link buildVTimezone}) and embedded; a zone the runtime can't resolve yields undefined, so
	 * the caller writes UTC rather than a TZID with no matching definition. */
	private static timezoneIn(comp: ICAL.Component, tzid: string | undefined, generate = false, aroundYear = 0): ICAL.Timezone | undefined {
		if (!tzid) {
			return undefined
		}
		const existing = comp.getAllSubcomponents('vtimezone')
			.find(candidate => candidate.getFirstPropertyValue('tzid')?.toString() === tzid)
		if (existing) {
			return new ICAL.Timezone(existing)
		}
		if (!generate) {
			return undefined
		}
		try {
			const vtimezone = buildVTimezone(tzid, aroundYear)
			comp.addSubcomponent(vtimezone)
			return new ICAL.Timezone(vtimezone)
		} catch {
			return undefined // not a resolvable IANA zone — fall back to a UTC write
		}
	}

	/** A FLOATING (zone-less) ICAL.Time off an as-if-UTC instant — its UTC wall clock becomes the bare
	 * local value, the reverse of how {@link instantFrom} reads floating times back. */
	private static floatingTime(date: Date): ICAL.Time {
		return ICAL.Time.fromData({
			year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
			hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
		})
	}

	/** Drop VTIMEZONEs no property's TZID references anymore — a re-zoned entry leaves its old one behind. */
	private static pruneTimezones(comp: ICAL.Component): void {
		const used = new Set(comp.getAllSubcomponents()
			.filter(candidate => candidate.name !== 'vtimezone')
			.flatMap(candidate => candidate.getAllProperties().map(property => property.getParameter('tzid')?.toString()))
			.filter((id): id is string => !!id))
		for (const vtimezone of comp.getAllSubcomponents('vtimezone')) {
			if (!used.has(vtimezone.getFirstPropertyValue('tzid')?.toString() ?? '')) {
				comp.removeSubcomponent(vtimezone)
			}
		}
	}

	/**
	 * Rewrite (or `append`) a date property in the entry's authoring `zone` (Entry.timeZone): an IANA
	 * id writes the instant as that zone's WALL CLOCK under a TZID, EMBEDDING the matching VTIMEZONE
	 * when the resource doesn't carry it yet ({@link timezoneIn}); FLOATING writes a bare local time
	 * (neither TZID nor `Z`); null or 'UTC' (the same fixed-instant semantics — RFC 5545 §3.3.5 says a
	 * UTC time is written in its `Z` form, never under a TZID) and all-day go through
	 * {@link toICALTime}. Omitting `zone` entirely PRESERVES the property's own authored form — its
	 * current TZID, resolved only against embedded definitions, never fabricated — for rewrites that
	 * don't re-author the zone. Writing the UTC form into a TZID property — the old behavior — let the
	 * zone reinterpret the UTC wall clock, shifting the series by the zone offset on zoned servers
	 * like Google.
	 */
	private static writeDate(
		comp: ICAL.Component, component: ICAL.Component, name: string,
		date: Date, allDay: boolean,
		options?: { zone?: string | null, append?: boolean },
	): void {
		const authored = options !== undefined && 'zone' in options
		const zone = authored ? options!.zone ?? null : component.getFirstProperty(name)?.getParameter('tzid')?.toString() ?? null
		const timezone = allDay || !zone || zone === FLOATING_TIME_ZONE || zone === 'UTC'
			? undefined
			: CalDAV.timezoneIn(comp, zone, authored, date.getUTCFullYear())
		const time = timezone
			? ICAL.Time.fromJSDate(date, true).convertToZone(timezone)
			: authored && !allDay && options!.zone === FLOATING_TIME_ZONE
				? CalDAV.floatingTime(date)
				: CalDAV.toICALTime(date, allDay)
		const property = options?.append ? component.addPropertyWithValue(name, time) : component.updatePropertyWithValue(name, time)
		if (timezone) {
			property.setParameter('tzid', timezone.tzid)
		} else {
			property.removeParameter('tzid')
		}
	}

	/** The subcomponent a ROW represents within its resource: an override row owns the component
	 * carrying its RECURRENCE-ID, a master (or plain) row the one without — a series and its
	 * single-occurrence overrides share one resource (RFC 4791: one UID per resource). */
	protected static componentFor(entry: Entry, comp: ICAL.Component): ICAL.Component | undefined {
		return [...comp.getAllSubcomponents('vevent'), ...comp.getAllSubcomponents('vtodo')]
			.find(component => CalDAV.recurrenceProps(component).recurrenceId?.getTime() === CalDAV.instantOf(entry.recurrenceId))
	}

	/** Mirror a successful resource write onto the resource's OTHER rows (a master and its overrides
	 * each carry their own copy of `raw`/`etag`), so none is left holding a stale If-Match etag. */
	private static async syncResourceRows(em: EntityManager, written: Entry): Promise<void> {
		for (const sibling of await em.find(Entry, { sourceId: written.sourceId, uri: written.uri, id: { $ne: written.id } })) {
			sibling.data = { ...sibling.data, raw: written.data?.raw, etag: written.data?.etag }
		}
	}

	/** The recurrence info off a parsed VEVENT/VTODO: the master's rule (as a `Recurrence` value object), the
	 * shared UID, and a RECURRENCE-ID when the component is a single-occurrence override. */
	static recurrenceProps(component: ICAL.Component): { uid?: string, recurrence?: Recurrence, recurrenceId?: Date } {
		const rrule = component.getFirstPropertyValue('rrule')?.toString() || undefined
		return {
			uid: component.getFirstPropertyValue('uid')?.toString() || undefined,
			recurrence: Recurrence.fromRRule(rrule),
			recurrenceId: CalDAV.instantFrom(
				component.getFirstPropertyValue('recurrence-id') as ICAL.Time | null,
				component.getFirstProperty('recurrence-id')?.getParameter('tzid')?.toString(),
			) || undefined,
		}
	}

	/** The entry's reminders (minutes before start) off its VALARMs. Only what mitra manages maps to our
	 * model: EMAIL alarms are another channel entirely (out of scope — parsing them while only DISPLAY
	 * ones are written back would make them undeletable), and absolute (`VALUE=DATE-TIME`), end-relative
	 * (`RELATED=END`) and after-start triggers are left where they are — present in the raw .ics,
	 * invisible here. */
	static remindersFrom(component: ICAL.Component): Array<number> | null {
		const minutes = component.getAllSubcomponents('valarm').flatMap(alarm => {
			const trigger = alarm.getFirstProperty('trigger')
			const duration = trigger?.getFirstValue() as { toSeconds?(): number } | null
			if (
				alarm.getFirstPropertyValue('action')?.toString().toUpperCase() === 'EMAIL'
				|| !trigger || typeof duration?.toSeconds !== 'function'
				|| trigger.getParameter('related')?.toString().toUpperCase() === 'END'
			) {
				return []
			}
			const seconds = duration.toSeconds()
			return seconds > 0 ? [] : [Math.round(-seconds / 60)]
		})
		// `null`, not undefined, for "none" — the canonical no-reminders value everywhere (see Entry).
		return minutes.length ? [...new Set(minutes)].sort((a, b) => a - b) : null
	}

	// --- Participants (RFC 5545 ATTENDEE / ORGANIZER) ---------------------------------------------------

	/** mitra ParticipantRole ↔ ATTENDEE;ROLE (RFC 5545 §3.2.16). */
	private static readonly icalRole = new BidirectionalMap<ParticipantRole, string>([
		[ParticipantRole.Chair, 'CHAIR'],
		[ParticipantRole.Required, 'REQ-PARTICIPANT'],
		[ParticipantRole.Optional, 'OPT-PARTICIPANT'],
		[ParticipantRole.NonParticipant, 'NON-PARTICIPANT'],
	])

	/** mitra ParticipantStatus ↔ ATTENDEE;PARTSTAT (RFC 5545 §3.2.12). */
	private static readonly icalPartStat = new BidirectionalMap<ParticipantStatus, string>([
		[ParticipantStatus.NeedsAction, 'NEEDS-ACTION'],
		[ParticipantStatus.Accepted, 'ACCEPTED'],
		[ParticipantStatus.Declined, 'DECLINED'],
		[ParticipantStatus.Tentative, 'TENTATIVE'],
		[ParticipantStatus.Delegated, 'DELEGATED'],
	])

	/** The e-mail of a CAL-ADDRESS value (`mailto:a@b`, scheme case-insensitive). Non-mailto addresses
	 * (urn:uuid resources etc.) pass through as-is and get dropped by the e-mail normalization. */
	private static calAddressEmail(value: string | null | undefined): string | undefined {
		return value?.toString().trim().replace(/^mailto:/i, '') || undefined
	}

	/**
	 * The entry's participants off its ATTENDEE/ORGANIZER properties, normalized (see Participant.ts).
	 * The organizer joins the list (`organizer: true`) — merged with its own ATTENDEE when it is also
	 * one (Google-style .ics) — and `addresses` (the account's own, see {@link discoverAddresses})
	 * stamp `self`. Rooms and resources (CUTYPE) aren't people and are skipped.
	 */
	static participantsFrom(component: ICAL.Component, addresses?: ReadonlyArray<string> | null): Participants | null {
		const own = new Set((addresses ?? []).map(address => address.toLowerCase()))
		const self = (email: string) => own.has(email.toLowerCase()) || undefined
		const raw = new Array<Partial<Participant>>()
		const organizerProperty = component.getFirstProperty('organizer')
		const organizerEmail = CalDAV.calAddressEmail(organizerProperty?.getFirstValue()?.toString())
		if (organizerEmail) {
			raw.push({
				email: organizerEmail,
				name: organizerProperty?.getParameter('cn')?.toString(),
				organizer: true,
				// ORGANIZER carries no PARTSTAT — authoring the event counts as a yes (an ATTENDEE of the
				// same address, when present, overrides this with its actual reply).
				status: ParticipantStatus.Accepted,
				self: self(organizerEmail),
			})
		}
		for (const property of component.getAllProperties('attendee')) {
			const email = CalDAV.calAddressEmail(property.getFirstValue()?.toString())
			const kind = property.getParameter('cutype')?.toString().toUpperCase()
			if (!email || kind === 'ROOM' || kind === 'RESOURCE') {
				continue
			}
			raw.push({
				email,
				name: property.getParameter('cn')?.toString(),
				role: CalDAV.icalRole.getKey(property.getParameter('role')?.toString().toUpperCase() ?? ''),
				status: CalDAV.icalPartStat.getKey(property.getParameter('partstat')?.toString().toUpperCase() ?? ''),
				self: self(email),
			})
		}
		return Participants.normalize(raw)
	}

	/**
	 * Write the participant list back: the ATTENDEE properties are wholly ours (rewritten from the
	 * list, organizer included — RSVP requested while a reply is pending), while ORGANIZER only ever
	 * *appears* with the list's organizer (the entry became group-scheduled) or *disappears* with the
	 * last participant — an existing one is never rewritten, since iTIP (RFC 5546) reserves list
	 * changes for the organizer themselves and the route rejects everyone else's before this runs.
	 *
	 * Notifying the invitees is deliberately NOT ours: a scheduling server (RFC 6638) is the
	 * scheduling agent for every ATTENDEE we write, and mails the invitations and cancellations out
	 * itself. We only ever say WHO is invited.
	 */
	static writeParticipants(component: ICAL.Component, raw: ReadonlyArray<Participant> | null) {
		component.removeAllProperties('attendee')
		// Whatever the caller holds re-enters the domain here, so the written properties are always
		// the canonical reading of the list (dedupe, ≤ 1 organizer, explicit defaults).
		const participants = Participants.normalize(raw)
		if (!participants) {
			component.removeAllProperties('organizer')
			return
		}
		const organizer = participants.organizer
		if (organizer && !component.getFirstProperty('organizer')) {
			const property = component.addPropertyWithValue('organizer', `mailto:${organizer.email}`)
			if (organizer.name) {
				property.setParameter('cn', organizer.name)
			}
		}
		for (const participant of participants) {
			const property = component.addPropertyWithValue('attendee', `mailto:${participant.email}`)
			if (participant.name) {
				property.setParameter('cn', participant.name)
			}
			property.setParameter('role', CalDAV.icalRole.get(participant.role ?? ParticipantRole.Required)!)
			const status = participant.status ?? ParticipantStatus.NeedsAction
			property.setParameter('partstat', CalDAV.icalPartStat.get(status)!)
			if (status === ParticipantStatus.NeedsAction) {
				property.setParameter('rsvp', 'TRUE')
			}
		}
	}

	// --- Relationships (RFC 5545 RELATED-TO) -------------------------------------------------------------

	/** The entry's outgoing relationships off its RELATED-TO properties (RFC 5545 §3.8.4.5) — the
	 * CalDAV mapping of the neutral vocabulary is the identity function (see shared/Relation.ts).
	 * EVERY RELTYPE is kept verbatim — a missing one means PARENT (RFC 5545 §3.2.15), foreign
	 * directions/`X-` extensions stay opaque — plus the RFC 9253 GAP duration, so a wholesale
	 * rewrite ({@link writeRelations}) can never lose another client's data. `null` for "none". */
	static relationsFrom(component: ICAL.Component): Array<Relation> | null {
		return Relation.normalize(component.getAllProperties('related-to').map(property => ({
			type: property.getParameter('reltype')?.toString() || RelationType.Parent,
			targetUid: property.getFirstValue()?.toString() ?? '',
			gap: property.getParameter('gap')?.toString() || null,
		})))
	}

	/** Bring the component's RELATED-TO lines in line with `relations` by DIFF, never wholesale:
	 * a line whose parsed (type, target, gap) triple the list still contains is left VERBATIM —
	 * the model doesn't carry parameters beyond RELTYPE/GAP (VALUE=URI, X-…, LANGUAGE), so
	 * rewriting an untouched line would destroy another client's data. Only lines the user
	 * actually removed disappear; added ones are appended with an explicit RELTYPE (even the
	 * default PARENT, so each line is self-describing) plus GAP when set. */
	private writeRelations(component: ICAL.Component, relations: Array<Relation> | undefined | null) {
		// The identity triple, normalized exactly like relationsFrom → Relation.normalize reads it,
		// so a parsed line and its model counterpart always produce the same key.
		const keyOf = (relation: { type: RelationType | string, targetUid: string, gap: string | null }) => `${RelationType.of(relation.type).value} ${relation.targetUid} ${relation.gap ?? ''}`
		const desired = new Map((relations ?? []).map(relation => [keyOf(relation), relation]))
		const kept = new Set<string>()
		for (const property of component.getAllProperties('related-to')) {
			const key = keyOf({
				type: property.getParameter('reltype')?.toString().trim().toUpperCase() || RelationType.Parent.value,
				targetUid: property.getFirstValue()?.toString().trim() ?? '',
				gap: property.getParameter('gap')?.toString().trim() || null,
			})
			if (desired.has(key) && !kept.has(key)) {
				kept.add(key) // untouched — foreign parameters and all
			} else {
				component.removeProperty(property) // removed by the user (or a duplicate of a kept line)
			}
		}
		for (const [key, relation] of desired) {
			if (!kept.has(key)) {
				const property = component.addPropertyWithValue('related-to', relation.targetUid)
				property.setParameter('reltype', relation.type.value)
				!relation.gap ? void 0 : property.setParameter('gap', relation.gap)
			}
		}
	}

	/** Replace the component's DISPLAY alarms with one per reminder. DISPLAY only — an EMAIL alarm
	 * another client authored is its own channel, not ours to rewrite. */
	private writeReminders(component: ICAL.Component, reminders: Array<number> | undefined | null) {
		for (const alarm of component.getAllSubcomponents('valarm')) {
			if (alarm.getFirstPropertyValue('action')?.toString().toUpperCase() !== 'EMAIL') {
				component.removeSubcomponent(alarm)
			}
		}
		for (const minutes of reminders ?? []) {
			const alarm = new ICAL.Component('valarm')
			alarm.updatePropertyWithValue('action', 'DISPLAY')
			alarm.updatePropertyWithValue('description', 'Reminder')
			alarm.updatePropertyWithValue('trigger', ICAL.Duration.fromSeconds(-minutes * 60))
			component.addSubcomponent(alarm)
		}
	}

	/** Fetch the changed members' iCalendar bodies, tolerant of ones that vanish between the
	 * sync-collection listing and this multiget. tsdav's `fetchCalendarObjects` runs a single
	 * `calendar-multiget` REPORT and throws if ANY member response is ≥ 400 — so one stale href (Google
	 * reports a since-deleted or momentarily-unresolvable member with a per-href 404, especially on an
	 * incremental delta) would abort the whole source's sync. Worse, the abort happens before the caller
	 * flushes the advanced sync token, so the very same delta is retried forever. We therefore try the
	 * batch first (the fast path, one request) and, only if it throws, fall back to fetching each object
	 * on its own and dropping the ones that are gone — the sync then completes and the token advances. */
	private async fetchObjects(
		client: Awaited<ReturnType<typeof createDAVClient>>,
		calendar: { url: string },
		objectUrls: Array<string>,
	): Promise<Awaited<ReturnType<typeof client.fetchCalendarObjects>>> {
		try {
			return await client.fetchCalendarObjects({ calendar, objectUrls })
		} catch (error) {
			logger.warn(`Multiget of ${objectUrls.length} object(s) from ${calendar.url} failed (${error instanceof Error ? error.message : error}); refetching individually and skipping any that are gone`)
			const objects: Awaited<ReturnType<typeof client.fetchCalendarObjects>> = []
			let skipped = 0
			for (const url of objectUrls) {
				try {
					objects.push(...await client.fetchCalendarObjects({ calendar, objectUrls: [url] }))
				} catch {
					// Gone between listing and fetch (or otherwise unfetchable) — skip it. A later
					// re-import (or a subsequent sync-collection that reports it as removed) reconciles it.
					skipped++
					logger.debug(`Skipped unfetchable object ${url}`)
				}
			}
			logger.debug(`Refetch recovered ${objects.length} object(s), skipped ${skipped}`)
			return objects
		}
	}

	protected override async syncSourceEntries(em: EntityManager, source: Source): Promise<boolean> {
		const client = await this.getClient()
		const remoteCalendar = { url: source.uri }
		const result = await client.syncCollection({
			url: source.uri,
			props: { 'd:getetag': {} },
			syncLevel: 1,
			syncToken: source.syncState?.syncToken || undefined
		})

		const newSyncToken = result[0]?.raw?.multistatus?.syncToken || source.syncState?.syncToken

		// Existing entries are looked up by foreign key, never populated.
		const existingEntries = await em.find(Entry, { sourceId: source.id })

		// syncCollection returns one response per member href, of every component type (VEVENT, VTODO, …)
		// — unlike fetchCalendarObjects({ calendar }), which only returns events. With no prior token it
		// lists the whole collection; incrementally, just the changed/removed members. Hrefs are resolved
		// to full URLs here so the changed set is fetchable and both sets compare against stored uris.
		const { changedUrls, deletedUrls } = CalDAV.partitionMemberResponses(source.uri, result)

		const changedObjects = changedUrls.length
			? await this.fetchObjects(client, remoteCalendar, changedUrls)
			: []

		// On a full sync (no prior token) every current member is listed, so any local entry that's
		// no longer present was removed remotely.
		if (!source.syncState?.syncToken) {
			const remoteUris = new Set(changedUrls) // already resolved to full URLs
			for (const entry of existingEntries) {
				const entryUrl = CalDAV.resolveMemberUrl(source.uri, entry.uri)
				if (entryUrl && !remoteUris.has(entryUrl)) {
					deletedUrls.push(entryUrl)
				}
			}
		}

		// Report whether any actual entry changed. The sync-token bookkeeping must NOT count, or the
		// background sync would notify clients every cycle (clobbering in-progress edits).
		let changed = false

		// 1. Handle deletions — a deleted resource takes ALL its rows (a series' master + overrides).
		for (const url of deletedUrls) {
			for (const entry of existingEntries.filter(e => CalDAV.memberUrlsMatch(source.uri, e.uri, url))) {
				em.remove(entry)
				changed = true
			}
		}

		// 2. Handle changes/additions — every component the collection can hold lands in this one source
		// (its `entryTypes` only says what may be CREATED here); components we don't model (VJOURNAL &
		// co) are skipped, so we never persist an entry without the required `uri`, which would otherwise
		// abort the whole sync's flush.
		for (const obj of changedObjects) {
			if (!obj.data) {
				continue
			}

			// A resource holds ONE scheduling entity (RFC 4791: one UID per resource) but possibly MANY
			// components: the series master plus one override VEVENT per edited occurrence — that's how
			// Google (and every compliant server) ships single-occurrence edits. Each component becomes
			// its own row, identified within the resource by its RECURRENCE-ID (the master has none).
			// Both modelled types are read; RFC 4791 §4.1 forbids MIXING component types within one
			// resource, so a resource's rows are always single-type and the (source, uri, recurrenceId)
			// identity below stays unambiguous.
			const comp = new ICAL.Component(ICAL.parse(obj.data))
			const components = ['vevent', 'vtodo'].flatMap(name => comp.getAllSubcomponents(name))
			if (!components.length) {
				continue
			}

			const normalizedObjUrl = CalDAV.resolveMemberUrl(source.uri, obj.url)
			const rows = existingEntries.filter(e => CalDAV.memberUrlsMatch(source.uri, e.uri, obj.url))

			// The etag is per-resource: unchanged means every row is already in step.
			if (rows.length && rows.every(row => row.data?.etag === obj.etag)) {
				continue
			}

			const kept = new Set<Entry>()
			for (const component of components) {
				// The component IS the type — VTODO or VEVENT, per resource (see above).
				const entryType = component.name === 'vtodo' ? EntryType.Task : EntryType.Event
				// Recurrence: a master carries an RRULE; a single edited occurrence is its own component
				// carrying a RECURRENCE-ID and the shared UID. Occurrences are expanded later, on read.
				const recurrence = CalDAV.recurrenceProps(component)
				let entry = rows.find(row => CalDAV.instantOf(row.recurrenceId) === recurrence.recurrenceId?.getTime())
				if (!entry) {
					entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: normalizedObjUrl })
					em.persist(entry)
					existingEntries.push(entry)
					rows.push(entry)
				}
				kept.add(entry)

				entry.type = entryType
				entry.color = component.getFirstPropertyValue('color')?.toString() || null
				entry.data ??= {}
				entry.data.raw = obj.data
				entry.data.etag = obj.etag

				// Each property's own TZID rides into the decode ({@link instantFrom}), so a zoned value
				// resolves through Temporal — VTIMEZONE or not; an end without its own form follows the start's.
				const tzidOf = (name: string) => component.getFirstProperty(name)?.getParameter('tzid')?.toString()
				if (entryType.isEvent) {
					const event = new ICAL.Event(component)
					entry.heading = event.summary || 'Untitled Event'
					entry.description = event.description || ''
					entry.location = event.location || ''
					entry.start = CalDAV.instantFrom(event.startDate, tzidOf('dtstart')) as any || undefined
					entry.end = CalDAV.instantFrom(event.endDate ?? event.startDate, tzidOf('dtend') ?? tzidOf('dtstart')) as any || undefined
					// A date-only DTSTART (`VALUE=DATE`) is the iCalendar marker for an all-day event.
					entry.allDay = event.startDate?.isDate ?? false
					// Free/busy is the event's alone (see Entry.transparency); a VTODO has no TRANSP.
					entry.transparency = CalDAV.transparencyFromICal(component.getFirstPropertyValue('transp')?.toString())
				} else {
					const value = (name: string) => component.getFirstPropertyValue(name) as any
					entry.heading = value('summary')?.toString() || 'Untitled Task'
					entry.description = value('description')?.toString() || ''
					entry.location = value('location')?.toString() || ''
					entry.status = CalDAV.statusFromICal(value('status')?.toString(), Number(value('percent-complete') ?? 0))
					entry.start = CalDAV.instantFrom(value('dtstart'), tzidOf('dtstart')) as any || undefined
					entry.end = CalDAV.instantFrom(value('due'), tzidOf('due') ?? tzidOf('dtstart')) as any || undefined
					entry.allDay = !!value('dtstart')?.isDate
				}

				// CLASS rides on both component kinds, so it is read outside the branches above.
				entry.visibility = CalDAV.visibilityFromICal(component.getFirstPropertyValue('class')?.toString())

				entry.reminders = CalDAV.remindersFrom(component)
				entry.participants = CalDAV.participantsFrom(component, this.addresses)
				// A DEFINITE value (array or null): RELATED-TO is native here, so the parse is
				// authoritative and the reconciliation below mirrors it into the relation store.
				entry.relations = CalDAV.relationsFrom(component)

				// The zone the entry's times were authored in (recurrence expands wall-clock in it — see
				// backend/occurrences.ts): DTSTART's TZID where a client wrote one. A UTC DTSTART carries no
				// TZID — a legitimate none; a bare local DTSTART (neither TZID nor `Z`) is a FLOATING time,
				// kept under its reserved marker so an edit writes it back as floating rather than silently
				// pinning another client's wall clock to UTC.
				// Only a Temporal-resolvable id is stored — a non-IANA TZID (a Microsoft zone name, say)
				// would throw on every wall-clock expansion; left null, the series expands at its stored
				// fixed instants instead (deterministic, and exactly what the resolved instants encode).
				const dtstartTzid = tzidOf('dtstart')
				entry.timeZone = CalDAV.resolvableZone(dtstartTzid) ? dtstartTzid
					: CalDAV.isFloating(component.getFirstPropertyValue('dtstart')) ? FLOATING_TIME_ZONE : null

				entry.uid = recurrence.uid
				entry.recurrence = recurrence.recurrence
				entry.recurrenceId = recurrence.recurrenceId as any

				changed = true
			}

			// An override component that vanished (the occurrence was reverted to the series) loses its row.
			for (const row of rows) {
				if (!kept.has(row)) {
					em.remove(row)
					changed = true
				}
			}
		}

		// Link each override row (a single edited occurrence) back to its series master by shared UID. Done
		// after the loop since members arrive in any order; idempotent (only fills an unset link).
		for (const entry of existingEntries) {
			if (entry.recurrenceId && entry.uid && !entry.recurrenceMasterId) {
				const master = existingEntries.find(other => other.recurrence && !other.recurrenceId && other.uid === entry.uid)
				if (master) {
					entry.recurrenceMasterId = master.id
					changed = true
				}
			}
		}

		// Mirror the re-parsed entries' relationships into the queryable store (entries untouched
		// this cycle carry `undefined` and are skipped; a removed entry's rows cascade with it).
		await this.reconcileRelations(em, existingEntries)

		source.syncState = { syncToken: newSyncToken }

		logger.debug(`Synced "${source.name}": ${changedObjects.length} fetched, ${deletedUrls.length} deleted${changed ? '' : ' (no local changes)'}`)
		return changed
	}

	/** A failed write as a throwable error carrying the server's own explanation — servers put the
	 * REASON in the response body (Radicale, e.g., names the exact parse/validation complaint there),
	 * and "412 Precondition Failed" alone leaves a production log with nothing to act on. */
	private static async writeError(operation: string, response: { status: number, statusText: string, text?: () => Promise<string> }): Promise<Error> {
		const detail = (await response.text?.().catch(() => ''))?.trim().slice(0, 500)
		return new Error(`CalDAV ${operation} failed: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ''}`)
	}

	/** The freshest copy of the entry's resource — the base for a concurrency retry. */
	private async refetchResource(entry: Entry): Promise<{ raw: string, etag?: string } | undefined> {
		const client = await this.getClient()
		const objects = await client.fetchCalendarObjects({ calendar: { url: new URL('.', entry.uri).href }, objectUrls: [entry.uri!] })
		return objects[0]?.data ? { raw: objects[0].data, etag: objects[0].etag || undefined } : undefined
	}

	/**
	 * PUT the resource with the edit `applyTo` produces from a raw .ics, retrying ONCE on a 412 by
	 * re-applying the same edit onto the refetched current resource. Google acknowledges a write and
	 * then re-normalizes the resource asynchronously, bumping the etag AGAIN — so a second edit
	 * within a sync cycle carries a stale If-Match and would fail spuriously. The refresh keeps the
	 * guard's meaning for real conflicts: another client's concurrent change simply becomes the base
	 * the field edit re-applies onto (the same merge any edit performs), and a second 412 propagates
	 * — something is actively racing us. On success the entry's `raw`/`etag` are updated in place;
	 * a non-2xx throws BEFORE the route flushes, so the in-memory edit reverts (per-request fork).
	 */
	private async writeResource(entry: Entry, applyTo: (raw: string) => string): Promise<void> {
		const client = await this.getClient()
		let data = applyTo(entry.data!.raw!)
		let response = await client.updateCalendarObject({
			calendarObject: { url: entry.uri!, data, etag: entry.data!.etag || undefined }
		})
		if (response.status === 412) {
			const fresh = await this.refetchResource(entry)
			if (fresh) {
				logger.debug(`Etag of ${entry.uri} was stale (the server re-normalized the resource) — re-applying the edit onto the refreshed copy`)
				data = applyTo(fresh.raw)
				response = await client.updateCalendarObject({
					calendarObject: { url: entry.uri!, data, etag: fresh.etag }
				})
			}
		}
		// tsdav returns the raw fetch Response and does NOT throw on a non-2xx.
		if (response.ok === false) {
			throw await CalDAV.writeError('update', response)
		}
		entry.data!.raw = data
		const etag = response.headers?.get('etag') || response.headers?.get('Etag') || response.headers?.get('ETag')
		if (etag) {
			entry.data!.etag = etag
		}
	}

	async updateEntry(em: EntityManager, existing: Entry, incoming: Entry): Promise<void> {
		if (!existing.uri || !existing.data?.raw) {
			throw new Error('Entry must have a URL and raw data to be updated via CalDAV')
		}

		const keys: Array<keyof Entry> = (['heading', 'description', 'location', 'color', 'start', 'end', 'status', 'transparency', 'visibility', 'allDay', 'timeZone', 'reminders', 'participants'] as const)
			.filter(key => !Object[equals](existing[key], incoming[key]))

		// The recurrence rule is a value object, diffed via its own (absence-safe) structural equality.
		const recurrenceChanged = !Recurrence.equal(existing.recurrence, incoming.recurrence)

		// Relations are tri-state like `recurrence` (undefined = keep) and compare by their own value
		// semantics; the caller populated `existing.relations` from the store (see entries.ts PUT).
		const relationsChanged = incoming.relations !== undefined && !Relation.listEquals(existing.relations ?? null, incoming.relations)

		if (keys.length === 0 && !recurrenceChanged && incoming.exdates === undefined && !relationsChanged) {
			return
		}

		// A series-wide time shift moves every occurrence instant — including the ones the resource's
		// bundled override components are anchored to (shifted below): computed up front, BEFORE the
		// field mutations overwrite `existing.start`, and because `applyTo` may run twice (412 retry).
		const overrideShift = keys.includes('start') && existing.recurrence && existing.start && incoming.start
			? incoming.start.getTime() - existing.start.getTime()
			: undefined

		// The whole edit as a pure raw → raw transformation, so a concurrency retry can re-apply it
		// onto a refreshed resource. The `existing.*` field assignments are idempotent.
		const applyTo = (raw: string): string => {
			const comp = new ICAL.Component(ICAL.parse(raw))

			// Never the FIRST component: the resource may bundle the series master with override
			// components (see syncSourceEntries) — this row's edit must land on ITS component.
			const component = CalDAV.componentFor(existing, comp)
			if (!component) {
				throw new Error('No vevent or vtodo found in entry rawData')
			}
			const isTask = component.name === 'vtodo'

			if (keys.includes('heading')) {
				component.updatePropertyWithValue('summary', incoming.heading)
				existing.heading = incoming.heading
			}

			if (keys.includes('description')) {
				component.updatePropertyWithValue('description', incoming.description)
				// Drop any HTML alternative (ALTREP) a prior client wrote, so our plain (markdown)
				// value is authoritative — otherwise other viewers keep showing the stale HTML.
				component.getFirstProperty('description')?.removeParameter('altrep')
				existing.description = incoming.description
			}

			if (keys.includes('location')) {
				if (incoming.location) {
					component.updatePropertyWithValue('location', incoming.location)
				} else {
					component.removeProperty('location')
				}
				existing.location = incoming.location
			}

			if (keys.includes('color')) {
				if (incoming.color) {
					component.updatePropertyWithValue('color', incoming.color)
				} else {
					component.removeProperty('color')
				}
				existing.color = incoming.color
			}

			// Shift the bundled override components' RECURRENCE-IDs along with the series, or they
			// orphan and the expansion renders BOTH the shifted occurrence and the override. The
			// overrides' OWN times stay put — a custom-timed exception keeps its custom time.
			if (overrideShift !== undefined) {
				for (const sub of [...comp.getAllSubcomponents('vevent'), ...comp.getAllSubcomponents('vtodo')]) {
					const rid = CalDAV.recurrenceProps(sub).recurrenceId
					if (rid) {
						// The RECURRENCE-ID must match the series' authored form (the master's zone).
						CalDAV.writeDate(comp, sub, 'recurrence-id', new Date(rid.getTime() + overrideShift), false, { zone: incoming.timeZone })
					}
				}
			}

			// All-day toggling flips DTSTART/DTEND between date-only and timed, and a zone change rewrites
			// their TZID + local representation — so a change to `allDay` OR `timeZone` rewrites both date
			// properties too (even where the instants themselves didn't move). Both follow the entry's
			// authoring zone, so DTEND automatically matches DTSTART's form.
			const spanChanged = keys.includes('start') || keys.includes('end') || keys.includes('allDay') || keys.includes('timeZone')
			if (spanChanged && incoming.start) {
				CalDAV.writeDate(comp, component, 'dtstart', incoming.start, incoming.allDay, { zone: incoming.timeZone })
			}

			// A VTODO's end is DUE (RFC 5545 §3.8.2.3), a VEVENT's is DTEND — matching how sync reads each back.
			if (spanChanged && incoming.end) {
				CalDAV.writeDate(comp, component, isTask ? 'due' : 'dtend', incoming.end, incoming.allDay, { zone: incoming.timeZone })
			}

			if (isTask && keys.includes('status')) {
				this.writeTaskStatus(component, incoming.status)
				existing.status = incoming.status
			}

			// Event-only, guarded like `status` is task-only: the two are mirror images (see Entry's
			// `type` setter), and a type flip never reaches here anyway — it re-creates the resource.
			if (!isTask && keys.includes('transparency')) {
				CalDAV.writeTransparency(component, incoming.transparency)
				existing.transparency = incoming.transparency
			}

			if (keys.includes('visibility')) {
				CalDAV.writeVisibility(component, incoming.visibility)
				existing.visibility = incoming.visibility
			}

			if (keys.includes('reminders')) {
				this.writeReminders(component, incoming.reminders)
				existing.reminders = incoming.reminders
			}

			// iTIP list changes are the organizer's (the route rejects everyone else before this runs);
			// the ATTENDEEs are rewritten wholesale, ORGANIZER only added/removed (see writeParticipants).
			if (keys.includes('participants')) {
				CalDAV.writeParticipants(component, incoming.participants ?? null)
				existing.participants = incoming.participants
			}

			// Wholesale and idempotent (the 412 retry may run this twice) — losslessness comes from
			// the model carrying every parsed RELTYPE opaquely, see writeRelations.
			if (relationsChanged) {
				this.writeRelations(component, incoming.relations)
			}

			// Recurrence rule edits are series-wide: set/replace the master's RRULE, or drop it (and the EXDATEs it
			// governed) to collapse the series back to a single entry. Keep the local recurrence/uid columns in step
			// so the next GET expansion sees the change before a re-sync, and so overrides can still link by UID.
			if (recurrenceChanged) {
				if (incoming.recurrence) {
					component.updatePropertyWithValue('rrule', ICAL.Recur.fromString(incoming.recurrence.toRRule(incoming.allDay)))
					existing.uid ||= component.getFirstPropertyValue('uid')?.toString() || undefined
				} else {
					component.removeAllProperties('rrule')
					component.removeAllProperties('exdate')
				}
			}

			// Exclusions ride along only when the edit actually carries them — a scoped series edit shifting
			// them with the series (see backend/occurrences.ts); absent means keep, like `recurrence` on the
			// wire. Rewritten wholesale: the instants ARE the identity, so there's nothing to diff per-item.
			if (incoming.exdates !== undefined) {
				// EXDATEs follow DTSTART's authored form — the entry's zone (RFC 5545 matches instances by it).
				component.removeAllProperties('exdate')
				for (const ms of incoming.exdates) {
					CalDAV.writeDate(comp, component, 'exdate', new Date(ms), incoming.allDay, { zone: incoming.timeZone, append: true })
				}
			}

			// A re-zone leaves its previous VTIMEZONE unreferenced — drop any that no property points at.
			CalDAV.pruneTimezones(comp)
			return comp.toString()
		}

		await this.writeResource(existing, applyTo)

		// Mirror the committed edit onto the row's own columns (the schedule fields weren't set inside
		// `applyTo` — a retry recomputes from them) and shift the override ROWS with the series, once.
		if (keys.includes('start') && incoming.start) {
			existing.start = incoming.start
		}
		if (keys.includes('end') && incoming.end) {
			existing.end = incoming.end
		}
		if (keys.includes('allDay')) {
			existing.allDay = incoming.allDay
		}
		if (keys.includes('timeZone')) {
			existing.timeZone = incoming.timeZone
		}
		if (recurrenceChanged) {
			existing.recurrence = incoming.recurrence
		}
		if (relationsChanged) {
			existing.relations = incoming.relations ?? null
		}
		if (overrideShift !== undefined) {
			for (const override of await em.find(Entry, { recurrenceMasterId: existing.id })) {
				const instant = CalDAV.instantOf(override.recurrenceId)
				if (instant !== undefined) {
					override.recurrenceId = new Date(instant + overrideShift) as any
				}
			}
		}

		logger.debug(`Updated ${existing.uri} — changed: ${keys.length ? keys.join(', ') : 'recurrence/exdates'}`)
		logger.verbose(existing.data.raw)
		await CalDAV.syncResourceRows(em, existing)
	}

	async createEntry(em: EntityManager, entry: Entry): Promise<Entry> {
		const source = entry.sourceId ? await em.findOne(Source, { id: entry.sourceId }) : null
		if (!source?.uri) {
			throw new Error('A target source with a URL is required to create an entry via CalDAV')
		}

		// A cross-source migration re-creates the entry but keeps its identity: the carried uid keeps
		// every relationship pointing AT it (and its own outgoing lines) resolvable after the move.
		const uid = entry.uid || crypto.randomUUID()
		const filename = `${uid}.ics`

		const comp = new ICAL.Component(['vcalendar', [], []])
		comp.updatePropertyWithValue('prodid', '-//calendar//EN')
		comp.updatePropertyWithValue('version', '2.0')

		// A task is a VTODO (its end is DUE, completion is STATUS); anything else a VEVENT (end is DTEND).
		// The ENTRY's type decides, not the collection's — one collection may accept both (see
		// Source.entryTypes), and the route rejects a type the collection can't hold before we get here.
		const isTask = entry.type.isTask
		const component = new ICAL.Component(isTask ? 'vtodo' : 'vevent')
		component.updatePropertyWithValue('uid', uid)
		component.updatePropertyWithValue('dtstamp', ICAL.Time.now())
		component.updatePropertyWithValue('summary', entry.heading)
		!entry.description ? void 0 : component.updatePropertyWithValue('description', entry.description)
		!entry.location ? void 0 : component.updatePropertyWithValue('location', entry.location)
		// The span in the entry's authoring zone: local time + TZID (with the VTIMEZONE embedded on
		// `comp`) for an IANA zone, bare local for FLOATING, UTC / date-only otherwise (see writeDate).
		!entry.start ? void 0 : CalDAV.writeDate(comp, component, 'dtstart', entry.start, entry.allDay, { zone: entry.timeZone })
		!entry.end ? void 0 : CalDAV.writeDate(comp, component, isTask ? 'due' : 'dtend', entry.end, entry.allDay, { zone: entry.timeZone })
		!entry.color ? void 0 : component.updatePropertyWithValue('color', entry.color)
		!entry.recurrence ? void 0 : component.updatePropertyWithValue('rrule', ICAL.Recur.fromString(entry.recurrence.toRRule(entry.allDay)))
		// The continuation of a split series carries its half of the exclusions (see backend/occurrences.ts).
		entry.exdates?.forEach(ms => CalDAV.writeDate(comp, component, 'exdate', new Date(ms), entry.allDay, { zone: entry.timeZone, append: true }))
		if (isTask) {
			this.writeTaskStatus(component, entry.status)
		} else if (entry.transparency) {
			// Only when the entry actually names one: an absent TRANSP already means OPAQUE, so writing
			// it for a plain busy event would be a line that says nothing (see writeTransparency).
			CalDAV.writeTransparency(component, entry.transparency)
		}
		!entry.visibility ? void 0 : CalDAV.writeVisibility(component, entry.visibility)
		this.writeReminders(component, entry.reminders)
		if (entry.participants?.length) {
			CalDAV.writeParticipants(component, entry.participants)
		}
		this.writeRelations(component, entry.relations)

		comp.addSubcomponent(component)

		const iCalString = comp.toString()

		const client = await this.getClient()
		const response = await client.createCalendarObject({
			calendar: { url: source.uri },
			filename,
			iCalString,
		})

		// Abort before persisting locally if the server rejected the create (tsdav doesn't throw on non-2xx),
		// so we never keep a row pointing at an object the server never stored.
		if (response.ok === false) {
			throw await CalDAV.writeError('create', response)
		}
		logger.debug(`Created ${isTask ? 'VTODO' : 'VEVENT'} ${CalDAV.resolveMemberUrl(source.uri, filename)}`)
		logger.verbose(iCalString)

		entry.uri = CalDAV.resolveMemberUrl(source.uri, filename)
		entry.uid = uid // mirror the .ics UID onto the row, so a later edited occurrence can link back as an override
		entry.data ??= {}
		entry.data.raw = iCalString
		entry.color = entry.color || null
		const etag = response.headers?.get('etag') || response.headers?.get('Etag') || response.headers?.get('ETag')
		if (etag) {
			entry.data.etag = etag
		}

		em.persist(entry)
		return entry
	}

	async deleteEntry(em: EntityManager, entry: Entry): Promise<void> {
		// An override row SHARES its resource with the series master — deleting the resource would
		// delete the whole series. Deleting the override is "delete this occurrence": route it through
		// the master's exclusion (which also strips the override component and this row).
		if (entry.recurrenceId && entry.recurrenceMasterId) {
			const master = await em.findOne(Entry, { id: entry.recurrenceMasterId })
			if (master) {
				return this.excludeOccurrence(em, master, new Date(entry.recurrenceId))
			}
		}
		if (entry.uri) {
			const client = await this.getClient()
			let response = await client.deleteCalendarObject({
				calendarObject: {
					url: entry.uri,
					etag: entry.data?.etag || undefined,
				},
			})
			// The same stale-etag story as writeResource: refresh the etag once and retry.
			if (response.status === 412) {
				const fresh = await this.refetchResource(entry)
				response = await client.deleteCalendarObject({
					calendarObject: { url: entry.uri, etag: fresh?.etag }
				})
			}
			// A 404 means the resource is already gone — exactly what a delete wants.
			if (response.ok === false && response.status !== 404) {
				throw await CalDAV.writeError('delete', response)
			}
			logger.debug(`Deleted ${entry.uri}`)
		}
		em.remove(entry)
	}

	async excludeOccurrence(em: EntityManager, master: Entry, recurrenceId: Date): Promise<void> {
		if (!master.uri || !master.data?.raw) {
			throw new Error('Master must have a URL and raw data to exclude an occurrence via CalDAV')
		}

		// A pure raw → raw transformation, so the 412 retry can re-apply it (see writeResource).
		const applyTo = (raw: string): string => {
			const comp = new ICAL.Component(ICAL.parse(raw))
			const component = CalDAV.componentFor(master, comp)
			if (!component) {
				throw new Error('No vevent or vtodo found in master rawData')
			}

			// One EXDATE per excluded instant (matched by ms during expansion); value type AND authored
			// zone form follow DTSTART — the master's zone (RFC 5545 matches instances by it).
			CalDAV.writeDate(comp, component, 'exdate', recurrenceId, master.allDay, { zone: master.timeZone, append: true })

			// The instant may already carry an override component (an externally edited occurrence, bundled
			// in the same resource): EXDATE only prunes the recurrence SET — the override would keep the
			// instance alive on other clients — so it goes too, along with its local row (below).
			for (const sub of [...comp.getAllSubcomponents('vevent'), ...comp.getAllSubcomponents('vtodo')]) {
				if (CalDAV.recurrenceProps(sub).recurrenceId?.getTime() === recurrenceId.getTime()) {
					comp.removeSubcomponent(sub)
				}
			}

			return comp.toString()
		}

		await this.writeResource(master, applyTo)

		for (const override of await em.find(Entry, { recurrenceMasterId: master.id })) {
			if (CalDAV.instantOf(override.recurrenceId) === recurrenceId.getTime()) {
				em.remove(override)
			}
		}
		await CalDAV.syncResourceRows(em, master)
	}
}
