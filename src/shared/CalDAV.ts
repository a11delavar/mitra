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
import { calendarDateOf } from './calendarDate.js'
import { Color } from './Color.js'
import { createLogger } from './Logger.js'

const logger = createLogger('CalDAV')

export interface CalDAVCredentials {
	username: string
	/** The Basic-auth secret. Optional so credential shapes without one (see GoogleCalendar) stay assignable. */
	password?: string
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

	protected override get editableCredentials(): CalDAVCredentials {
		return { username: this.credentials.username, password: '' }
	}

	private client?: ReturnType<typeof createDAVClient>

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

	protected override async fetchSources() {
		const client = await this.getClient()
		const calendars = await client.fetchCalendars()
		logger.debug(`Discovered ${calendars.length} calendar(s) at ${this.uri}`)
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

	/** Build a DTSTART/DTEND/DUE/EXDATE value. All-day entries are written date-only (`VALUE=DATE`) —
	 * that's what makes a real all-day event (not a 00:00→00:00 timed one); `DTEND` stays the exclusive
	 * next day. The DATE is the instant's calendar day in the ENTRY's zone: all-day instants are the
	 * user's local midnights, which the server's own calendar (a UTC container, say) would read as the
	 * day before and write every all-day date one off. */
	static toICALTime(date: DateTime, allDay: boolean, zone: string | null | undefined) {
		if (!allDay) {
			return ICAL.Time.fromJSDate(date, true)
		}
		return ICAL.Time.fromData({ ...calendarDateOf(date, zone), isDate: true })
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

	/** A stored recurrence-id as epoch ms (occurrence instants are compared by ms throughout), or
	 * undefined for none — tolerant of the column surfacing as a Date or a raw ms number. */
	static instantOf(recurrenceId: Date | number | null | undefined): number | undefined {
		return recurrenceId === null || recurrenceId === undefined ? undefined : new Date(recurrenceId).getTime()
	}

	/** A TZID resolved against the resource's own VTIMEZONEs — a zoned resource always carries the
	 * definitions of every TZID it uses (RFC 5545 §3.6.5). */
	private static timezoneIn(comp: ICAL.Component, tzid: string | undefined): ICAL.Timezone | undefined {
		if (!tzid) {
			return undefined
		}
		const vtimezone = comp.getAllSubcomponents('vtimezone')
			.find(candidate => candidate.getFirstPropertyValue('tzid')?.toString() === tzid)
		return vtimezone ? new ICAL.Timezone(vtimezone) : undefined
	}

	/**
	 * Rewrite (or `append`) a date property PRESERVING the form the resource authored it in: a timed
	 * property that carried a TZID keeps it, with the new instant written as that zone's WALL CLOCK;
	 * anything else goes through {@link toICALTime} (all-day `VALUE=DATE`, timed UTC) with any stale
	 * TZID parameter dropped. Writing the UTC form into a TZID property — the old behavior — let the
	 * zone reinterpret the UTC wall clock, shifting the series by the zone offset on zoned servers
	 * like Google. `tzid` overrides which authored zone to follow (e.g. DTSTART's for a fresh EXDATE);
	 * it defaults to the property's own current parameter.
	 */
	private static writeDate(
		comp: ICAL.Component, component: ICAL.Component, name: string,
		date: DateTime, allDay: boolean, zone: string | null | undefined,
		options?: { tzid?: string, append?: boolean },
	): void {
		const tzid = options?.tzid ?? component.getFirstProperty(name)?.getParameter('tzid')?.toString()
		const timezone = allDay ? undefined : CalDAV.timezoneIn(comp, tzid)
		const time = timezone ? ICAL.Time.fromJSDate(date, true).convertToZone(timezone) : CalDAV.toICALTime(date, allDay, zone)
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
			recurrenceId: (component.getFirstPropertyValue('recurrence-id') as { toJSDate?(): Date } | null)?.toJSDate?.() || undefined,
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
					// Gone between listing and fetch (or otherwise unfetchable) — skip it. A later full
					// resync (or a subsequent sync-collection that reports it as removed) reconciles it.
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

		// This source surfaces only one of the collection's component types; the sibling source
		// (sharing the same calendar URL) owns the other.
		const entryType = source.type === SourceType.Task ? EntryType.Task : EntryType.Event

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

		// The sibling source (events + tasks share one collection URL) belongs to the SAME integration —
		// scoped so another user's (or account's) identical member URLs never block ingestion here.
		const siblingSourceIds = (await em.find(Source, { integrationId: source.integrationId }))
			.map(sibling => sibling.id)
			.filter(id => id !== source.id)

		// 2. Handle changes/additions — keep only the components this source represents, skipping the
		// sibling's (and components we don't model, e.g. VJOURNAL) so we never persist an entry
		// without the required `uri`, which would otherwise abort the whole sync's flush.
		for (const obj of changedObjects) {
			if (!obj.data) {
				continue
			}

			// A resource holds ONE scheduling entity (RFC 4791: one UID per resource) but possibly MANY
			// components: the series master plus one override VEVENT per edited occurrence — that's how
			// Google (and every compliant server) ships single-occurrence edits. Each component becomes
			// its own row, identified within the resource by its RECURRENCE-ID (the master has none).
			const comp = new ICAL.Component(ICAL.parse(obj.data))
			const components = comp.getAllSubcomponents(entryType === EntryType.Task ? 'vtodo' : 'vevent')
			if (!components.length) {
				continue
			}

			const normalizedObjUrl = CalDAV.resolveMemberUrl(source.uri, obj.url)
			const rows = existingEntries.filter(e => CalDAV.memberUrlsMatch(source.uri, e.uri, obj.url))

			// The etag is per-resource: unchanged means every row is already in step.
			if (rows.length && rows.every(row => row.data?.etag === obj.etag)) {
				continue
			}

			// A sibling source of the same calendar may already own this member — don't re-file it
			// here as a cross-source duplicate.
			if (!rows.length && siblingSourceIds.length && await em.findOne(Entry, { uri: normalizedObjUrl, sourceId: { $in: siblingSourceIds } })) {
				continue
			}

			const kept = new Set<Entry>()
			for (const component of components) {
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

				if (entryType === EntryType.Event) {
					const event = new ICAL.Event(component)
					entry.heading = event.summary || 'Untitled Event'
					entry.description = event.description || ''
					entry.location = event.location || ''
					entry.start = (event.startDate?.toJSDate() as any) || undefined
					entry.end = (event.endDate ? event.endDate.toJSDate() as any : event.startDate?.toJSDate() as any) || undefined
					// A date-only DTSTART (`VALUE=DATE`) is the iCalendar marker for an all-day event.
					entry.allDay = event.startDate?.isDate ?? false
				} else {
					const value = (name: string) => component.getFirstPropertyValue(name) as any
					entry.heading = value('summary')?.toString() || 'Untitled Task'
					entry.description = value('description')?.toString() || ''
					entry.location = value('location')?.toString() || ''
					entry.status = CalDAV.statusFromICal(value('status')?.toString(), Number(value('percent-complete') ?? 0))
					entry.start = value('dtstart')?.toJSDate?.() as any || undefined
					entry.end = value('due')?.toJSDate?.() as any || undefined
					entry.allDay = !!value('dtstart')?.isDate
				}

				entry.reminders = CalDAV.remindersFrom(component)

				// The zone the entry's times were authored in (recurrence expands wall-clock in it — see
				// backend/occurrences.ts). A UTC or floating DTSTART carries no TZID; that's a legitimate none.
				entry.timeZone = component.getFirstProperty('dtstart')?.getParameter('tzid')?.toString() || null

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

		source.syncState = { syncToken: newSyncToken }

		logger.debug(`Synced "${source.name}": ${changedObjects.length} fetched, ${deletedUrls.length} deleted${changed ? '' : ' (no local changes)'}`)
		return changed
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
			throw new Error(`CalDAV update failed: ${response.status} ${response.statusText}`)
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

		const keys: Array<keyof Entry> = (['heading', 'description', 'location', 'color', 'start', 'end', 'status', 'allDay', 'timeZone', 'reminders'] as const)
			.filter(key => !Object[equals](existing[key], incoming[key]))

		// The recurrence rule is a value object, diffed via its own (absence-safe) structural equality.
		const recurrenceChanged = !Recurrence.equal(existing.recurrence, incoming.recurrence)

		if (keys.length === 0 && !recurrenceChanged && incoming.exdates === undefined) {
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
						CalDAV.writeDate(comp, sub, 'recurrence-id', new Date(rid.getTime() + overrideShift) as unknown as DateTime, false, existing.timeZone)
					}
				}
			}

			// All-day toggling changes whether DTSTART/DTEND are date-only, so a change to `allDay` also
			// rewrites both date properties (even if the instants themselves didn't change).
			if ((keys.includes('start') || keys.includes('allDay')) && incoming.start) {
				CalDAV.writeDate(comp, component, 'dtstart', incoming.start, incoming.allDay, incoming.timeZone)
			}

			// A VTODO's end is DUE (RFC 5545 §3.8.2.3), a VEVENT's is DTEND — matching how sync reads each back.
			if ((keys.includes('end') || keys.includes('allDay')) && incoming.end) {
				const name = isTask ? 'due' : 'dtend'
				// A fresh DTEND/DUE has no authored form of its own yet — it follows DTSTART's.
				const tzid = (component.getFirstProperty(name) ?? component.getFirstProperty('dtstart'))?.getParameter('tzid')?.toString()
				CalDAV.writeDate(comp, component, name, incoming.end, incoming.allDay, incoming.timeZone, { tzid })
			}

			if (isTask && keys.includes('status')) {
				this.writeTaskStatus(component, incoming.status)
				existing.status = incoming.status
			}

			if (keys.includes('reminders')) {
				this.writeReminders(component, incoming.reminders)
				existing.reminders = incoming.reminders
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
				// EXDATEs follow DTSTART's authored form (RFC 5545 matches instances by it).
				const exdateTzid = component.getFirstProperty('dtstart')?.getParameter('tzid')?.toString()
				component.removeAllProperties('exdate')
				for (const ms of incoming.exdates) {
					CalDAV.writeDate(comp, component, 'exdate', new Date(ms) as unknown as DateTime, incoming.allDay, incoming.timeZone, { tzid: exdateTzid, append: true })
				}
			}

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
		!entry.location ? void 0 : component.updatePropertyWithValue('location', entry.location)
		!entry.start ? void 0 : component.updatePropertyWithValue('dtstart', CalDAV.toICALTime(entry.start, entry.allDay, entry.timeZone))
		!entry.end ? void 0 : component.updatePropertyWithValue(isTask ? 'due' : 'dtend', CalDAV.toICALTime(entry.end, entry.allDay, entry.timeZone))
		!entry.color ? void 0 : component.updatePropertyWithValue('color', entry.color)
		!entry.recurrence ? void 0 : component.updatePropertyWithValue('rrule', ICAL.Recur.fromString(entry.recurrence.toRRule(entry.allDay)))
		// The continuation of a split series carries its half of the exclusions (see backend/occurrences.ts).
		entry.exdates?.forEach(ms => component.addPropertyWithValue('exdate', CalDAV.toICALTime(new Date(ms) as unknown as DateTime, entry.allDay, entry.timeZone)))
		if (isTask) {
			this.writeTaskStatus(component, entry.status)
		}
		this.writeReminders(component, entry.reminders)

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
				}
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
				throw new Error(`CalDAV delete failed: ${response.status} ${response.statusText}`)
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
			// zone form follow DTSTART (RFC 5545 matches instances by it).
			CalDAV.writeDate(comp, component, 'exdate', recurrenceId as unknown as DateTime, master.allDay, master.timeZone,
				{ tzid: component.getFirstProperty('dtstart')?.getParameter('tzid')?.toString(), append: true })

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
