import { type EntityManager } from '@mikro-orm/sqlite'
import { equals } from '@a11d/equals'
import { createDAVClient } from 'tsdav'
import ICAL from 'ical.js'
import { Source } from '../../../features/sources/Source.js'
import { Entry } from '../../../features/entries/Entry.js'
import { EntryType } from '../../../features/entries/EntryType.js'
import { Recurrence } from '../../../features/recurrence/Recurrence.js'
import { Color } from '../../../features/sources/Color.js'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import type { Integration, SyncEngine } from '../../Integration.js'
import { CalDAV } from '../CalDAV.js'

const logger = createLogger('CalDAV')

/** CalDAV sync and network CRUD engine supporting CalDAV, Apple Calendar, and Google Calendar. */
export class CalDAVSyncEngine implements SyncEngine {
	private getClient(integration: CalDAV): ReturnType<typeof createDAVClient> {
		return integration.client ??= createDAVClient(integration.clientParameters)
	}

	/** Discovers user calendar addresses (RFC 6638) for participant identification. */
	private async discoverAddresses(integration: CalDAV): Promise<void> {
		if (integration.addresses?.length) {
			return
		}
		let addresses = new Array<string>()
		try {
			const client = await this.getClient(integration)
			const fetch = client.fetchCalendarUserAddresses as unknown as (params: object) => Promise<Array<string>>
			addresses = await fetch({})
		} catch {
			// Fall back to username if discovery fails.
		}
		const emails = addresses
			.filter(address => /^mailto:/i.test(address))
			.map(address => address.replace(/^mailto:/i, '').trim().toLowerCase())
			.filter(address => address.includes('@'))
		if (!emails.length && integration.credentials.username.includes('@')) {
			emails.push(integration.credentials.username.trim().toLowerCase())
		}
		integration.addresses = emails.length ? [...new Set(emails)] : undefined
	}

	async fetchSources(base: Integration): Promise<Array<Source>> {
		const integration = base as CalDAV
		const client = await this.getClient(integration)
		await this.discoverAddresses(integration)
		const calendars = await client.fetchCalendars({
			props: {
				'c:calendar-description': {},
				'c:calendar-timezone': {},
				'd:displayname': {},
				'ca:calendar-color': {},
				'cs:getctag': {},
				'd:resourcetype': {},
				'c:supported-calendar-component-set': {},
				'd:sync-token': {},
				'd:current-user-privilege-set': {},
			},
			projectedProps: { currentUserPrivilegeSet: true },
		})
		logger.debug(`Discovered ${calendars.length} calendar(s) at ${integration.uri}`)
		return calendars.map(cal => {
			const name = typeof cal.displayName === 'string' ? cal.displayName : 'Untitled'
			const color = typeof cal.calendarColor === 'string' ? cal.calendarColor : Color.get(cal.url || name).value
			// Absent or empty supported-calendar-component-set accepts all types (RFC 4791 §5.2.3).
			const components = cal.components ?? []
			const supports = (component: string) => components.length === 0 || components.includes(component)
			const types = [
				...supports('VEVENT') ? [EntryType.Event] : [],
				...supports('VTODO') ? [EntryType.Task] : [],
			]
			const writable = CalDAV.writableFromPrivileges((cal as { projectedProps?: Record<string, unknown> }).projectedProps?.currentUserPrivilegeSet)
			return new Source({ uri: cal.url, entryTypes: types, name, color, enabled: false, readOnly: writable === false ? true : null })
		}).filter(source => source.entryTypes.length > 0)
	}

	private static readonly multigetBatchSize = 100

	private async fetchObjects(
		client: Awaited<ReturnType<typeof createDAVClient>>,
		calendar: { url: string },
		objectUrls: Array<string>,
	): Promise<Awaited<ReturnType<typeof client.fetchCalendarObjects>>> {
		const objects: Awaited<ReturnType<typeof client.fetchCalendarObjects>> = []
		for (let start = 0; start < objectUrls.length; start += CalDAVSyncEngine.multigetBatchSize) {
			objects.push(...await this.multiget(client, calendar, objectUrls.slice(start, start + CalDAVSyncEngine.multigetBatchSize)))
		}
		return objects
	}

	/** Fetches calendar objects with individual retry fallback when batch fails. */
	private async multiget(
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
					skipped++
					logger.debug(`Skipped unfetchable object ${url}`)
				}
			}
			logger.debug(`Refetch recovered ${objects.length} object(s), skipped ${skipped}`)
			return objects
		}
	}

	private static readonly maxListingRequests = 50

	/** Paginates through `sync-collection` to collect changed and deleted member URLs. */
	private async listMembers(
		client: Awaited<ReturnType<typeof createDAVClient>>,
		source: Source,
	): Promise<{ changedUrls: Array<string>, deletedUrls: Array<string>, syncToken?: string, complete: boolean }> {
		const members = new Map<string, 'changed' | 'deleted'>()
		let syncToken: string | undefined = source.syncState?.syncToken || undefined
		let complete = false
		let requests = 0
		for (; requests < CalDAVSyncEngine.maxListingRequests; requests++) {
			const result = await client.syncCollection({
				url: source.uri,
				props: { 'd:getetag': {} },
				syncLevel: 1,
				syncToken,
			})
			const failure = result.find(r => (r.status ?? 200) >= 400 && r.status !== 507 && (!r.href || CalDAV.isCollectionHref(source.uri, r.href)))
			if (failure) {
				logger.warn(`Listing "${source.name}" answered ${failure.status} — keeping the stored entries and the stored sync token`)
				break
			}
			const page = CalDAV.partitionMemberResponses(source.uri, result)
			for (const url of page.changedUrls) {
				members.set(url, 'changed')
			}
			for (const url of page.deletedUrls) {
				members.set(url, 'deleted')
			}
			const returnedToken = result[0]?.raw?.multistatus?.syncToken
			if (!page.truncated) {
				complete = true
				syncToken = returnedToken || syncToken
				break
			}
			if (!returnedToken || returnedToken === syncToken) {
				logger.warn(`"${source.name}" truncated its listing without advancing the sync token — ${members.size} member(s) this pass`)
				break
			}
			syncToken = returnedToken
			logger.debug(`"${source.name}" truncated the listing after request ${requests + 1} (${members.size} member(s) so far) — continuing with the advanced token`)
		}
		if (requests === CalDAVSyncEngine.maxListingRequests) {
			logger.warn(`Stopped listing "${source.name}" after ${requests} sync-collection requests — ${members.size} member(s) this pass, the rest next cycle`)
		}
		return {
			changedUrls: [...members].filter(([, state]) => state === 'changed').map(([url]) => url),
			deletedUrls: [...members].filter(([, state]) => state === 'deleted').map(([url]) => url),
			syncToken,
			complete,
		}
	}

	async syncSourceEntries(base: Integration, em: EntityManager, source: Source): Promise<boolean> {
		const integration = base as CalDAV
		const client = await this.getClient(integration)
		const remoteCalendar = { url: source.uri }
		const priorToken = source.syncState?.syncToken

		const { changedUrls, deletedUrls, syncToken: newSyncToken, complete } = await this.listMembers(client, source)

		const existingEntries = await em.find(Entry, { sourceId: source.id })

		const changedObjects = changedUrls.length
			? await this.fetchObjects(client, remoteCalendar, changedUrls)
			: []

		if (!priorToken && complete) {
			const remoteUris = new Set(changedUrls)
			const alreadyReported = new Set(deletedUrls)
			for (const entry of existingEntries) {
				const entryUrl = CalDAV.resolveMemberUrl(source.uri, entry.uri)
				if (entryUrl && !remoteUris.has(entryUrl) && !alreadyReported.has(entryUrl)) {
					deletedUrls.push(entryUrl)
				}
			}
		} else if (!priorToken) {
			logger.warn(`First listing of "${source.name}" came back incomplete — skipping remote-deletion detection this cycle`)
		}

		let changed = false

		for (const url of deletedUrls) {
			for (const entry of existingEntries.filter(e => CalDAV.memberUrlsMatch(source.uri, e.uri, url))) {
				em.remove(entry)
				changed = true
			}
		}

		for (const obj of changedObjects) {
			if (!obj.data) {
				continue
			}

			// Single resource holds one master and optional override components (RFC 4791).
			const comp = new ICAL.Component(ICAL.parse(obj.data))
			const components = ['vevent', 'vtodo'].flatMap(name => comp.getAllSubcomponents(name))
			if (!components.length) {
				continue
			}

			const normalizedObjUrl = CalDAV.resolveMemberUrl(source.uri, obj.url)
			const rows = existingEntries.filter(e => CalDAV.memberUrlsMatch(source.uri, e.uri, obj.url))

			if (rows.length && rows.every(row => row.data?.etag === obj.etag)) {
				continue
			}

			const kept = new Set<Entry>()
			for (const component of components) {
				const recurrenceId = CalDAV.recurrenceProps(component).recurrenceId
				let entry = rows.find(row => CalDAV.instantOf(row.recurrenceId) === recurrenceId?.getTime())
				if (!entry) {
					entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: normalizedObjUrl })
					em.persist(entry)
					existingEntries.push(entry)
					rows.push(entry)
				}
				kept.add(entry)

				CalDAV.applyComponent(entry, component, integration)

				entry.data ??= {}
				entry.data.raw = obj.data
				entry.data.etag = obj.etag

				changed = true
			}

			for (const row of rows) {
				if (!kept.has(row)) {
					em.remove(row)
					changed = true
				}
			}
		}

		if (CalDAV.linkOverridesToMasters(existingEntries)) {
			changed = true
		}

		await integration.reconcileRelations(em, existingEntries)

		// Mark incomplete if truncated by server to keep import open for subsequent passes.
		source.syncState = { syncToken: newSyncToken, ...complete ? {} : { incomplete: true } }

		logger.debug(`Synced "${source.name}": ${changedObjects.length} fetched, ${deletedUrls.length} deleted${changed ? '' : ' (no local changes)'}`)
		return changed
	}

	private async refetchResource(integration: CalDAV, entry: Entry): Promise<{ raw: string, etag?: string } | undefined> {
		const client = await this.getClient(integration)
		const objects = await client.fetchCalendarObjects({ calendar: { url: new URL('.', entry.uri).href }, objectUrls: [entry.uri!] })
		return objects[0]?.data ? { raw: objects[0].data, etag: objects[0].etag || undefined } : undefined
	}

	/** PUTs the resource with the transformed .ics data, retrying once on 412 with fresh ETag. */
	private async writeResource(integration: CalDAV, entry: Entry, applyTo: (raw: string) => string): Promise<void> {
		const client = await this.getClient(integration)
		let data = applyTo(entry.data!.raw!)
		let response = await client.updateCalendarObject({
			calendarObject: { url: entry.uri!, data, etag: entry.data!.etag || undefined }
		})
		if (response.status === 412) {
			const fresh = await this.refetchResource(integration, entry)
			if (fresh) {
				logger.debug(`Etag of ${entry.uri} was stale (the server re-normalized the resource) — re-applying the edit onto the refreshed copy`)
				data = applyTo(fresh.raw)
				response = await client.updateCalendarObject({
					calendarObject: { url: entry.uri!, data, etag: fresh.etag }
				})
			}
		}
		if (response.ok === false) {
			throw await CalDAV.writeError('update', response)
		}
		entry.data!.raw = data
		const etag = response.headers?.get('etag') || response.headers?.get('Etag') || response.headers?.get('ETag')
		if (etag) {
			entry.data!.etag = etag
		}
	}

	async updateEntry(base: Integration, em: EntityManager, existing: Entry, incoming: Entry): Promise<void> {
		const integration = base as CalDAV
		if (!existing.uri || !existing.data?.raw) {
			throw new Error('Entry must have a URL and raw data to be updated via CalDAV')
		}

		const keys: Array<keyof Entry> = (['heading', 'description', 'location', 'color', 'start', 'end', 'status', 'percentComplete', 'transparency', 'visibility', 'allDay', 'timeZone', 'reminders', 'participants'] as const)
			.filter(key => !Object[equals](existing[key], incoming[key]))

		const recurrenceChanged = !Recurrence.equal(existing.recurrence, incoming.recurrence)
		const relationsChanged = integration.capabilities.relations && incoming.relations !== undefined && existing.relationList.writesDiffer(incoming.relationList)

		if (keys.length === 0 && !recurrenceChanged && incoming.exdates === undefined && !relationsChanged) {
			return
		}

		const overrideShift = keys.includes('start') && existing.recurrence && existing.start && incoming.start
			? incoming.start.getTime() - existing.start.getTime()
			: undefined

		const applyTo = (raw: string): string => {
			const comp = new ICAL.Component(ICAL.parse(raw))
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

			if (overrideShift !== undefined) {
				for (const sub of [...comp.getAllSubcomponents('vevent'), ...comp.getAllSubcomponents('vtodo')]) {
					const rid = CalDAV.recurrenceProps(sub).recurrenceId
					if (rid) {
						CalDAV.writeDate(comp, sub, 'recurrence-id', new Date(rid.getTime() + overrideShift), false, { zone: incoming.timeZone })
					}
				}
			}

			const spanChanged = keys.includes('start') || keys.includes('end') || keys.includes('allDay') || keys.includes('timeZone')
			if (spanChanged) {
				if (incoming.start) {
					CalDAV.writeDate(comp, component, 'dtstart', incoming.start, incoming.allDay, { zone: incoming.timeZone })
				} else {
					component.removeAllProperties('dtstart')
				}
			}

			if (spanChanged) {
				const name = isTask ? 'due' : 'dtend'
				if (incoming.end) {
					CalDAV.writeDate(comp, component, name, incoming.end, incoming.allDay, { zone: incoming.timeZone })
				} else {
					component.removeAllProperties(name)
				}
			}

			if (isTask && (keys.includes('status') || keys.includes('percentComplete'))) {
				CalDAV.writeTaskStatus(component, incoming.status, incoming.percentComplete)
				existing.status = incoming.status
				existing.percentComplete = incoming.percentComplete
			}

			if (!isTask && keys.includes('transparency')) {
				CalDAV.writeTransparency(component, incoming.transparency)
				existing.transparency = incoming.transparency
			}

			if (keys.includes('visibility')) {
				CalDAV.writeVisibility(component, incoming.visibility)
				existing.visibility = incoming.visibility
			}

			if (keys.includes('reminders')) {
				CalDAV.writeReminders(component, incoming.reminders)
				existing.reminders = incoming.reminders
			}

			if (keys.includes('participants')) {
				CalDAV.writeParticipants(component, incoming.participants ?? null)
				existing.participants = incoming.participants
			}

			if (relationsChanged) {
				CalDAV.writeRelations(component, incoming.relations)
			}

			if (recurrenceChanged) {
				if (incoming.recurrence) {
					component.updatePropertyWithValue('rrule', ICAL.Recur.fromString(incoming.recurrence.toRRule(incoming.allDay)))
					existing.uid ||= component.getFirstPropertyValue('uid')?.toString() || undefined
				} else {
					component.removeAllProperties('rrule')
					component.removeAllProperties('exdate')
				}
			}

			if (incoming.exdates !== undefined) {
				component.removeAllProperties('exdate')
				for (const ms of incoming.exdates) {
					CalDAV.writeDate(comp, component, 'exdate', new Date(ms), incoming.allDay, { zone: incoming.timeZone, append: true })
				}
			}

			CalDAV.pruneTimezones(comp)
			return comp.toString()
		}

		await this.writeResource(integration, existing, applyTo)

		if (keys.includes('start')) {
			existing.start = incoming.start
		}
		if (keys.includes('end')) {
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

	async createEntry(base: Integration, em: EntityManager, entry: Entry): Promise<Entry> {
		const integration = base as CalDAV
		const source = entry.sourceId ? await em.findOne(Source, { id: entry.sourceId }) : null
		if (!source?.uri) {
			throw new Error('A target source with a URL is required to create an entry via CalDAV')
		}

		const uid = entry.uid || crypto.randomUUID()
		const filename = `${uid}.ics`

		const comp = new ICAL.Component(['vcalendar', [], []])
		comp.updatePropertyWithValue('prodid', '-//calendar//EN')
		comp.updatePropertyWithValue('version', '2.0')

		const isTask = entry.type.isTask
		const component = new ICAL.Component(isTask ? 'vtodo' : 'vevent')
		component.updatePropertyWithValue('uid', uid)
		component.updatePropertyWithValue('dtstamp', ICAL.Time.now())
		component.updatePropertyWithValue('summary', entry.heading)
		!entry.description ? void 0 : component.updatePropertyWithValue('description', entry.description)
		!entry.location ? void 0 : component.updatePropertyWithValue('location', entry.location)
		!entry.start ? void 0 : CalDAV.writeDate(comp, component, 'dtstart', entry.start, entry.allDay, { zone: entry.timeZone })
		!entry.end ? void 0 : CalDAV.writeDate(comp, component, isTask ? 'due' : 'dtend', entry.end, entry.allDay, { zone: entry.timeZone })
		!entry.color ? void 0 : component.updatePropertyWithValue('color', entry.color)
		!entry.recurrence ? void 0 : component.updatePropertyWithValue('rrule', ICAL.Recur.fromString(entry.recurrence.toRRule(entry.allDay)))
		entry.exdates?.forEach(ms => CalDAV.writeDate(comp, component, 'exdate', new Date(ms), entry.allDay, { zone: entry.timeZone, append: true }))
		if (isTask) {
			CalDAV.writeTaskStatus(component, entry.status, entry.percentComplete)
		} else if (entry.transparency) {
			CalDAV.writeTransparency(component, entry.transparency)
		}
		!entry.visibility ? void 0 : CalDAV.writeVisibility(component, entry.visibility)
		CalDAV.writeReminders(component, entry.reminders)
		if (entry.participants?.length) {
			CalDAV.writeParticipants(component, entry.participants)
		}
		if (integration.capabilities.relations) {
			CalDAV.writeRelations(component, entry.relations)
		}

		comp.addSubcomponent(component)

		const iCalString = comp.toString()

		const client = await this.getClient(integration)
		const response = await client.createCalendarObject({
			calendar: { url: source.uri },
			filename,
			iCalString,
		})

		if (response.ok === false) {
			throw await CalDAV.writeError('create', response)
		}
		logger.debug(`Created ${isTask ? 'VTODO' : 'VEVENT'} ${CalDAV.resolveMemberUrl(source.uri, filename)}`)
		logger.verbose(iCalString)

		entry.uri = CalDAV.resolveMemberUrl(source.uri, filename)
		entry.uid = uid
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

	async deleteEntry(base: Integration, em: EntityManager, entry: Entry): Promise<void> {
		const integration = base as CalDAV
		if (entry.recurrenceId && entry.recurrenceMasterId) {
			const master = await em.findOne(Entry, { id: entry.recurrenceMasterId })
			if (master) {
				return this.excludeOccurrence(integration, em, master, new Date(entry.recurrenceId))
			}
		}
		if (entry.uri) {
			const client = await this.getClient(integration)
			let response = await client.deleteCalendarObject({
				calendarObject: {
					url: entry.uri,
					etag: entry.data?.etag || undefined,
				},
			})
			if (response.status === 412) {
				const fresh = await this.refetchResource(integration, entry)
				response = await client.deleteCalendarObject({
					calendarObject: { url: entry.uri, etag: fresh?.etag }
				})
			}
			if (response.ok === false && response.status !== 404) {
				throw await CalDAV.writeError('delete', response)
			}
			logger.debug(`Deleted ${entry.uri}`)
		}
		em.remove(entry)
	}

	async excludeOccurrence(base: Integration, em: EntityManager, master: Entry, recurrenceId: Date): Promise<void> {
		const integration = base as CalDAV
		if (!master.uri || !master.data?.raw) {
			throw new Error('Master must have a URL and raw data to exclude an occurrence via CalDAV')
		}

		const applyTo = (raw: string): string => {
			const comp = new ICAL.Component(ICAL.parse(raw))
			const component = CalDAV.componentFor(master, comp)
			if (!component) {
				throw new Error('No vevent or vtodo found in master rawData')
			}

			CalDAV.writeDate(comp, component, 'exdate', recurrenceId, master.allDay, { zone: master.timeZone, append: true })

			for (const sub of [...comp.getAllSubcomponents('vevent'), ...comp.getAllSubcomponents('vtodo')]) {
				if (CalDAV.recurrenceProps(sub).recurrenceId?.getTime() === recurrenceId.getTime()) {
					comp.removeSubcomponent(sub)
				}
			}

			return comp.toString()
		}

		await this.writeResource(integration, master, applyTo)

		for (const override of await em.find(Entry, { recurrenceMasterId: master.id })) {
			if (CalDAV.instantOf(override.recurrenceId) === recurrenceId.getTime()) {
				em.remove(override)
			}
		}
		await CalDAV.syncResourceRows(em, master)
	}
}
