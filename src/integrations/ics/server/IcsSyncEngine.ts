import { createHash } from 'node:crypto'
import { type EntityManager } from '@mikro-orm/sqlite'
import ICAL from 'ical.js'
import { Source } from '../../../features/sources/Source.js'
import { Entry } from '../../../features/entries/Entry.js'
import { EntryType } from '../../../features/entries/EntryType.js'
import { Color } from '../../../features/sources/Color.js'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import type { Integration, SyncEngine } from '../../Integration.js'
import { CalDAV } from '../../caldav/CalDAV.js'
import { IcsSubscription, type IcsFeed } from '../IcsSubscription.js'

const logger = createLogger('Subscription')

/** A mis-typed URL must not be read into memory unbounded. */
const maxFeedBytes = 20 * 1024 * 1024
const fetchTimeoutMs = 30_000

/**
 * Sync engine for {@link IcsSubscription}: fetches remote feeds via conditional GET
 * and maps components to entries using {@link CalDAV.applyComponent}.
 */
export class IcsSyncEngine implements SyncEngine {
	private fetchFeed(integration: IcsSubscription, validators?: { etag?: string, lastModified?: string }): Promise<IcsFeed> {
		return integration.feed ??= this.get(integration, validators)
	}

	private async get(integration: IcsSubscription, validators?: { etag?: string, lastModified?: string }): Promise<IcsFeed> {
		const url = IcsSubscription.normalizeUrl(integration.uri)
		if (!url) {
			throw new Error('This subscription has no valid calendar address')
		}

		const headers: Record<string, string> = { accept: 'text/calendar, text/plain;q=0.9, */*;q=0.8' }
		const { authUsername, password } = integration.credentials
		if (password || authUsername) {
			headers.authorization = `Basic ${Buffer.from(`${authUsername ?? ''}:${password ?? ''}`).toString('base64')}`
		}
		if (validators?.etag) {
			headers['if-none-match'] = validators.etag
		}
		if (validators?.lastModified) {
			headers['if-modified-since'] = validators.lastModified
		}

		const response = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(fetchTimeoutMs) })

		if (response.status === 304) {
			return { text: '', notModified: true, etag: validators?.etag, lastModified: validators?.lastModified }
		}
		if (!response.ok) {
			const status = [response.status, response.statusText].filter(Boolean).join(' ')
			throw new Error(response.status === 401 || response.status === 403
				? 'The calendar requires a username and password'
				: response.status === 404
					? 'No calendar was found at that address'
					: `The calendar could not be fetched (${status})`)
		}
		if (Number(response.headers.get('content-length')) > maxFeedBytes) {
			throw new Error('The calendar is too large to subscribe to')
		}
		const text = await response.text()
		if (text.length > maxFeedBytes) {
			throw new Error('The calendar is too large to subscribe to')
		}
		if (!/BEGIN:VCALENDAR/i.test(text)) {
			throw new Error('The address did not return a calendar')
		}

		return {
			text,
			etag: response.headers.get('etag') ?? undefined,
			lastModified: response.headers.get('last-modified') ?? undefined,
		}
	}

	/** Discovers the calendar from the feed, extracting name, color, and supported types. */
	async fetchSources(base: Integration, existing?: ReadonlyArray<Source>): Promise<Array<Source>> {
		const integration = base as IcsSubscription
		const uri = IcsSubscription.normalizeUrl(integration.uri)
		if (!uri) {
			throw new Error('Enter a calendar address (a webcal:// or https:// link ending in .ics)')
		}
		integration.uri = uri

		const stored = existing?.find(source => source.uri === uri)
		const feed = await this.fetchFeed(integration, stored?.syncState)

		if (feed.notModified && stored) {
			return [new Source({ uri, name: stored.remoteName || stored.name, color: stored.color, entryTypes: stored.entryTypes, enabled: stored.enabled })]
		}

		const calendar = new ICAL.Component(ICAL.parse(feed.text))
		const components = IcsSyncEngine.modelledComponents(calendar)

		const name = calendar.getFirstPropertyValue('x-wr-calname')?.toString().trim() || IcsSyncEngine.nameFromUrl(uri)
		integration.credentials.username = name

		const color = stored?.color || calendar.getFirstPropertyValue('x-apple-calendar-color')?.toString() || Color.get(uri).value
		const types = [
			...components.some(component => component.name === 'vevent') ? [EntryType.Event] : [],
			...components.some(component => component.name === 'vtodo') ? [EntryType.Task] : [],
		]

		logger.debug(`Discovered "${name}" at ${uri}: ${components.length} component(s)`)
		return [new Source({ uri, name, color, entryTypes: types.length ? types : [EntryType.Event], enabled: false })]
	}

	private static nameFromUrl(uri: string): string {
		const url = new URL(uri)
		const file = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '').replace(/\.ics$/i, '').trim()
		return file || url.hostname
	}

	async syncSourceEntries(base: Integration, em: EntityManager, source: Source): Promise<boolean> {
		const integration = base as IcsSubscription
		const feed = await this.fetchFeed(integration, source.syncState)

		if (feed.notModified) {
			logger.debug(`"${source.name}" is unchanged (304)`)
			return false
		}

		// Content hash backstop for servers returning new timestamps for identical bodies.
		const contentHash = createHash('sha256').update(feed.text).digest('hex')
		if (source.syncState?.contentHash === contentHash) {
			source.syncState = { etag: feed.etag, lastModified: feed.lastModified, contentHash }
			logger.debug(`"${source.name}" is unchanged (identical body)`)
			return false
		}

		const calendar = new ICAL.Component(ICAL.parse(feed.text))
		const timezones = calendar.getAllSubcomponents('vtimezone')
		// Group components by UID (master and occurrence overrides).
		const entities = new Map<string, Array<ICAL.Component>>()
		for (const component of IcsSyncEngine.modelledComponents(calendar)) {
			const uid = component.getFirstPropertyValue('uid')?.toString() || IcsSyncEngine.syntheticUid(component)
			const group = entities.get(uid)
			if (group) {
				group.push(component)
			} else {
				entities.set(uid, [component])
			}
		}

		const existingEntries = await em.find(Entry, { sourceId: source.id })
		let changed = false

		for (const [uid, components] of entities) {
			const rows = existingEntries.filter(entry => entry.uri === uid)
			const raw = IcsSyncEngine.serialize(components, timezones)
			if (rows.length && rows.every(row => row.data?.raw === raw)) {
				continue
			}

			const kept = new Set<Entry>()
			for (const component of components) {
				const recurrenceId = CalDAV.recurrenceProps(component).recurrenceId
				let entry = rows.find(row => CalDAV.instantOf(row.recurrenceId) === recurrenceId?.getTime())
				if (!entry) {
					entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: uid })
					em.persist(entry)
					existingEntries.push(entry)
					rows.push(entry)
				}
				kept.add(entry)

				CalDAV.applyComponent(entry, component, integration)
				entry.uid = uid
				entry.data = { raw }

				changed = true
			}

			for (const row of rows) {
				if (!kept.has(row)) {
					em.remove(row)
					changed = true
				}
			}
		}

		// Remove entries no longer present in the feed.
		for (const entry of existingEntries) {
			if (entry.uri && !entities.has(entry.uri)) {
				em.remove(entry)
				changed = true
			}
		}

		if (CalDAV.linkOverridesToMasters(existingEntries)) {
			changed = true
		}

		source.syncState = { etag: feed.etag, lastModified: feed.lastModified, contentHash }

		logger.debug(`Synced "${source.name}": ${entities.size} entit(ies)${changed ? '' : ' (no local changes)'}`)
		return changed
	}

	private static modelledComponents(calendar: ICAL.Component): Array<ICAL.Component> {
		return ['vevent', 'vtodo'].flatMap(name => calendar.getAllSubcomponents(name))
	}

	/** Generates a stable synthetic UID for UID-less components by hashing component content. */
	private static syntheticUid(component: ICAL.Component): string {
		return `mitra-ics-${createHash('sha256').update(component.toString()).digest('hex').slice(0, 32)}`
	}

	/** Serializes components and referenced VTIMEZONEs into a standalone VCALENDAR string. */
	private static serialize(components: ReadonlyArray<ICAL.Component>, timezones: ReadonlyArray<ICAL.Component>): string {
		const referenced = new Set(components.flatMap(component => component.getAllProperties()
			.map(property => property.getParameter('tzid')?.toString())
			.filter((tzid): tzid is string => !!tzid)))
		const calendar = new ICAL.Component('vcalendar')
		calendar.addPropertyWithValue('version', '2.0')
		calendar.addPropertyWithValue('prodid', '-//mitra//subscription//EN')
		for (const timezone of timezones) {
			if (referenced.has(timezone.getFirstPropertyValue('tzid')?.toString() ?? '')) {
				calendar.addSubcomponent(timezone)
			}
		}
		for (const component of components) {
			calendar.addSubcomponent(component)
		}
		return calendar.toString()
	}

	// Subscriptions are read-only; mutation methods throw unconditionally.
	private static readonly readOnly = () => { throw new Error('Subscribed calendars are read-only') }

	createEntry(): Promise<Entry> { return IcsSyncEngine.readOnly() }
	updateEntry(): Promise<void> { return IcsSyncEngine.readOnly() }
	deleteEntry(): Promise<void> { return IcsSyncEngine.readOnly() }
	excludeOccurrence(): Promise<void> { return IcsSyncEngine.readOnly() }
}
