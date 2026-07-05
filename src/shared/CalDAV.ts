import { type EntityManager } from '@mikro-orm/sqlite'
import { equals } from '@a11d/equals'
import { createDAVClient } from 'tsdav'
import ICAL from 'ical.js'
import { model } from './model.js'
import { entity } from './orm.js'
import { Source, SourceType } from './Source.js'
import { Integration } from './Integration.js'
import { Entry, EntryType, TaskStatus } from './Entry.js'
import { Recurrence } from './Recurrence.js'
import { Color } from './Color.js'

export interface CalDAVCredentials {
	username: string
	password: string
}

@model('CalDAV')
@entity({ discriminatorValue: 'caldav' })
export class CalDAV extends Integration<CalDAVCredentials> {
	constructor(init?: Partial<CalDAV>) {
		super()
		Object.assign(this, init)
	}

	override toString() {
		return `${this.type} integration for "${this.credentials.username}" at ${this.uri}`
	}

	override merge(incoming: CalDAV) {
		this.uri = incoming.uri || this.uri
		this.credentials = {
			username: incoming.credentials.username,
			// A blank incoming password keeps the stored secret — the edit form leaves it empty.
			password: incoming.credentials.password || this.credentials.password,
		}
	}

	private client?: ReturnType<typeof createDAVClient>

	// Memoized so a multi-step operation (discover + sync entries) shares one account discovery.
	private getClient(): ReturnType<typeof createDAVClient> {
		return this.client ??= createDAVClient({
			defaultAccountType: 'caldav',
			authMethod: 'Basic',
			serverUrl: this.uri ?? '',
			credentials: {
				username: this.credentials.username,
				password: this.credentials.password,
			},
		})
	}

	protected override async fetchSources() {
		const client = await this.getClient()
		const calendars = await client.fetchCalendars()
		return calendars.flatMap(cal => {
			const name = typeof cal.displayName === 'string' ? cal.displayName : 'Untitled'
			const color = typeof cal.calendarColor === 'string' ? cal.calendarColor : Color.get(cal.url || name).value
			// Per RFC 4791 §5.2.3 an absent/empty supported-calendar-component-set means the
			// collection accepts every component type — so an empty list supports both.
			const components = cal.components ?? []
			const supports = (component: string) => components.length === 0 || components.includes(component)
			const sources: Array<Source> = []
			if (supports('VEVENT')) {
				sources.push(new Source({ uri: cal.url, type: SourceType.Event, name, color, enabled: false }))
			}
			if (supports('VTODO')) {
				sources.push(new Source({ uri: cal.url, type: SourceType.Task, name, color, enabled: false }))
			}
			return sources
		})
	}

	/** Build a DTSTART/DTEND value. All-day entries are written date-only (`VALUE=DATE`) — that's what
	 * makes a real all-day event (not a 00:00→00:00 timed one); `DTEND` stays the exclusive next day. */
	private toICALTime(date: DateTime, allDay: boolean) {
		if (!allDay) {
			return ICAL.Time.fromJSDate(date, true)
		}
		const local = ICAL.Time.fromJSDate(date, false)
		return ICAL.Time.fromData({ year: local.year, month: local.month, day: local.day, isDate: true })
	}

	/** mitra TaskStatus → CalDAV VTODO STATUS (RFC 5545 §3.8.1.11). */
	private static readonly statusToICal = new Map<TaskStatus, string>([
		[TaskStatus.ToDo, 'NEEDS-ACTION'],
		[TaskStatus.Doing, 'IN-PROCESS'],
		[TaskStatus.Done, 'COMPLETED'],
		[TaskStatus.Cancelled, 'CANCELLED'],
	])

	/** CalDAV VTODO STATUS → mitra TaskStatus. A missing/unknown STATUS falls back to PERCENT-COMPLETE
	 * (>= 100 means done), then to ToDo — so a VTODO with no status is shown as ToDo, never mutated. */
	private static statusFromICal(status: string | undefined, percentComplete: number): TaskStatus {
		switch (status?.toUpperCase()) {
			case 'COMPLETED': return TaskStatus.Done
			case 'IN-PROCESS': return TaskStatus.Doing
			case 'CANCELLED': return TaskStatus.Cancelled
			case 'NEEDS-ACTION': return TaskStatus.ToDo
			default: return percentComplete >= 100 ? TaskStatus.Done : TaskStatus.ToDo
		}
	}

	/** Write a task's three coupled completion properties consistently: STATUS, PERCENT-COMPLETE, and the
	 * COMPLETED instant (stamped/cleared server-side — there's no UI for it). Manual percent comes later
	 * with sub-tasks; for now it tracks completion (100/0). */
	private writeTaskStatus(component: ICAL.Component, status: TaskStatus | undefined) {
		const effective = status ?? TaskStatus.ToDo
		component.updatePropertyWithValue('status', CalDAV.statusToICal.get(effective))
		component.updatePropertyWithValue('percent-complete', effective === TaskStatus.Done ? 100 : 0)
		if (effective === TaskStatus.Done) {
			component.updatePropertyWithValue('completed', ICAL.Time.now())
		} else {
			component.removeProperty('completed')
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

	/** The recurrence info off a parsed VEVENT/VTODO: the master's rule (as a `Recurrence` value object), the
	 * shared UID, and a RECURRENCE-ID when the component is a single-occurrence override. */
	static recurrenceProps(component: ICAL.Component): { uid?: string, recurrence?: Recurrence, recurrenceId?: Date } {
		const rrule = component.getFirstPropertyValue('rrule')?.toString() || undefined
		return {
			uid: component.getFirstPropertyValue('uid')?.toString() || undefined,
			recurrence: Recurrence.fromRRule(rrule),
			recurrenceId: (component.getFirstPropertyValue('recurrence-id') as { toJSDate?(): Date } | null)?.toJSDate?.() || undefined,
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

		const changedObjects: Awaited<ReturnType<typeof client.fetchCalendarObjects>> = changedUrls.length
			? await client.fetchCalendarObjects({ calendar: remoteCalendar, objectUrls: changedUrls })
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

		// This source surfaces only one of the collection's component types; the sibling source
		// (sharing the same calendar URL) owns the other.
		const entryType = source.type === SourceType.Task ? EntryType.Task : EntryType.Event

		// Report whether any actual entry changed. The sync-token bookkeeping must NOT count, or the
		// background sync would notify clients every cycle (clobbering in-progress edits).
		let changed = false

		// 1. Handle deletions
		for (const url of deletedUrls) {
			const entry = existingEntries.find(e => CalDAV.memberUrlsMatch(source.uri, e.uri, url))
			if (entry) {
				em.remove(entry)
				changed = true
			}
		}

		// 2. Handle changes/additions — keep only the component this source represents, skipping the
		// sibling's (and components we don't model, e.g. VJOURNAL) so we never persist an entry
		// without the required `uri`, which would otherwise abort the whole sync's flush.
		for (const obj of changedObjects) {
			if (!obj.data) {
				continue
			}

			const comp = new ICAL.Component(ICAL.parse(obj.data))
			const component = comp.getFirstSubcomponent(entryType === EntryType.Task ? 'vtodo' : 'vevent')
			if (!component) {
				continue
			}

			const normalizedObjUrl = CalDAV.resolveMemberUrl(source.uri, obj.url)
			let entry = existingEntries.find(e => CalDAV.memberUrlsMatch(source.uri, e.uri, obj.url))
			if (!entry) {
				// A sibling source of the same calendar (events + tasks share one URL) may already own this
				// member — don't re-file it here as a cross-source duplicate.
				if (await em.findOne(Entry, { uri: normalizedObjUrl })) {
					continue
				}
				entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: normalizedObjUrl })
				em.persist(entry)
				existingEntries.push(entry)
			}

			if (entry.data?.etag === obj.etag) {
				continue
			}

			entry.type = entryType
			entry.color = component.getFirstPropertyValue('color')?.toString() || null
			entry.data ??= {}
			entry.data.raw = obj.data
			entry.data.etag = obj.etag

			if (entryType === EntryType.Event) {
				const event = new ICAL.Event(component)
				entry.heading = event.summary || 'Untitled Event'
				entry.description = event.description || ''
				entry.start = (event.startDate?.toJSDate() as any) || undefined
				entry.end = (event.endDate ? event.endDate.toJSDate() as any : event.startDate?.toJSDate() as any) || undefined
				// A date-only DTSTART (`VALUE=DATE`) is the iCalendar marker for an all-day event.
				entry.allDay = event.startDate?.isDate ?? false
			} else {
				const value = (name: string) => component.getFirstPropertyValue(name) as any
				entry.heading = value('summary')?.toString() || 'Untitled Task'
				entry.description = value('description')?.toString() || ''
				entry.status = CalDAV.statusFromICal(value('status')?.toString(), Number(value('percent-complete') ?? 0))
				entry.start = value('dtstart')?.toJSDate?.() as any || undefined
				entry.end = value('due')?.toJSDate?.() as any || undefined
				entry.allDay = !!value('dtstart')?.isDate
			}

			// Recurrence: a master carries an RRULE; a single edited occurrence is its own member carrying a
			// RECURRENCE-ID and the master's UID. Capture all three; occurrences are expanded later, on read.
			const recurrence = CalDAV.recurrenceProps(component)
			entry.uid = recurrence.uid
			entry.recurrence = recurrence.recurrence
			entry.recurrenceId = recurrence.recurrenceId as any

			changed = true
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

		source.syncState = { syncToken: newSyncToken }

		return changed
	}

	async updateEntry(_em: EntityManager, existing: Entry, incoming: Entry): Promise<void> {
		if (!existing.uri || !existing.data?.raw) {
			throw new Error('Entry must have a URL and raw data to be updated via CalDAV')
		}

		const keys: Array<keyof Entry> = (['heading', 'description', 'color', 'start', 'end', 'status', 'allDay'] as const)
			.filter(key => !Object[equals](existing[key], incoming[key]))

		// The recurrence rule is a value object, diffed via its own (absence-safe) structural equality.
		const recurrenceChanged = !Recurrence.equal(existing.recurrence, incoming.recurrence)

		if (keys.length === 0 && !recurrenceChanged) {
			return
		}

		const comp = new ICAL.Component(ICAL.parse(existing.data?.raw))

		const component = comp.getFirstSubcomponent('vevent') ?? comp.getFirstSubcomponent('vtodo')
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

		if (keys.includes('color')) {
			if (incoming.color) {
				component.updatePropertyWithValue('color', incoming.color)
			} else {
				component.removeProperty('color')
			}
			existing.color = incoming.color
		}

		// All-day toggling changes whether DTSTART/DTEND are date-only, so a change to `allDay` also
		// rewrites both date properties (even if the instants themselves didn't change).
		if ((keys.includes('start') || keys.includes('allDay')) && incoming.start) {
			component.updatePropertyWithValue('dtstart', this.toICALTime(incoming.start, incoming.allDay))
			existing.start = incoming.start
		}

		// A VTODO's end is DUE (RFC 5545 §3.8.2.3), a VEVENT's is DTEND — matching how sync reads each back.
		if ((keys.includes('end') || keys.includes('allDay')) && incoming.end) {
			component.updatePropertyWithValue(isTask ? 'due' : 'dtend', this.toICALTime(incoming.end, incoming.allDay))
			existing.end = incoming.end
		}

		if (isTask && keys.includes('status')) {
			this.writeTaskStatus(component, incoming.status)
			existing.status = incoming.status
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
			existing.recurrence = incoming.recurrence
		}

		if (keys.includes('allDay')) {
			existing.allDay = incoming.allDay
		}

		existing.data.raw = comp.toString()

		const client = await this.getClient()
		const response = await client.updateCalendarObject({
			calendarObject: {
				url: existing.uri,
				data: existing.data.raw,
				etag: existing.data.etag || undefined,
			}
		})

		// tsdav returns the raw fetch Response and does NOT throw on a non-2xx. The If-Match send means a 412
		// (the object changed underneath us) must abort before the route flushes, or the local row diverges
		// from the server. Throwing here skips the flush (per-request forked em), reverting the in-memory edit.
		if (response.ok === false) {
			throw new Error(`CalDAV update failed: ${response.status} ${response.statusText}`)
		}

		const etag = response.headers?.get('etag') || response.headers?.get('Etag') || response.headers?.get('ETag')
		if (etag) {
			existing.data.etag = etag
		}
	}

	async createEntry(em: EntityManager, entry: Entry): Promise<Entry> {
		const source = entry.sourceId ? await em.findOne(Source, { id: entry.sourceId }) : null
		if (!source?.uri) {
			throw new Error('A target source with a URL is required to create an entry via CalDAV')
		}

		const uid = crypto.randomUUID()
		const filename = `${uid}.ics`

		const comp = new ICAL.Component(['vcalendar', [], []])
		comp.updatePropertyWithValue('prodid', '-//calendar//EN')
		comp.updatePropertyWithValue('version', '2.0')

		// A task is a VTODO (its end is DUE, completion is STATUS); anything else a VEVENT (end is DTEND).
		// Writing the matching component is what keeps the sibling source (events + tasks share one
		// calendar URL) from ingesting it as a duplicate.
		const isTask = entry.type === EntryType.Task
		const component = new ICAL.Component(isTask ? 'vtodo' : 'vevent')
		component.updatePropertyWithValue('uid', uid)
		component.updatePropertyWithValue('dtstamp', ICAL.Time.now())
		component.updatePropertyWithValue('summary', entry.heading)
		!entry.description ? void 0 : component.updatePropertyWithValue('description', entry.description)
		!entry.start ? void 0 : component.updatePropertyWithValue('dtstart', this.toICALTime(entry.start, entry.allDay))
		!entry.end ? void 0 : component.updatePropertyWithValue(isTask ? 'due' : 'dtend', this.toICALTime(entry.end, entry.allDay))
		!entry.color ? void 0 : component.updatePropertyWithValue('color', entry.color)
		!entry.recurrence ? void 0 : component.updatePropertyWithValue('rrule', ICAL.Recur.fromString(entry.recurrence.toRRule(entry.allDay)))
		if (isTask) {
			this.writeTaskStatus(component, entry.status)
		}

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
			throw new Error(`CalDAV create failed: ${response.status} ${response.statusText}`)
		}

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
		if (entry.uri) {
			const client = await this.getClient()
			await client.deleteCalendarObject({
				calendarObject: {
					url: entry.uri,
					etag: entry.data?.etag || undefined,
				}
			})
		}
		em.remove(entry)
	}

	async excludeOccurrence(_em: EntityManager, master: Entry, recurrenceId: Date): Promise<void> {
		if (!master.uri || !master.data?.raw) {
			throw new Error('Master must have a URL and raw data to exclude an occurrence via CalDAV')
		}

		const comp = new ICAL.Component(ICAL.parse(master.data.raw))
		const component = comp.getFirstSubcomponent('vevent') ?? comp.getFirstSubcomponent('vtodo')
		if (!component) {
			throw new Error('No vevent or vtodo found in master rawData')
		}

		// One EXDATE per excluded instant (matched by ms during expansion); value type follows DTSTART.
		component.addPropertyWithValue('exdate', this.toICALTime(recurrenceId as unknown as DateTime, master.allDay))
		master.data.raw = comp.toString()

		const client = await this.getClient()
		const response = await client.updateCalendarObject({
			calendarObject: { url: master.uri, data: master.data.raw, etag: master.data.etag || undefined }
		})
		if (response.ok === false) {
			throw new Error(`CalDAV exclude failed: ${response.status} ${response.statusText}`)
		}
		const etag = response.headers?.get('etag') || response.headers?.get('Etag') || response.headers?.get('ETag')
		if (etag) {
			master.data.etag = etag
		}
	}
}
