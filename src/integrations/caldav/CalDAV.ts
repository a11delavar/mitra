import { type EntityManager } from '@mikro-orm/sqlite'
import { converter } from '@a11d/converter'
import '@a11d/bidirectional-map'
import { type createDAVClient } from 'tsdav'
import ICAL from 'ical.js'
import { EntryRelations, Relation, type RelationInit, RelationType } from '#features/relations'
import { Entry, EntryTimeZone, TaskStatus, Transparency, Visibility, EntryType, EntryFiles } from '#features/entries'
import { Color } from '#features/sources'
import { Recurrence } from '#features/recurrence'
import { TimeZone } from '#features/time/TimeZone.js'
import { Participants, ParticipantRole, ParticipantStatus, type Participant } from '#features/participants/Participant.js'
import { Integration, integration, IntegrationOwnership } from '#integrations'
import { model, withheld } from '#infrastructure/model'
import { buildVTimezone } from './vtimezone.js'
import { IcsTime } from './IcsTime.js'

export interface CalDAVCredentials {
	username: string
	password?: string
}

// ESTIMATED-DURATION (draft-ietf-calext-ical-tasks): unregistered, ical.js would read it as text.
ICAL.design.icalendar.property['estimated-duration'] ??= { defaultType: 'duration' }

/** A VTODO's dates as an entry holds them. */
type TaskTimes = Pick<Entry, 'start' | 'end' | 'due' | 'estimate' | 'allDay'>

@model('CalDAV')
@integration('caldav')
export class CalDAV extends Integration<CalDAVCredentials> {
	static readonly label: string = 'CalDAV'
	static readonly logo: string = 'caldav'
	static readonly description: string = 'Any CalDAV server, like Nextcloud, Fastmail or Radicale'

	@converter(withheld<CalDAVCredentials>('password')) override credentials!: CalDAVCredentials

	constructor(init?: Partial<CalDAV>) {
		super()
		this.uri = ''
		this.credentials = { username: '', password: '' }
		Object.assign(this, init)
	}

	/** What an iCalendar resource carries (RFC 5545 and its task extensions). */
	/** Whether `ATTACH` lines are Mitra's to write: the provider holds them and takes them, else what it sent stays as it is. */
	get writesAttachments() {
		return this.ownership.ownerOf('attachments') === 'upstream' && this.capabilities.entries.attach
	}

	override get ownership() {
		return new IntegrationOwnership({
			recurrence: 'upstream', reminders: 'upstream', location: 'upstream', description: 'upstream', percentComplete: 'upstream',
			due: 'upstream', estimate: 'upstream', timeZone: 'upstream', participants: 'upstream', attachments: 'upstream',
			transparency: 'upstream', visibility: 'upstream', relations: 'upstream', allDay: 'upstream', rank: 'mitra',
		})
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

	/** The UID prefix of the busy events written for busy availability. Other clients keep UIDs, unlike `X-` properties. */
	static readonly availabilityUidPrefix = 'mitra-availability-'

	override writtenForAvailability(entry: Entry) {
		return !!entry.uid?.startsWith(CalDAV.availabilityUidPrefix)
	}

	/** Transient tsdav client connection instance. */
	@converter({ out: {} }) client?: ReturnType<typeof createDAVClient>

	/** The address whose calendars to list, as other clients read it; a bare host names no one, so discovery finds the login's own. */
	get calendarsAddress(): string | undefined {
		return URL.parse(this.uri ?? '')?.pathname.replace(/\/+$/, '') ? this.uri : undefined
	}

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

	/** Computes PERCENT-COMPLETE for iCalendar (RFC 5545 §3.8.1.8). */
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

	static transparencyFromICal(transparency: string | undefined): Transparency | undefined {
		return CalDAV.icalTransparency.getKey(transparency?.toUpperCase() ?? '')
	}

	static visibilityFromICal(visibility: string | undefined): Visibility | undefined {
		return CalDAV.icalVisibility.getKey(visibility?.toUpperCase() ?? '')
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

	/** Splits sync-collection multistatus responses into changed and deleted member URLs (RFC 6578 §3.6). */
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
	 * Rewrites (or `append`s) a date property in `zone`: an IANA zone as its wall clock under a TZID with an embedded
	 * VTIMEZONE, floating as a bare local time, UTC and all-day through {@link toICALTime} (RFC 5545 §3.3.5).
	 * Omitting `zone` keeps the property's authored form, its TZID resolved only against embedded definitions.
	 */
	static writeDate(
		comp: ICAL.Component, component: ICAL.Component, name: string,
		date: Date, allDay: boolean,
		options?: { zone?: EntryTimeZone | null, append?: boolean },
	): void {
		const authored = options !== undefined && 'zone' in options
		// The resource's own TZID may name no IANA zone (Outlook's `W. Europe Standard Time`), so it stays a string.
		const zone = authored ? options!.zone?.id ?? null : component.getFirstProperty(name)?.getParameter('tzid')?.toString() ?? null
		const floating = authored && !!options!.zone?.floating
		const timezone = allDay || !zone || floating || zone === 'UTC'
			? undefined
			: CalDAV.timezoneIn(comp, zone, authored, date.getUTCFullYear())
		const time = timezone
			? ICAL.Time.fromJSDate(date, true).convertToZone(timezone)
			: floating && !allDay
				? CalDAV.floatingTime(date)
				: IcsTime.toICALTime(date, allDay)
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

	/** Reads one parsed VEVENT/VTODO onto an entry. */
	static applyComponent(entry: Entry, component: ICAL.Component, integration: Integration): void {
		const entryType = component.name === 'vtodo' ? EntryType.Task : EntryType.Event
		entry.type = entryType
		entry.color = Color.parse(component.getFirstPropertyValue('color')?.toString())

		const tzidOf = (name: string) => component.getFirstProperty(name)?.getParameter('tzid')?.toString()
		if (entryType.isEvent) {
			const event = new ICAL.Event(component)
			entry.heading = event.summary || 'Untitled Event'
			entry.description = event.description || ''
			entry.location = event.location || ''
			entry.start = IcsTime.instantFrom(event.startDate, tzidOf('dtstart')) as any || undefined
			entry.end = IcsTime.instantFrom(event.endDate ?? event.startDate, tzidOf('dtend') ?? tzidOf('dtstart')) as any || undefined
			entry.allDay = event.startDate?.isDate ?? false
			entry.transparency = CalDAV.transparencyFromICal(component.getFirstPropertyValue('transp')?.toString())
		} else {
			const value = (name: string) => component.getFirstPropertyValue(name) as any
			entry.heading = value('summary')?.toString() || 'Untitled Task'
			entry.description = value('description')?.toString() || ''
			entry.location = value('location')?.toString() || ''
			const percent = value('percent-complete')
			entry.status = CalDAV.statusFromICal(value('status')?.toString(), Number(percent ?? 0))
			entry.percentComplete = percent === null || percent === undefined ? undefined : Math.min(100, Math.max(0, Math.round(Number(percent))))
			Object.assign(entry, CalDAV.taskTimesFrom(component))
		}

		entry.visibility = CalDAV.visibilityFromICal(component.getFirstPropertyValue('class')?.toString())

		entry.reminders = CalDAV.remindersFrom(component)
		entry.participants = CalDAV.participantsFrom(component, integration.addresses)
		entry.attachments = integration.ownership.holds('attachments') ? CalDAV.attachmentsFrom(component).resolvedAgainst(entry.attachments) : undefined
		entry.relations = integration.ownership.holds('relations') ? CalDAV.relationsFrom(component) : undefined

		// An unscheduled task carries its zone on DUE.
		const anchor = component.getFirstProperty('dtstart') || entryType.isEvent ? 'dtstart' : 'due'
		const anchorTzid = tzidOf(anchor)
		entry.timeZone = IcsTime.resolvableZone(anchorTzid) ? EntryTimeZone.parse(anchorTzid)
			: IcsTime.isFloating(component.getFirstPropertyValue(anchor)) ? EntryTimeZone.floating : undefined

		const recurrence = CalDAV.recurrenceProps(component)
		entry.uid = recurrence.uid
		entry.recurrence = recurrence.recurrence
		entry.recurrenceId = recurrence.recurrenceId as any
		entry.exdates = recurrence.recurrence ? CalDAV.exdatesFrom(component) : undefined
	}

	/** The instants a recurring component excludes, decoded as its occurrences are. */
	static exdatesFrom(component: ICAL.Component): Array<number> | undefined {
		const exdates = component.getAllProperties('exdate').flatMap(prop => prop.getValues()
			.map(value => IcsTime.instantFrom(value as ICAL.Time, prop.getParameter('tzid')?.toString())?.getTime())
			.filter(ms => ms !== undefined))
		return exdates.length ? exdates : undefined
	}

	/**
	 * Each property means one thing whatever else is there: DTSTART the start, DUE the due date, ESTIMATED-DURATION the
	 * span from DTSTART once there is one, else the estimate. DTSTART with DUE and no length is a moment with a due date,
	 * as Mitra writes one and as other task servers spell a planned day with a deadline; never a block spanning the two.
	 */
	static taskTimesFrom(component: ICAL.Component): TaskTimes {
		const tzidOf = (name: string) => component.getFirstProperty(name)?.getParameter('tzid')?.toString()
		const dtstart = component.getFirstPropertyValue('dtstart') as ICAL.Time | null
		const dueValue = component.getFirstPropertyValue('due') as ICAL.Time | null
		const start = IcsTime.instantFrom(dtstart, tzidOf('dtstart')) as Entry['start']
		const due = IcsTime.instantFrom(dueValue, tzidOf('due') ?? tzidOf('dtstart')) as Entry['due']
		const duration = component.getFirstPropertyValue('estimated-duration') as ICAL.Duration | null
		const length = duration && !duration.isNegative && duration.toSeconds() > 0 ? duration : undefined
		const allDay = !!(dtstart ?? dueValue)?.isDate
		// RFC 5545 §3.3.6: days and weeks are calendar days, the time parts exact, so a P1D across a DST change keeps
		// the wall clock. Floating and UTC times are both held as UTC instants, where the two agree.
		const zone = !allDay && IcsTime.resolvableZone(tzidOf('dtstart')) ? tzidOf('dtstart')! : 'UTC'
		const end = start && length
			? new Date(Temporal.Instant.fromEpochMilliseconds(start.valueOf()).toZonedDateTimeISO(zone)
				.add({ weeks: length.weeks, days: length.days, hours: length.hours, minutes: length.minutes, seconds: length.seconds })
				.epochMilliseconds) as Entry['end']
			: undefined
		const estimate = !start && length ? Math.round(length.toSeconds() / 60) : undefined
		return { start, end, due, estimate, allDay }
	}

	/**
	 * Writes {@link taskTimesFrom}'s shape back: DTSTART, the span or estimate as ESTIMATED-DURATION, and DUE only for a
	 * due. A timed length is written in hours, never days, which a reader would take as calendar days (§3.3.6).
	 */
	static writeTaskTimes(comp: ICAL.Component, component: ICAL.Component, entry: TaskTimes & Pick<Entry, 'timeZone'>) {
		const write = (name: string, date: Date | undefined) => date
			? CalDAV.writeDate(comp, component, name, date, entry.allDay, { zone: entry.timeZone })
			: component.removeAllProperties(name)
		write('dtstart', entry.start)
		write('due', entry.due)
		const length = CalDAV.lengthOf(entry)
		if (length) {
			component.updatePropertyWithValue('estimated-duration', length)
		} else {
			component.removeAllProperties('estimated-duration')
		}
	}

	/** An all-day span in the days between its canonical dates, a timed one as the exact time; an estimate in days only when it is whole days. */
	private static lengthOf(entry: TaskTimes): ICAL.Duration | undefined {
		if (entry.start && entry.end && entry.allDay) {
			const days = TimeZone.UTC.dayOf(entry.start).until(TimeZone.UTC.dayOf(entry.end)).days
			return days > 0 ? ICAL.Duration.fromData({ days }) : undefined
		}
		const seconds = entry.start
			? entry.end && Math.round((entry.end.valueOf() - entry.start.valueOf()) / 1000)
			: entry.estimate && entry.estimate * 60
		if (!seconds || seconds <= 0) {
			return undefined
		}
		const day = 24 * 60 * 60
		return !entry.start && seconds % day === 0
			? ICAL.Duration.fromData({ days: seconds / day })
			: ICAL.Duration.fromData({ hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 })
	}
	static linkOverridesToMasters(entries: ReadonlyArray<Entry>): boolean {
		let linked = false
		for (const entry of entries) {
			if (entry.recurrenceId && entry.uid && !entry.recurringEntryId) {
				const master = entries.find(other => other.recurrence && !other.recurrenceId && other.uid === entry.uid)
				if (master) {
					entry.recurringEntryId = master.id
					linked = true
				}
			}
		}
		return linked
	}

	/** Determines if a collection is writable from WebDAV `current-user-privilege-set` (RFC 3744). */
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
			recurrenceId: IcsTime.instantFrom(
				component.getFirstPropertyValue('recurrence-id') as ICAL.Time | null,
				component.getFirstProperty('recurrence-id')?.getParameter('tzid')?.toString(),
			) || undefined,
		}
	}

	private static reminderAnchorOf(component: ICAL.Component): 'START' | 'END' {
		return component.getFirstProperty('dtstart') ? 'START' : 'END'
	}

	static remindersFrom(component: ICAL.Component): Array<number> | undefined {
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
		return minutes.length ? [...new Set(minutes)].sort((a, b) => a - b) : undefined
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

	/** Extracts and normalizes participants from ATTENDEE and ORGANIZER properties. */
	static participantsFrom(component: ICAL.Component, addresses?: ReadonlyArray<string> | null): Participants | undefined {
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

	/** Serializes participants to ATTENDEE and ORGANIZER properties. */
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

	/**
	 * Reads `ATTACH` (RFC 5545 §3.8.1.1) with the RFC 8607 parameters. Inline `ENCODING=BASE64` lines are neither listed nor
	 * decoded, so {@link writeAttachments} never removes a line it did not understand.
	 */
	static attachmentsFrom(component: ICAL.Component) {
		return EntryFiles.of(component.getAllProperties('attach')
			.filter(property => !CalDAV.inline(property))
			.map(property => ({
				sourceUrl: property.getFirstValue()?.toString(),
				name: property.getParameter('filename')?.toString(),
				mimeType: property.getParameter('fmttype')?.toString(),
				size: Number(property.getParameter('size')?.toString()) || undefined,
			})))
	}

	/**
	 * Writes the attachments as `ATTACH` lines, keeping every line already there byte for byte, so foreign parameters
	 * (Nextcloud's `X-NC-FILE-ID`, a server's `MANAGED-ID`) and inline binary lines survive. `origin` makes Mitra's own files absolute.
	 */
	static writeAttachments(component: ICAL.Component, attachments: EntryFiles | undefined, origin?: string) {
		const desired = new Map((attachments?.all ?? []).map(file => [file.url(origin), file]))
		const kept = new Set<string>()
		for (const property of component.getAllProperties('attach').filter(property => !CalDAV.inline(property))) {
			const url = property.getFirstValue()?.toString().trim() ?? ''
			if (desired.has(url) && !kept.has(url)) {
				kept.add(url)
			} else {
				component.removeProperty(property)
			}
		}
		for (const [url, file] of desired) {
			if (!kept.has(url)) {
				const property = component.addPropertyWithValue('attach', url)
				!file.mimeType ? void 0 : property.setParameter('fmttype', String(file.mimeType))
				!file.name ? void 0 : property.setParameter('filename', file.name)
				file.size === undefined ? void 0 : property.setParameter('size', String(file.size))
			}
		}
	}

	private static inline(property: ICAL.Property) {
		return property.getParameter('encoding')?.toString().toUpperCase() === 'BASE64'
	}

	static relationsFrom(component: ICAL.Component): EntryRelations {
		return EntryRelations.of(component.getAllProperties('related-to').map(property => ({
			type: property.getParameter('reltype')?.toString() || RelationType.Parent,
			targetUid: property.getFirstValue()?.toString() ?? '',
			gap: property.getParameter('gap')?.toString() || null,
		})))
	}

	/** Writes the relations the entry owns as RELATED-TO lines, keeping the ones already there as they are. */
	static writeRelations(component: ICAL.Component, relations: EntryRelations | undefined) {
		const keyOf = (init: RelationInit) => Relation.from(init)?.key ?? ''
		const desired = new Map((relations?.writes ?? []).map(relation => [keyOf(relation), relation]))
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
		return new Error(`CalDAV ${operation} failed: ${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`)
	}
}
