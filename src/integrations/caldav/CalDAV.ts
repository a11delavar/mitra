import { type EntityManager } from '@mikro-orm/sqlite'
import { converter } from '@a11d/converter'
import '@a11d/bidirectional-map' // registers the global BidirectionalMap the iCalendar mappings below use
import { type createDAVClient } from 'tsdav'
import ICAL from 'ical.js'
import { EntryRelations } from '../../features/relations/EntryRelations.js'
import { model } from '../../infrastructure/model/model.js'
import { buildVTimezone } from './vtimezone.js'
import { Integration, integration, withheld } from '../Integration.js'
import { Entry, TaskStatus, Transparency, Visibility, FLOATING_TIME_ZONE } from '../../features/entries/Entry.js'
import { EntryType } from '../../features/entries/EntryType.js'
import { Recurrence } from '../../features/recurrence/Recurrence.js'
import { Relation, type RelationInit } from '../../features/relations/Relation.js'
import { RelationType } from '../../features/relations/RelationType.js'
import { calendarDateOf, midnightOf } from '../../features/time/calendarDate.js'
import { Participants, ParticipantRole, ParticipantStatus, type Participant } from '../../features/participants/Participant.js'

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

	/**
	 * The memo slot for the sync engine's live tsdav connection — transient, not state. `out: {}` is how
	 * a member says "never serialized": the API's shape is the domain's, and a socket (holding this
	 * account's credentials) is not part of it. Declaring it here rather than letting the engine attach
	 * it dynamically is what keeps that guard — an UNDECLARED property has no converter opting it out,
	 * so it would ride onto the wire with its credentials intact.
	 *
	 * The type reference is erased (`import type` above), so declaring it costs the browser bundle
	 * nothing — which is the whole reason the engine itself lives server-side.
	 *
	 * Public, unlike {@link ../notion/Notion.js}'s equivalent, because CalDAV's engine is a separate
	 * collaborator rather than the class's own methods.
	 */
	@converter({ out: {} }) client?: ReturnType<typeof createDAVClient>

	/** The tsdav client configuration — the one thing a differently-authenticated provider
	 * (see GoogleCalendar's OAuth) swaps out; everything else about the protocol is shared. Public: the
	 * sync engine ({@link ./server/CalDAVSyncEngine.js}) is a separate collaborator that builds its
	 * client from this, not a subclass sharing `this`. */
	get clientParameters(): Parameters<typeof createDAVClient>[0] {
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
	 * with neither a `Z` suffix nor a TZID, which ical.js models as its zone-less "local" zone. Public:
	 * the sync engine reads it directly while parsing (see {@link ../server/CalDAVSyncEngine.js}). */
	static isFloating(value: unknown): boolean {
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

	/**
	 * Computes PERCENT-COMPLETE for iCalendar (RFC 5545 §3.8.1.8).
	 * Completed tasks are pinned to 100; unstated values (null/undefined) return undefined to omit the property.
	 */
	static percentCompleteForICal(status: TaskStatus | undefined, percentComplete: number | null | undefined): number | undefined {
		if ((status ?? TaskStatus.ToDo) === TaskStatus.Done) {
			return 100
		}
		return percentComplete === null || percentComplete === undefined ? undefined : Math.min(100, Math.max(0, Math.round(percentComplete)))
	}

	/** Writes STATUS, PERCENT-COMPLETE, and COMPLETED instant on a VTODO. Static (no `this` — nothing
	 * here is instance state) and public: the sync engine calls it while building/editing a resource. */
	static writeTaskStatus(component: ICAL.Component, status: TaskStatus | undefined, percentComplete: number | null | undefined) {
		const effective = status ?? TaskStatus.ToDo
		component.updatePropertyWithValue('status', CalDAV.icalTaskStatus.get(effective))
		const percent = CalDAV.percentCompleteForICal(effective, percentComplete)
		if (percent === undefined) {
			component.removeProperty('percent-complete')
		} else {
			component.updatePropertyWithValue('percent-complete', percent)
		}
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

	/** Write (or drop) TRANSP. Only ever called for a VEVENT — RFC 5545 gives VTODO no such property.
	 * Public: called from the sync engine's write path. */
	static writeTransparency(component: ICAL.Component, transparency: Transparency | null | undefined) {
		if (transparency) {
			component.updatePropertyWithValue('transp', CalDAV.icalTransparency.get(transparency)!)
		} else {
			component.removeProperty('transp')
		}
	}

	/** Write (or drop) CLASS. "Default visibility" is the ABSENCE of the property, which is what the
	 * calendar's own sharing settings then decide — so picking it removes the line rather than writing
	 * PUBLIC, which would be a different (and stronger) statement. Public (member, not the CLASS value):
	 * called from the sync engine's write path. */
	static writeVisibility(component: ICAL.Component, visibility: Visibility | null | undefined) {
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

	/** Drop VTIMEZONEs no property's TZID references anymore — a re-zoned entry leaves its old one behind.
	 * Public: called by the sync engine after it finishes editing a resource. */
	static pruneTimezones(comp: ICAL.Component): void {
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
	 *
	 * Public: the sync engine writes every date property through this.
	 */
	static writeDate(
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
	 * single-occurrence overrides share one resource (RFC 4791: one UID per resource). Public: the
	 * sync engine locates the row's component through this when applying an edit. */
	static componentFor(entry: Entry, comp: ICAL.Component): ICAL.Component | undefined {
		return [...comp.getAllSubcomponents('vevent'), ...comp.getAllSubcomponents('vtodo')]
			.find(component => CalDAV.recurrenceProps(component).recurrenceId?.getTime() === CalDAV.instantOf(entry.recurrenceId))
	}

	/** Mirror a successful resource write onto the resource's OTHER rows (a master and its overrides
	 * each carry their own copy of `raw`/`etag`), so none is left holding a stale If-Match etag. Public:
	 * the sync engine calls it after a write. */
	static async syncResourceRows(em: EntityManager, written: Entry): Promise<void> {
		for (const sibling of await em.find(Entry, { sourceId: written.sourceId, uri: written.uri, id: { $ne: written.id } })) {
			sibling.data = { ...sibling.data, raw: written.data?.raw, etag: written.data?.etag }
		}
	}

	/**
	 * Reads one parsed VEVENT/VTODO onto an entry, taking what it needs off the `integration`.
	 * Static rather than an instance method because a subscribed feed is not a CalDAV account: the two
	 * providers sharing this have no common ancestor below `Integration`, which knows no iCalendar.
	 */
	static applyComponent(entry: Entry, component: ICAL.Component, integration: Integration): void {
		// The component IS the type — RFC 4791 §4.1 forbids mixing them within one resource.
		const entryType = component.name === 'vtodo' ? EntryType.Task : EntryType.Event
		entry.type = entryType
		entry.color = component.getFirstPropertyValue('color')?.toString() || null

		const tzidOf = (name: string) => component.getFirstProperty(name)?.getParameter('tzid')?.toString()
		if (entryType.isEvent) {
			const event = new ICAL.Event(component)
			entry.heading = event.summary || 'Untitled Event'
			entry.description = event.description || ''
			entry.location = event.location || ''
			entry.start = CalDAV.instantFrom(event.startDate, tzidOf('dtstart')) as any || undefined
			entry.end = CalDAV.instantFrom(event.endDate ?? event.startDate, tzidOf('dtend') ?? tzidOf('dtstart')) as any || undefined
			entry.allDay = event.startDate?.isDate ?? false
			entry.transparency = CalDAV.transparencyFromICal(component.getFirstPropertyValue('transp')?.toString())
		} else {
			const value = (name: string) => component.getFirstPropertyValue(name) as any
			entry.heading = value('summary')?.toString() || 'Untitled Task'
			entry.description = value('description')?.toString() || ''
			entry.location = value('location')?.toString() || ''
			const percent = value('percent-complete')
			entry.status = CalDAV.statusFromICal(value('status')?.toString(), Number(percent ?? 0))
			entry.percentComplete = percent === null || percent === undefined ? null : Math.min(100, Math.max(0, Math.round(Number(percent))))
			entry.start = CalDAV.instantFrom(value('dtstart'), tzidOf('dtstart')) as any || undefined
			entry.end = CalDAV.instantFrom(value('due'), tzidOf('due') ?? tzidOf('dtstart')) as any || undefined
			entry.allDay = !!value('dtstart')?.isDate
		}

		entry.visibility = CalDAV.visibilityFromICal(component.getFirstPropertyValue('class')?.toString())

		entry.reminders = CalDAV.remindersFrom(component)
		entry.participants = CalDAV.participantsFrom(component, integration.addresses)
		entry.relations = integration.capabilities.relations ? CalDAV.relationsFrom(component) : undefined

		const dtstartTzid = tzidOf('dtstart')
		entry.timeZone = CalDAV.resolvableZone(dtstartTzid) ? dtstartTzid
			: CalDAV.isFloating(component.getFirstPropertyValue('dtstart')) ? FLOATING_TIME_ZONE : null

		const recurrence = CalDAV.recurrenceProps(component)
		entry.uid = recurrence.uid
		entry.recurrence = recurrence.recurrence
		entry.recurrenceId = recurrence.recurrenceId as any
	}

	/** Links each override row back to its series master by shared UID. */
	static linkOverridesToMasters(entries: ReadonlyArray<Entry>): boolean {
		let linked = false
		for (const entry of entries) {
			if (entry.recurrenceId && entry.uid && !entry.recurrenceMasterId) {
				const master = entries.find(other => other.recurrence && !other.recurrenceId && other.uid === entry.uid)
				if (master) {
					entry.recurrenceMasterId = master.id
					linked = true
				}
			}
		}
		return linked
	}

	/**
	 * Determines if a collection is writable from WebDAV `current-user-privilege-set` (RFC 3744).
	 * Returns `undefined` if missing (server does not implement ACL).
	 */
	static writableFromPrivileges(privilegeSet: unknown): boolean | undefined {
		if (privilegeSet === null || privilegeSet === undefined) {
			return undefined
		}
		const names = new Set<string>()
		const walk = (node: unknown, depth: number) => {
			if (depth > 8 || typeof node !== 'object' || node === null) {
				return
			}
			for (const [key, value] of Object.entries(node)) {
				names.add(key.replace(/^[^:]+:/, '').toLowerCase())
				walk(value, depth + 1)
			}
		}
		walk(privilegeSet, 0)
		// An unrecognized shape is "we don't know", not a refusal.
		if (!names.size) {
			return undefined
		}
		// `write` is the aggregate, `write-content`/`bind` its halves (change a resource, add one).
		return ['write', 'write-content', 'bind', 'all'].some(privilege => names.has(privilege))
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

	/** Parses RELATED-TO properties (RFC 5545 §3.8.4.5) into canonical relations, preserving RELTYPE and RFC 9253 GAP. */
	static relationsFrom(component: ICAL.Component): Array<Relation> | null {
		return EntryRelations.of(undefined, component.getAllProperties('related-to').map(property => ({
			type: property.getParameter('reltype')?.toString() || RelationType.Parent,
			targetUid: property.getFirstValue()?.toString() ?? '',
			gap: property.getParameter('gap')?.toString() || null,
		}))).value
	}

	/** Diffs RELATED-TO properties against desired relations. Untouched properties preserve unparsed
	 * parameters (VALUE, LANGUAGE, X-*). Static (no `this`) and public: the sync engine calls it while
	 * writing a resource. */
	static writeRelations(component: ICAL.Component, lines: Array<Relation> | undefined | null) {
		// Writes only owned relations so derived incoming lines are never persisted into external resources.
		const relations = lines === undefined ? undefined : EntryRelations.of(undefined, lines).writes
		// Matches properties using canonical relation keys.
		const keyOf = (init: RelationInit) => Relation.from(init)?.key ?? ''
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
	 * another client authored is its own channel, not ours to rewrite. Static (no `this`) and public:
	 * the sync engine calls it while writing a resource. */
	static writeReminders(component: ICAL.Component, reminders: Array<number> | undefined | null) {
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

	/** A failed write as a throwable error carrying the server's own explanation — servers put the
	 * REASON in the response body (Radicale, e.g., names the exact parse/validation complaint there),
	 * and "412 Precondition Failed" alone leaves a production log with nothing to act on. Public: the
	 * sync engine throws it on a failed create/update/delete. */
	static async writeError(operation: string, response: { status: number, statusText: string, text?: () => Promise<string> }): Promise<Error> {
		const detail = (await response.text?.().catch(() => ''))?.trim().slice(0, 500)
		return new Error(`CalDAV ${operation} failed: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ''}`)
	}

}
