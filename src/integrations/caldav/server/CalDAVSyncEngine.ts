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

/**
 * The network/CRUD half of {@link CalDAV} (and, since they inherit its manifest, {@link
 * ../../apple/AppleCalendar.js} and {@link ../../google/GoogleCalendar.js}) — everything
 * {@link CalDAV.ts} used to implement directly, before splitting so that class could stay the frontend's
 * API model without pulling `tsdav`/`ical.js` into the browser bundle. Registered once, for all three
 * discriminators, by server/registerEngines.ts.
 *
 * Every method takes the `integration` it's acting for as an argument rather than reading `this` —
 * this engine is a SINGLETON shared by every connected CalDAV/Apple/Google account — and immediately
 * narrows it to {@link CalDAV}: safe, because the registration is exactly what guarantees only an
 * instance of one of those three ever reaches it. The pure iCalendar ↔ Entry mapping vocabulary
 * (statusFromICal, participantsFrom, writeDate, …) stays on {@link CalDAV} itself — it's the class's
 * own knowledge of the CalDAV wire format, not sync machinery, and every one of those statics is
 * exercised directly by CalDAV.test.ts.
 */
export class CalDAVSyncEngine implements SyncEngine {
	/**
	 * Memoized on the INTEGRATION, not on this engine: the engine is a singleton shared by every
	 * connected account, while the integration instance is the very object one request (or sync cycle)
	 * works with — so `CalDAV.client` gives each account its own connection and lets a multi-step
	 * operation (discover + sync entries) share one account discovery, exactly as it did before the
	 * engine was split out. It is also the seam the sync tests inject a stub client through.
	 */
	private getClient(integration: CalDAV): ReturnType<typeof createDAVClient> {
		return integration.client ??= createDAVClient(integration.clientParameters)
	}

	/**
	 * The account's own calendar-user addresses off the principal's `calendar-user-address-set`
	 * (RFC 6638) — what identifies "me" among an entry's participants and lets scheduling servers
	 * accept an ORGANIZER we write. Sticky once found; falls back to an e-mail-shaped username on
	 * servers without scheduling support (their PROPFIND lacks the property).
	 */
	private async discoverAddresses(integration: CalDAV): Promise<void> {
		if (integration.addresses?.length) {
			return
		}
		let addresses = new Array<string>()
		try {
			const client = await this.getClient(integration)
			// tsdav injects the client's discovered account (principal URL included); passing our own
			// would clobber it — hence the empty params object the bound type doesn't know is complete.
			const fetch = client.fetchCalendarUserAddresses as unknown as (params: object) => Promise<Array<string>>
			addresses = await fetch({})
		} catch {
			// No scheduling support (or the PROPFIND failed) — fall through to the username.
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
		// Custom props REPLACE tsdav's defaults rather than extending them, so the whole set is restated
		// with the privilege one appended; `projectedProps` is what carries it back out per calendar.
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
		// ONE source per collection, carrying the TYPES it accepts — never an event/task sibling pair for
		// the same URL (which cost two sync passes, two tokens and a cross-source duplicate guard, all to
		// re-split what the server keeps together).
		return calendars.map(cal => {
			const name = typeof cal.displayName === 'string' ? cal.displayName : 'Untitled'
			const color = typeof cal.calendarColor === 'string' ? cal.calendarColor : Color.get(cal.url || name).value
			// Per RFC 4791 §5.2.3 an absent/empty supported-calendar-component-set means the
			// collection accepts every component type — so an empty list supports both.
			const components = cal.components ?? []
			const supports = (component: string) => components.length === 0 || components.includes(component)
			const types = [
				...supports('VEVENT') ? [EntryType.Event] : [],
				...supports('VTODO') ? [EntryType.Task] : [],
			]
			const writable = CalDAV.writableFromPrivileges((cal as { projectedProps?: Record<string, unknown> }).projectedProps?.currentUserPrivilegeSet)
			return new Source({ uri: cal.url, entryTypes: types, name, color, enabled: false, readOnly: writable === false ? true : null })
		// A collection that accepts neither (a VJOURNAL-only one) holds nothing mitra models — drop it.
		}).filter(source => source.entryTypes.length > 0)
	}

	/** Batch size for `calendar-multiget` REPORT requests. */
	private static readonly multigetBatchSize = 100

	/** Fetch the changed members' iCalendar bodies, a batch at a time. */
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

	/**
	 * Fetches a batch of calendar objects. If a member returns 404 (e.g. deleted during delta fetch),
	 * falls back to fetching objects individually so the overall sync and token advancement succeed.
	 */
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

	/** Maximum chained `sync-collection` requests per pass to prevent infinite pagination loops. */
	private static readonly maxListingRequests = 50

	/**
	 * Paginates through `sync-collection` responses to collect all changed and deleted member URLs.
	 * `complete` indicates an untruncated listing, which is required before inferring remote deletions.
	 */
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
			// Treat collection-level errors (>=400) as non-fatal aborts to preserve stored state and token.
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
			// Guard against servers truncating without advancing the sync token.
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

		// Existing entries are looked up by foreign key, never populated.
		const existingEntries = await em.find(Entry, { sourceId: source.id })

		const changedObjects = changedUrls.length
			? await this.fetchObjects(client, remoteCalendar, changedUrls)
			: []

		// On a full sync without a prior token, missing local entries are deleted only if the listing is complete.
		if (!priorToken && complete) {
			const remoteUris = new Set(changedUrls) // already resolved to full URLs
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

		// 2. Handle changes/additions — every component the collection can hold lands in this one source
		// (its `entryTypes` only says what may be CREATED here); components we don't model (VJOURNAL &
		// co) are skipped, so we never persist an entry without the required `uri`, which would otherwise
		// abort the whole sync's flush.
		for (const obj of changedObjects) {
			if (!obj.data) {
				continue
			}

			// A resource holds ONE scheduling entity (RFC 4791: one UID per resource) but possibly MANY
			// components: the series master plus one override VEVENT per edited occurrence — that's how
			// Google (and every compliant server) ships single-occurrence edits. Each component becomes
			// its own row, identified within the resource by its RECURRENCE-ID (the master has none).
			// Both modelled types are read; RFC 4791 §4.1 forbids MIXING component types within one
			// resource, so a resource's rows are always single-type and the (source, uri, recurrenceId)
			// identity below stays unambiguous.
			const comp = new ICAL.Component(ICAL.parse(obj.data))
			const components = ['vevent', 'vtodo'].flatMap(name => comp.getAllSubcomponents(name))
			if (!components.length) {
				continue
			}

			const normalizedObjUrl = CalDAV.resolveMemberUrl(source.uri, obj.url)
			const rows = existingEntries.filter(e => CalDAV.memberUrlsMatch(source.uri, e.uri, obj.url))

			// The etag is per-resource: unchanged means every row is already in step.
			if (rows.length && rows.every(row => row.data?.etag === obj.etag)) {
				continue
			}

			const kept = new Set<Entry>()
			for (const component of components) {
				// Recurrence: a master carries an RRULE; a single edited occurrence is its own component
				// carrying a RECURRENCE-ID and the shared UID. Occurrences are expanded later, on read.
				const recurrenceId = CalDAV.recurrenceProps(component).recurrenceId
				let entry = rows.find(row => CalDAV.instantOf(row.recurrenceId) === recurrenceId?.getTime())
				if (!entry) {
					entry = new Entry({ id: crypto.randomUUID(), sourceId: source.id, uri: normalizedObjUrl })
					em.persist(entry)
					existingEntries.push(entry)
					rows.push(entry)
				}
				kept.add(entry)

				// Parsing relations makes them authoritative, so the reconcile below mirrors them; not
				// parsing leaves the stored rows alone (see capabilities).
				CalDAV.applyComponent(entry, component, integration)

				entry.data ??= {}
				entry.data.raw = obj.data
				entry.data.etag = obj.etag

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

		if (CalDAV.linkOverridesToMasters(existingEntries)) {
			changed = true
		}

		// Mirror the re-parsed entries' relationships into the queryable store (entries untouched
		// this cycle carry `undefined` and are skipped; a removed entry's rows cascade with it).
		await integration.reconcileRelations(em, existingEntries)

		source.syncState = { syncToken: newSyncToken }

		logger.debug(`Synced "${source.name}": ${changedObjects.length} fetched, ${deletedUrls.length} deleted${changed ? '' : ' (no local changes)'}`)
		return changed
	}

	/** The freshest copy of the entry's resource — the base for a concurrency retry. */
	private async refetchResource(integration: CalDAV, entry: Entry): Promise<{ raw: string, etag?: string } | undefined> {
		const client = await this.getClient(integration)
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
		// tsdav returns the raw fetch Response and does NOT throw on a non-2xx.
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

		// The recurrence rule is a value object, diffed via its own (absence-safe) structural equality.
		const recurrenceChanged = !Recurrence.equal(existing.recurrence, incoming.recurrence)

		// Relations are tri-state like `recurrence` (undefined = keep) and compare by their own value
		// semantics; the caller populated `existing.relations` from the store (see entries.ts PUT).
		// A server that discards RELATED-TO gets no line and no PUT for one: the route's own reconcile
		// is what persists the edit there, and writing a line the next read won't return would only
		// make the resource churn.
		const relationsChanged = integration.capabilities.relations && incoming.relations !== undefined && existing.relationList.writesDiffer(incoming.relationList)

		if (keys.length === 0 && !recurrenceChanged && incoming.exdates === undefined && !relationsChanged) {
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
						// The RECURRENCE-ID must match the series' authored form (the master's zone).
						CalDAV.writeDate(comp, sub, 'recurrence-id', new Date(rid.getTime() + overrideShift), false, { zone: incoming.timeZone })
					}
				}
			}

			// All-day toggling flips DTSTART/DTEND between date-only and timed, and a zone change rewrites
			// their TZID + local representation — so a change to `allDay` OR `timeZone` rewrites both date
			// properties too (even where the instants themselves didn't move). Both follow the entry's
			// authoring zone, so DTEND automatically matches DTSTART's form.
			// A cleared value REMOVES the property — that is how a task is unscheduled (a VTODO's date
			// properties are both optional, RFC 5545 §3.6.2). An event can't reach this: DTSTART is
			// REQUIRED of a VEVENT, and `Entry.unschedulable` keeps the gesture away from one.
			const spanChanged = keys.includes('start') || keys.includes('end') || keys.includes('allDay') || keys.includes('timeZone')
			if (spanChanged) {
				if (incoming.start) {
					CalDAV.writeDate(comp, component, 'dtstart', incoming.start, incoming.allDay, { zone: incoming.timeZone })
				} else {
					component.removeAllProperties('dtstart')
				}
			}

			// A VTODO's end is DUE (RFC 5545 §3.8.2.3), a VEVENT's is DTEND — matching how sync reads each back.
			if (spanChanged) {
				const name = isTask ? 'due' : 'dtend'
				if (incoming.end) {
					CalDAV.writeDate(comp, component, name, incoming.end, incoming.allDay, { zone: incoming.timeZone })
				} else {
					component.removeAllProperties(name)
				}
			}

			// STATUS and PERCENT-COMPLETE are written together to keep completed coupling consistent.
			if (isTask && (keys.includes('status') || keys.includes('percentComplete'))) {
				CalDAV.writeTaskStatus(component, incoming.status, incoming.percentComplete)
				existing.status = incoming.status
				existing.percentComplete = incoming.percentComplete
			}

			// Event-only, guarded like `status` is task-only: the two are mirror images (see Entry's
			// `type` setter), and a type flip never reaches here anyway — it re-creates the resource.
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

			// iTIP list changes are the organizer's (the route rejects everyone else before this runs);
			// the ATTENDEEs are rewritten wholesale, ORGANIZER only added/removed (see writeParticipants).
			if (keys.includes('participants')) {
				CalDAV.writeParticipants(component, incoming.participants ?? null)
				existing.participants = incoming.participants
			}

			// Wholesale and idempotent (the 412 retry may run this twice) — losslessness comes from
			// the model carrying every parsed RELTYPE opaquely, see writeRelations.
			if (relationsChanged) {
				CalDAV.writeRelations(component, incoming.relations)
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
			// them with the series (see features/recurrence/server/occurrences.ts); absent means keep, like `recurrence` on the
			// wire. Rewritten wholesale: the instants ARE the identity, so there's nothing to diff per-item.
			if (incoming.exdates !== undefined) {
				// EXDATEs follow DTSTART's authored form — the entry's zone (RFC 5545 matches instances by it).
				component.removeAllProperties('exdate')
				for (const ms of incoming.exdates) {
					CalDAV.writeDate(comp, component, 'exdate', new Date(ms), incoming.allDay, { zone: incoming.timeZone, append: true })
				}
			}

			// A re-zone leaves its previous VTIMEZONE unreferenced — drop any that no property points at.
			CalDAV.pruneTimezones(comp)
			return comp.toString()
		}

		await this.writeResource(integration, existing, applyTo)

		// Mirror the committed edit onto the row's own columns (the schedule fields weren't set inside
		// `applyTo` — a retry recomputes from them) and shift the override ROWS with the series, once.
		// Unconditional where the key changed: a CLEARED date is a value too, and a truthiness guard left
		// the row claiming a day the resource no longer does.
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

		// A cross-source migration re-creates the entry but keeps its identity: the carried uid keeps
		// every relationship pointing AT it (and its own outgoing lines) resolvable after the move.
		const uid = entry.uid || crypto.randomUUID()
		const filename = `${uid}.ics`

		const comp = new ICAL.Component(['vcalendar', [], []])
		comp.updatePropertyWithValue('prodid', '-//calendar//EN')
		comp.updatePropertyWithValue('version', '2.0')

		// A task is a VTODO (its end is DUE, completion is STATUS); anything else a VEVENT (end is DTEND).
		// The ENTRY's type decides, not the collection's — one collection may accept both (see
		// Source.entryTypes), and the route rejects a type the collection can't hold before we get here.
		const isTask = entry.type.isTask
		const component = new ICAL.Component(isTask ? 'vtodo' : 'vevent')
		component.updatePropertyWithValue('uid', uid)
		component.updatePropertyWithValue('dtstamp', ICAL.Time.now())
		component.updatePropertyWithValue('summary', entry.heading)
		!entry.description ? void 0 : component.updatePropertyWithValue('description', entry.description)
		!entry.location ? void 0 : component.updatePropertyWithValue('location', entry.location)
		// The span in the entry's authoring zone: local time + TZID (with the VTIMEZONE embedded on
		// `comp`) for an IANA zone, bare local for FLOATING, UTC / date-only otherwise (see CalDAV.writeDate).
		!entry.start ? void 0 : CalDAV.writeDate(comp, component, 'dtstart', entry.start, entry.allDay, { zone: entry.timeZone })
		!entry.end ? void 0 : CalDAV.writeDate(comp, component, isTask ? 'due' : 'dtend', entry.end, entry.allDay, { zone: entry.timeZone })
		!entry.color ? void 0 : component.updatePropertyWithValue('color', entry.color)
		!entry.recurrence ? void 0 : component.updatePropertyWithValue('rrule', ICAL.Recur.fromString(entry.recurrence.toRRule(entry.allDay)))
		// The continuation of a split series carries its half of the exclusions (see features/recurrence/server/occurrences.ts).
		entry.exdates?.forEach(ms => CalDAV.writeDate(comp, component, 'exdate', new Date(ms), entry.allDay, { zone: entry.timeZone, append: true }))
		if (isTask) {
			CalDAV.writeTaskStatus(component, entry.status, entry.percentComplete)
		} else if (entry.transparency) {
			// Only when the entry actually names one: an absent TRANSP already means OPAQUE, so writing
			// it for a plain busy event would be a line that says nothing (see CalDAV.writeTransparency).
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

		// Abort before persisting locally if the server rejected the create (tsdav doesn't throw on non-2xx),
		// so we never keep a row pointing at an object the server never stored.
		if (response.ok === false) {
			throw await CalDAV.writeError('create', response)
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

	async deleteEntry(base: Integration, em: EntityManager, entry: Entry): Promise<void> {
		const integration = base as CalDAV
		// An override row SHARES its resource with the series master — deleting the resource would
		// delete the whole series. Deleting the override is "delete this occurrence": route it through
		// the master's exclusion (which also strips the override component and this row).
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
			// The same stale-etag story as writeResource: refresh the etag once and retry.
			if (response.status === 412) {
				const fresh = await this.refetchResource(integration, entry)
				response = await client.deleteCalendarObject({
					calendarObject: { url: entry.uri, etag: fresh?.etag }
				})
			}
			// A 404 means the resource is already gone — exactly what a delete wants.
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

		// A pure raw → raw transformation, so the 412 retry can re-apply it (see writeResource).
		const applyTo = (raw: string): string => {
			const comp = new ICAL.Component(ICAL.parse(raw))
			const component = CalDAV.componentFor(master, comp)
			if (!component) {
				throw new Error('No vevent or vtodo found in master rawData')
			}

			// One EXDATE per excluded instant (matched by ms during expansion); value type AND authored
			// zone form follow DTSTART — the master's zone (RFC 5545 matches instances by it).
			CalDAV.writeDate(comp, component, 'exdate', recurrenceId, master.allDay, { zone: master.timeZone, append: true })

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

		await this.writeResource(integration, master, applyTo)

		for (const override of await em.find(Entry, { recurrenceMasterId: master.id })) {
			if (CalDAV.instantOf(override.recurrenceId) === recurrenceId.getTime()) {
				em.remove(override)
			}
		}
		await CalDAV.syncResourceRows(em, master)
	}
}
