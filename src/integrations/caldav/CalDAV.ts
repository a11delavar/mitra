import { type EntityManager } from '@mikro-orm/sqlite'
import { converter } from '@a11d/converter'
import '@a11d/bidirectional-map'
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
	password?: string
}

@model('CalDAV')
@integration('caldav')
export class CalDAV extends Integration<CalDAVCredentials> {
	static readonly label: string = 'CalDAV'
	static readonly logo: string = 'caldav'
	static readonly description: string = 'Nextcloud, Fastmail, Radicale — any CalDAV server'

	@converter(withheld<CalDAVCredentials>('password')) override credentials!: CalDAVCredentials

	constructor(init?: Partial<CalDAV>) {
		super()
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
			this.addresses = undefined
		}
		this.credentials = {
			username: incoming.credentials.username,
			password: incoming.credentials.password || this.credentials.password,
		}
	}

	/** Transient tsdav client connection instance. */
	@converter({ out: {} }) client?: ReturnType<typeof createDAVClient>

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

	/** Build a DTSTART/DTEND/DUE/EXDATE value (written as VALUE=DATE for all-day). */
	static toICALTime(date: Date, allDay: boolean) {
		if (!allDay) {
			return ICAL.Time.fromJSDate(date, true)
		}
		const { year, month, day } = calendarDateOf(date, 'UTC')
		return ICAL.Time.fromData({ year, month, day, isDate: true })
	}

	/** Whether a parsed timed value is an RFC 5545 FLOATING time. */
	static isFloating(value: unknown): boolean {
		return value instanceof ICAL.Time && !value.isDate && value.zone === ICAL.Timezone.localTimezone
	}

	/** Whether Temporal can resolve a TZID as a valid IANA time zone. */
	static resolvableZone(tzid: string | null | undefined): tzid is string {
		try {
			return !!tzid && !!Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(tzid)
		} catch {
			return false
		}
	}

	/**
	 * Converts an iCalendar time object and optional TZID to a JavaScript Date.
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

	private static readonly icalTaskStatus = new BidirectionalMap<TaskStatus, string>([
		[TaskStatus.ToDo, 'NEEDS-ACTION'],
		[TaskStatus.Doing, 'IN-PROCESS'],
		[TaskStatus.Done, 'COMPLETED'],
		[TaskStatus.Cancelled, 'CANCELLED'],
	])

	static statusFromICal(status: string | undefined, percentComplete: number): TaskStatus {
		return CalDAV.icalTaskStatus.getKey(status?.toUpperCase() ?? '')
			?? (percentComplete >= 100 ? TaskStatus.Done : TaskStatus.ToDo)
	}

	/**
	 * Computes PERCENT-COMPLETE for iCalendar (RFC 5545 §3.8.1.8).
	 */
	static percentCompleteForICal(status: TaskStatus | undefined, percentComplete: number | null | undefined): number | undefined {
		if ((status ?? TaskStatus.ToDo) === TaskStatus.Done) {
			return 100
		}
		return percentComplete === null || percentComplete === undefined ? undefined : Math.min(100, Math.max(0, Math.round(percentComplete)))
	}

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

	private static readonly icalTransparency = new BidirectionalMap<Transparency, string>([
		[Transparency.Busy, 'OPAQUE'],
		[Transparency.Free, 'TRANSPARENT'],
	])

	private static readonly icalVisibility = new BidirectionalMap<Visibility, string>([
		[Visibility.Public, 'PUBLIC'],
		[Visibility.Private, 'PRIVATE'],
		[Visibility.Confidential, 'CONFIDENTIAL'],
	])

	static transparencyFromICal(transparency: string | undefined): Transparency | null {
		return CalDAV.icalTransparency.getKey(transparency?.toUpperCase() ?? '') ?? null
	}

	static visibilityFromICal(visibility: string | undefined): Visibility | null {
		return CalDAV.icalVisibility.getKey(visibility?.toUpperCase() ?? '') ?? null
	}

	static writeTransparency(component: ICAL.Component, transparency: Transparency | null | undefined) {
		if (transparency) {
			component.updatePropertyWithValue('transp', CalDAV.icalTransparency.get(transparency)!)
		} else {
			component.removeProperty('transp')
		}
	}

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

	static isCollectionHref(sourceUri: string, href: string | null | undefined): boolean {
		const collection = CalDAV.resolveMemberUrl(sourceUri, sourceUri)
		const url = CalDAV.resolveMemberUrl(sourceUri, href)
		return url === collection || url + '/' === collection || url === collection + '/'
	}

	/**
	 * Splits sync-collection multistatus responses into changed and deleted member URLs (RFC 6578 §3.6).
	 */
	static partitionMemberResponses(sourceUri: string, responses: ReadonlyArray<{ href?: string, status?: number, error?: Record<string, unknown> }>): { changedUrls: Array<string>, deletedUrls: Array<string>, truncated: boolean } {
		const truncated = responses.some(r => r.status === 507 || !!r.error?.numberOfMatchesWithinLimits)
		const members = responses
			.filter(r => r.href && !CalDAV.isCollectionHref(sourceUri, r.href))
			.map(r => ({ url: CalDAV.resolveMemberUrl(sourceUri, r.href), status: r.status }))
		return {
			changedUrls: members.filter(m => m.status !== 404 && m.status !== 507).map(m => m.url),
			deletedUrls: members.filter(m => m.status === 404).map(m => m.url),
			truncated,
		}
	}

	static instantOf(recurrenceId: Date | number | null | undefined): number | undefined {
		return recurrenceId === null || recurrenceId === undefined ? undefined : new Date(recurrenceId).getTime()
	}

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
			return undefined
		}
	}

	private static floatingTime(date: Date): ICAL.Time {
		return ICAL.Time.fromData({
			year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
			hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
		})
	}

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

	static componentFor(entry: Entry, comp: ICAL.Component): ICAL.Component | undefined {
		return [...comp.getAllSubcomponents('vevent'), ...comp.getAllSubcomponents('vtodo')]
			.find(component => CalDAV.recurrenceProps(component).recurrenceId?.getTime() === CalDAV.instantOf(entry.recurrenceId))
	}

	static async syncResourceRows(em: EntityManager, written: Entry): Promise<void> {
		for (const sibling of await em.find(Entry, { sourceId: written.sourceId, uri: written.uri, id: { $ne: written.id } })) {
			sibling.data = { ...sibling.data, raw: written.data?.raw, etag: written.data?.etag }
		}
	}

	/**
	 * Reads one parsed VEVENT/VTODO onto an entry.
	 */
	static applyComponent(entry: Entry, component: ICAL.Component, integration: Integration): void {
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
		if (!names.size) {
			return undefined
		}
		return ['write', 'write-content', 'bind', 'all'].some(privilege => names.has(privilege))
	}

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

	private static reminderAnchorOf(component: ICAL.Component): 'START' | 'END' {
		return component.getFirstProperty('dtstart') ? 'START' : 'END'
	}

	static remindersFrom(component: ICAL.Component): Array<number> | null {
		const anchor = CalDAV.reminderAnchorOf(component)
		const minutes = component.getAllSubcomponents('valarm').flatMap(alarm => {
			const trigger = alarm.getFirstProperty('trigger')
			const duration = trigger?.getFirstValue() as { toSeconds?(): number } | null
			if (
				alarm.getFirstPropertyValue('action')?.toString().toUpperCase() === 'EMAIL'
				|| !trigger || typeof duration?.toSeconds !== 'function'
				|| (trigger.getParameter('related')?.toString().toUpperCase() || 'START') !== anchor
			) {
				return []
			}
			const seconds = duration.toSeconds()
			return seconds > 0 ? [] : [Math.round(-seconds / 60)]
		})
		return minutes.length ? [...new Set(minutes)].sort((a, b) => a - b) : null
	}

	private static readonly icalRole = new BidirectionalMap<ParticipantRole, string>([
		[ParticipantRole.Chair, 'CHAIR'],
		[ParticipantRole.Required, 'REQ-PARTICIPANT'],
		[ParticipantRole.Optional, 'OPT-PARTICIPANT'],
		[ParticipantRole.NonParticipant, 'NON-PARTICIPANT'],
	])

	private static readonly icalPartStat = new BidirectionalMap<ParticipantStatus, string>([
		[ParticipantStatus.NeedsAction, 'NEEDS-ACTION'],
		[ParticipantStatus.Accepted, 'ACCEPTED'],
		[ParticipantStatus.Declined, 'DECLINED'],
		[ParticipantStatus.Tentative, 'TENTATIVE'],
		[ParticipantStatus.Delegated, 'DELEGATED'],
	])

	private static calAddressEmail(value: string | null | undefined): string | undefined {
		return value?.toString().trim().replace(/^mailto:/i, '') || undefined
	}

	/**
	 * Extracts and normalizes participants from ATTENDEE and ORGANIZER properties.
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
	 * Serializes participants to ATTENDEE and ORGANIZER properties.
	 */
	static writeParticipants(component: ICAL.Component, raw: ReadonlyArray<Participant> | null) {
		component.removeAllProperties('attendee')
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

	static relationsFrom(component: ICAL.Component): Array<Relation> | null {
		return EntryRelations.of(undefined, component.getAllProperties('related-to').map(property => ({
			type: property.getParameter('reltype')?.toString() || RelationType.Parent,
			targetUid: property.getFirstValue()?.toString() ?? '',
			gap: property.getParameter('gap')?.toString() || null,
		}))).value
	}

	static writeRelations(component: ICAL.Component, lines: Array<Relation> | undefined | null) {
		const relations = lines === undefined ? undefined : EntryRelations.of(undefined, lines).writes
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
				kept.add(key)
			} else {
				component.removeProperty(property)
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

	static writeReminders(component: ICAL.Component, reminders: Array<number> | undefined | null) {
		const anchor = CalDAV.reminderAnchorOf(component)
		for (const alarm of component.getAllSubcomponents('valarm')) {
			const related = alarm.getFirstProperty('trigger')?.getParameter('related')?.toString().toUpperCase() || 'START'
			if (alarm.getFirstPropertyValue('action')?.toString().toUpperCase() !== 'EMAIL' && related === anchor) {
				component.removeSubcomponent(alarm)
			}
		}
		for (const minutes of reminders ?? []) {
			const alarm = new ICAL.Component('valarm')
			alarm.updatePropertyWithValue('action', 'DISPLAY')
			alarm.updatePropertyWithValue('description', 'Reminder')
			const trigger = alarm.updatePropertyWithValue('trigger', ICAL.Duration.fromSeconds(-minutes * 60))
			if (anchor === 'END') {
				trigger.setParameter('related', 'END')
			}
			component.addSubcomponent(alarm)
		}
	}

	static async writeError(operation: string, response: { status: number, statusText: string, text?: () => Promise<string> }): Promise<Error> {
		const detail = (await response.text?.().catch(() => ''))?.trim().slice(0, 500)
		return new Error(`CalDAV ${operation} failed: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ''}`)
	}
}
