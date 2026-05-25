import { model } from './model.js'
import { entity } from './orm.js'
import { type EntityManager } from '@mikro-orm/sqlite'
import { Source, SourceType } from './Source.js'
import { Integration } from './Integration.js'
import { Entry, EntryType } from './Entry.js'
import { CalendarColor } from './CalendarColor.js'
import { createDAVClient } from 'tsdav'
import ICAL from 'ical.js'

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

	private getClient(): ReturnType<typeof createDAVClient> {
		return createDAVClient({
			defaultAccountType: 'caldav',
			authMethod: 'Basic',
			serverUrl: this.config.serverUrl,
			credentials: {
				username: this.config.username,
				password: this.config.password,
			},
		})
	}

	async sync(em: EntityManager) {
		const client = await this.getClient()

		// 1. Sync Sources (Calendars)
		if (!this.sources.isInitialized()) await this.sources.init()
		const existingSources = this.sources.getItems()
		const remoteCalendars = await client.fetchCalendars()

		const remoteUrls = new Set(remoteCalendars.map(c => c.url))

		// Delete removed sources
		for (const source of existingSources) {
			if (!remoteUrls.has(source.url!)) {
				em.remove(source)
				this.sources.remove(source)
			}
		}

		// Upsert sources and sync their entries
		for (const cal of remoteCalendars) {
			let source = existingSources.find(s => s.url === cal.url)
			if (!source) {
				source = new Source({
					integration: this,
					url: cal.url,
					externalId: cal.url,
					type: SourceType.Calendar,
					name: typeof cal.displayName === 'string' ? cal.displayName : 'Untitled',
					color: CalendarColor.get(cal.url || (typeof cal.displayName === 'string' ? cal.displayName : 'default')).value,
					enabled: false,
				})
				em.persist(source)
				this.sources.add(source)
			} else {
				source.name = typeof cal.displayName === 'string' ? cal.displayName : source.name
			}

			if (source.enabled) {
				await this.syncEntries(client, source, cal, em)
			}
		}
	}

	private async syncEntries(client: Awaited<ReturnType<typeof createDAVClient>>, source: Source, remoteCalendar: { url: string }, em: EntityManager) {
		const result = await client.syncCollection({
			url: source.url!,
			props: { 'DAV:getetag': {} },
			syncLevel: 1,
			syncToken: source.syncToken || undefined
		})

		const newSyncToken = (result[0] as any)?.raw?.multistatus?.syncToken || source.syncToken

		let changedObjects: Awaited<ReturnType<typeof client.fetchCalendarObjects>> = []
		let deletedUrls = new Array<string>()

		if (!source.syncToken) {
			changedObjects = await client.fetchCalendarObjects({ calendar: remoteCalendar })
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

		if (!source.entries.isInitialized()) await source.entries.init()
		const existingEntries = source.entries.getItems()

		// 1. Handle deletions
		for (const url of deletedUrls) {
			const entry = existingEntries.find(e => e.url === url)
			if (entry) {
				em.remove(entry)
				source.entries.remove(entry)
			}
		}

		// 2. Handle changes/additions
		for (const obj of changedObjects) {
			if (!obj.data) continue

			let entry = existingEntries.find(e => e.url === obj.url)
			if (!entry) {
				entry = new Entry({ source, url: obj.url })
				em.persist(entry)
				source.entries.add(entry)
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
	}
}
