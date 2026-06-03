import { type EntityManager } from '@mikro-orm/sqlite'
import { equals } from '@a11d/equals'
import { createDAVClient } from 'tsdav'
import ICAL from 'ical.js'
import { model } from './model.js'
import { entity } from './orm.js'
import { Source, SourceType } from './Source.js'
import { Integration } from './Integration.js'
import { Entry, EntryType } from './Entry.js'
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

	/** A source's calendar-collection URL, normalized to end in `/` so member filenames resolve against it. */
	private collectionUrl(source: Source) {
		return source.uri.endsWith('/') ? source.uri : `${source.uri}/`
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

		// syncCollection returns one response per member href, of every component type (VEVENT,
		// VTODO, …) — unlike fetchCalendarObjects({ calendar }), which only returns events. With no
		// prior token it lists the whole collection; incrementally, just the changed/removed members.
		const memberResponses = result.filter(r => r.href && r.href !== source.uri && r.href + '/' !== source.uri && source.uri + '/' !== r.href)
		const changedUrls = memberResponses.filter(r => r.status !== 404).map(r => r.href!)
		const deletedUrls = memberResponses.filter(r => r.status === 404).map(r => r.href!)

		const changedObjects: Awaited<ReturnType<typeof client.fetchCalendarObjects>> = changedUrls.length
			? await client.fetchCalendarObjects({ calendar: remoteCalendar, objectUrls: changedUrls })
			: []

		// On a full sync (no prior token) every current member is listed, so any local entry that's
		// no longer present was removed remotely.
		if (!source.syncState?.syncToken) {
			const remoteUris = new Set(changedUrls)
			for (const entry of existingEntries) {
				if (entry.uri && !remoteUris.has(entry.uri)) {
					deletedUrls.push(entry.uri)
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
			const entry = existingEntries.find(e => e.uri === url)
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

			let entry = existingEntries.find(e => e.uri === obj.url)
			if (!entry) {
				entry = new Entry({ sourceId: source.id, uri: obj.url })
				em.persist(entry)
				existingEntries.push(entry)
			}

			if (entry.data?.etag === obj.etag) {
				continue
			}

			entry.type = entryType
			entry.color = component.getFirstPropertyValue('color')?.toString() || undefined
			entry.data ??= {}
			entry.data.raw = obj.data
			entry.data.etag = obj.etag

			if (entryType === EntryType.Event) {
				const event = new ICAL.Event(component)
				entry.heading = event.summary || 'Untitled Event'
				entry.description = event.description || ''
				entry.start = (event.startDate?.toJSDate() as any) || undefined
				entry.end = (event.endDate ? event.endDate.toJSDate() as any : event.startDate?.toJSDate() as any) || undefined
			} else {
				const value = (name: string) => component.getFirstPropertyValue(name) as any
				entry.heading = value('summary')?.toString() || 'Untitled Task'
				entry.description = value('description')?.toString() || ''
				entry.done = value('status')?.toString() === 'COMPLETED' || Number(value('percent-complete') ?? 0) >= 100
				entry.start = value('dtstart')?.toJSDate?.() as any || undefined
				entry.end = value('due')?.toJSDate?.() as any || undefined
			}

			changed = true
		}

		source.syncState = { syncToken: newSyncToken }

		return changed
	}

	async updateEntry(_em: EntityManager, existing: Entry, incoming: Entry): Promise<void> {
		if (!existing.uri || !existing.data?.raw) {
			throw new Error('Entry must have a URL and raw data to be updated via CalDAV')
		}

		const keys: Array<keyof Entry> = (['heading', 'description', 'color', 'start', 'end', 'done'] as const)
			.filter(key => !Object[equals](existing[key], incoming[key]))

		if (keys.length === 0) {
			return
		}

		const comp = new ICAL.Component(ICAL.parse(existing.data?.raw))

		const component = comp.getFirstSubcomponent('vevent') ?? comp.getFirstSubcomponent('vtodo')
		if (!component) {
			throw new Error('No vevent or vtodo found in entry rawData')
		}

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

		if (keys.includes('start')) {
			component.updatePropertyWithValue('dtstart', ICAL.Time.fromJSDate(incoming.start!, true))
			existing.start = incoming.start
		}

		if (keys.includes('end')) {
			component.updatePropertyWithValue('dtend', ICAL.Time.fromJSDate(incoming.end!, true))
			existing.end = incoming.end
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

		const vevent = new ICAL.Component('vevent')
		vevent.updatePropertyWithValue('uid', uid)
		vevent.updatePropertyWithValue('dtstamp', ICAL.Time.now())
		vevent.updatePropertyWithValue('summary', entry.heading)
		!entry.description ? void 0 : vevent.updatePropertyWithValue('description', entry.description)
		!entry.start ? void 0 : vevent.updatePropertyWithValue('dtstart', ICAL.Time.fromJSDate(entry.start, true))
		!entry.end ? void 0 : vevent.updatePropertyWithValue('dtend', ICAL.Time.fromJSDate(entry.end, true))
		!entry.color ? void 0 : vevent.updatePropertyWithValue('color', entry.color)

		comp.addSubcomponent(vevent)

		const iCalString = comp.toString()

		const client = await this.getClient()
		const response = await client.createCalendarObject({
			calendar: { url: source.uri },
			filename,
			iCalString,
		})

		entry.type = EntryType.Event
		entry.uri = new URL(filename, this.collectionUrl(source)).href
		entry.data ??= {}
		entry.data.raw = iCalString
		entry.color = entry.color || undefined
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
}
