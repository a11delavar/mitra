import { type EntityManager } from '@mikro-orm/sqlite'
import { equals } from '@a11d/equals'
import { createDAVClient } from 'tsdav'
import ICAL from 'ical.js'
import { model } from './model.js'
import { entity } from './orm.js'
import { Source, SourceType } from './Source.js'
import { Integration } from './Integration.js'
import { Entry, EntryType } from './Entry.js'
import { CalendarColor } from './CalendarColor.js'

export interface CalDAVConfig {
	serverUrl: string
	username: string
	password: string
}

@model('CalDAV')
@entity({ discriminatorValue: 'caldav' })
export class CalDAV extends Integration<CalDAVConfig> {
	constructor(init?: Partial<CalDAV>) {
		super()
		Object.assign(this, init)
	}

	override toString() {
		return `${this.type} integration for "${this.config.username}" at ${this.config.serverUrl}`
	}

	override merge(incoming: CalDAV) {
		this.config = {
			serverUrl: incoming.config.serverUrl,
			username: incoming.config.username,
			// A blank incoming password keeps the stored secret — the edit form leaves it empty.
			password: incoming.config.password || this.config.password,
		}
	}

	private client?: ReturnType<typeof createDAVClient>

	// Memoized so a multi-step operation (discover + sync entries) shares one account discovery.
	private getClient(): ReturnType<typeof createDAVClient> {
		return this.client ??= createDAVClient({
			defaultAccountType: 'caldav',
			authMethod: 'Basic',
			serverUrl: this.config.serverUrl,
			credentials: {
				username: this.config.username,
				password: this.config.password,
			},
		})
	}

	protected override async fetchSources() {
		const client = await this.getClient()
		const calendars = await client.fetchCalendars()
		return calendars.map(cal => {
			const name = typeof cal.displayName === 'string' ? cal.displayName : 'Untitled'
			return new Source({
				type: SourceType.Calendar,
				url: cal.url,
				externalId: cal.url,
				name,
				color: CalendarColor.get(cal.url || name).value,
				enabled: false,
			})
		})
	}

	protected override async syncSourceEntries(em: EntityManager, source: Source): Promise<boolean> {
		const client = await this.getClient()
		const remoteCalendar = { url: source.url! }
		const result = await client.syncCollection({
			url: source.url!,
			props: { 'd:getetag': {} },
			syncLevel: 1,
			syncToken: source.syncToken || undefined
		})

		const newSyncToken = result[0]?.raw?.multistatus?.syncToken || source.syncToken

		let changedObjects: Awaited<ReturnType<typeof client.fetchCalendarObjects>> = []
		let deletedUrls = new Array<string>()

		// Existing entries are looked up by foreign key, never populated.
		const existingEntries = await em.find(Entry, { sourceId: source.id })

		if (!source.syncToken) {
			changedObjects = await client.fetchCalendarObjects({ calendar: remoteCalendar })
			const remoteUrls = new Set(changedObjects.map(o => o.url))
			deletedUrls = existingEntries.filter(e => !remoteUrls.has(e.url!)).map(e => e.url!)
		} else {
			const objectResponses = result.filter(r => r.href && r.href !== source.url && r.href + '/' !== source.url && source.url + '/' !== r.href)
			deletedUrls = objectResponses.filter(r => r.status === 404).map(r => r.href!)
			const changedUrls = objectResponses.filter(r => r.status !== 404).map(r => r.href!)

			if (changedUrls.length > 0) {
				changedObjects = await client.fetchCalendarObjects({
					calendar: remoteCalendar,
					objectUrls: changedUrls,
				})
			}
		}

		// 1. Handle deletions
		for (const url of deletedUrls) {
			const entry = existingEntries.find(e => e.url === url)
			if (entry) {
				em.remove(entry)
			}
		}

		// 2. Handle changes/additions
		for (const obj of changedObjects) {
			if (!obj.data) continue

			let entry = existingEntries.find(e => e.url === obj.url)
			if (!entry) {
				entry = new Entry({ sourceId: source.id, url: obj.url })
				em.persist(entry)
				existingEntries.push(entry)
			}

			if (entry.etag !== obj.etag) {
				entry.rawData = obj.data
				entry.etag = obj.etag

				const comp = new ICAL.Component(ICAL.parse(obj.data))
				const vevent = comp.getFirstSubcomponent('vevent')

				if (vevent) {
					const event = new ICAL.Event(vevent)
					entry.externalId = event.uid
					entry.type = EntryType.Event
					entry.heading = event.summary || 'Untitled Event'
					entry.description = event.description || ''
					entry.color = source.color
					entry.start = (event.startDate?.toJSDate() as any) || undefined
					entry.end = (event.endDate ? event.endDate.toJSDate() as any : event.startDate?.toJSDate() as any) || undefined
				}
			}
		}

		source.syncToken = newSyncToken

		// Report whether actual entries changed. The sync-token bookkeeping above must NOT count,
		// or the background sync would notify clients every cycle (clobbering in-progress edits).
		return deletedUrls.length > 0 || changedObjects.length > 0
	}

	async updateEntry(_em: EntityManager, existing: Entry, incoming: Entry): Promise<void> {
		if (!existing.url || !existing.rawData) {
			throw new Error('Entry must have a URL and rawData to be updated via CalDAV')
		}

		const keys: Array<keyof Entry> = (['heading', 'description', 'color', 'start', 'end', 'done'] as const)
			.filter(key => !Object[equals](existing[key], incoming[key]))

		if (keys.length === 0) {
			return
		}

		const comp = new ICAL.Component(ICAL.parse(existing.rawData))

		const vevent = comp.getFirstSubcomponent('vevent')
		if (!vevent) {
			throw new Error('No vevent found in entry rawData')
		}

		if (keys.includes('heading')) {
			vevent.updatePropertyWithValue('summary', incoming.heading)
			existing.heading = incoming.heading
		}

		if (keys.includes('description')) {
			vevent.updatePropertyWithValue('description', incoming.description)
			existing.description = incoming.description
		}

		if (keys.includes('start')) {
			vevent.updatePropertyWithValue('dtstart', ICAL.Time.fromJSDate(incoming.start!, true))
			existing.start = incoming.start
		}

		if (keys.includes('end')) {
			vevent.updatePropertyWithValue('dtend', ICAL.Time.fromJSDate(incoming.end!, true))
			existing.end = incoming.end
		}

		existing.rawData = comp.toString()

		const client = await this.getClient()
		const response = await client.updateCalendarObject({
			calendarObject: {
				url: existing.url,
				data: existing.rawData,
				etag: existing.etag || undefined,
			}
		})

		const etag = response.headers?.get('etag') || response.headers?.get('Etag') || response.headers?.get('ETag')
		if (etag) {
			existing.etag = etag
		}
	}

	async createEntry(em: EntityManager, entry: Entry): Promise<Entry> {
		const source = entry.sourceId ? await em.findOne(Source, { id: entry.sourceId }) : null
		if (!source?.url) {
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

		comp.addSubcomponent(vevent)

		const iCalString = comp.toString()

		const client = await this.getClient()
		const response = await client.createCalendarObject({
			calendar: { url: source.url },
			filename,
			iCalString,
		})

		entry.externalId = uid
		entry.type = EntryType.Event
		entry.url = new URL(filename, source.url.endsWith('/') ? source.url : `${source.url}/`).href
		entry.rawData = iCalString
		entry.color = source.color
		const etag = response.headers?.get('etag') || response.headers?.get('Etag') || response.headers?.get('ETag')
		if (etag) {
			entry.etag = etag
		}

		em.persist(entry)
		return entry
	}

	async deleteEntry(em: EntityManager, entry: Entry): Promise<void> {
		if (entry.url) {
			const client = await this.getClient()
			await client.deleteCalendarObject({
				calendarObject: {
					url: entry.url,
					etag: entry.etag || undefined,
				}
			})
		}
		em.remove(entry)
	}
}
