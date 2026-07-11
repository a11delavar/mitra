import { Router, type Request } from 'express'
import { orm } from './orm.js'
import { syncEmitter } from './syncEmitter.js'
import { Entry, Integration, Recurrence, Source, normalizeAllDay, projectAllDay, createLogger, type RecurrenceScope } from '../shared/index.js'
import { editOccurrence, deleteOccurrence, expandedOccurrences } from './occurrences.js'

const logger = createLogger('Entries')

// --- All-day bounds are calendar DATES, not instants (see calendarDate.ts) ---------------------------
// Stored canonically as UTC midnights (server-zone-free), they cross the API in the VIEWER's zone: the
// client sends `?tz=<IANA zone>`, writes `normalizeAllDay` its local midnights back to dates, reads
// `projectAllDay` the dates into its local midnights — so an all-day event covers the same calendar
// dates, midnight to midnight, in EVERY browser zone, and the deployment's container TZ is irrelevant.

/** The viewer's zone riding on the request; absent (a bare API client) falls back per call site. */
const viewerZone = (req: Request) => typeof req.query.tz === 'string' && req.query.tz ? req.query.tz : undefined

/** An all-day entry's canonical dates projected into the viewer's zone — mutated AFTER any flush,
 * right before serialization; the request-scoped fork is then discarded, so nothing is written back. */
function projectedForViewer<T extends Entry>(entry: T, zone: string | undefined): T {
	if (entry.allDay && zone) {
		const project = (instant: Date) => projectAllDay(instant, zone) as never
		entry.start = entry.start ? project(entry.start) : entry.start
		entry.end = entry.end ? project(entry.end) : entry.end
		entry.recurrenceId = entry.recurrenceId ? project(entry.recurrenceId) : entry.recurrenceId
		entry.seriesStart = entry.seriesStart ? project(entry.seriesStart) : entry.seriesStart
	}
	return entry
}

export const entriesRouter = Router()

entriesRouter.get('/', async (req, res) => {
	const { start, end } = req.query as { start?: string, end?: string }

	if (!start || !end) {
		return res.status(400).json({ error: 'Missing start or end date parameters' })
	}

	const [startDate, endDate] = [new Date(start), new Date(end)]

	const em = orm.em.fork()
	const visibleSources = await req.user.sources(em, { enabled: true, hidden: false })
	const visibleSourceIds = visibleSources.map(source => source.id)

	// Plain rows: non-recurring entries + recurrence overrides (a single edited occurrence) that fall in the
	// window. Recurring MASTERS (a recurrence rule set) are excluded here and expanded below, so the bare
	// master — whose DTSTART is only its first occurrence — is never rendered on its own.
	const rows = await em.find(Entry, {
		sourceId: { $in: visibleSourceIds },
		recurrence: { freq: null },
		$or: [
			{ start: { $gte: startDate, $lte: endDate } },
			{ end: { $gte: startDate, $lte: endDate } },
			{ start: { $lte: startDate }, end: { $gte: endDate } },
		],
	})

	// The rendered instances of every recurring master intersecting the window (see occurrences.ts).
	const occurrences = await expandedOccurrences(em, visibleSourceIds, startDate, endDate)

	return res.json([...rows, ...occurrences].map(entry => projectedForViewer(entry, viewerZone(req))))
})

// Text search over the WHOLE store (the command palette's data source, unwindowed unlike the GET
// above): heading/description/location on every visible source's entries. Recurring masters match
// as themselves — one row stands in for its series.
entriesRouter.get('/search', async (req, res) => {
	const { q } = req.query as { q?: string }
	if (!q?.trim()) {
		return res.json([])
	}

	const em = orm.em.fork()
	const visibleSources = await em.find(Source, { enabled: true, hidden: false })

	const term = `%${q.trim()}%`
	const entries = await em.find(Entry, {
		sourceId: { $in: visibleSources.map(source => source.id) },
		$or: [
			{ heading: { $like: term } },
			{ description: { $like: term } },
			{ location: { $like: term } },
		],
	}, { orderBy: { start: 'desc' }, limit: 20 })

	return res.json(entries.map(entry => projectedForViewer(entry, viewerZone(req))))
})

entriesRouter.post('/', async (req, res) => {
	const em = orm.em.fork()

	const body = req.body as Partial<Entry>
	const targetSourceId = body.sourceId
	if (!targetSourceId) {
		return res.status(400).json({ error: 'Missing sourceId' })
	}

	const incomingRecurrence = Recurrence.from(body.recurrence)
	if (incomingRecurrence && !incomingRecurrence.valid) {
		return res.status(400).json({ error: 'Invalid recurrence rule' })
	}

	const targetSource = await req.user.source(em, targetSourceId)
	const targetIntegration = await em.findOneOrFail(Integration, { id: targetSource.integrationId })

	const incoming = new Entry({
		// The backend owns ids: clients post a draft with none, and we assign it here (the provider's
		// createEntry persists this very object, so this covers both Dev and CalDAV).
		id: crypto.randomUUID(),
		sourceId: targetSource.id,
		type: body.type!,
		heading: body.heading ?? '',
		description: body.description ?? '',
		location: body.location ?? '',
		color: body.color ?? null,
		start: body.start ? new DateTime(body.start) : undefined,
		end: body.end ? new DateTime(body.end) : undefined,
		allDay: body.allDay ?? false,
		timeZone: body.timeZone ?? null,
		status: body.status,
		recurrence: incomingRecurrence,
		reminders: body.reminders ?? undefined,
	})

	// The client sent its own zone's midnights — re-encode them as the canonical dates.
	if (incoming.allDay) {
		const zone = viewerZone(req) ?? incoming.timeZone
		incoming.start = incoming.start ? normalizeAllDay(incoming.start, zone) as never : incoming.start
		incoming.end = incoming.end ? normalizeAllDay(incoming.end, zone) as never : incoming.end
	}

	const created = await targetIntegration.createEntry(em, incoming)
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Created ${created.type} "${created.heading}" (${created.id}) in source ${targetSource.id}`)
	return res.status(201).json(projectedForViewer(created, viewerZone(req)))
})

entriesRouter.put('/:id', async (req, res) => {
	const em = orm.em.fork()
	const existing = await req.user.entry(em, req.params.id)

	// The client sends the full edited entry; the backend diffs as needed.
	const body = req.body as Partial<Entry> & { sourceId?: string, scope?: RecurrenceScope, recurrenceId?: string }

	// `null` removes the repeat (collapse the series); an object sets it; absent (undefined) keeps it.
	// Only a rule the request actually carries is validated — the stored one isn't this request's doing.
	const incomingRecurrence = body.recurrence === undefined ? existing.recurrence : Recurrence.from(body.recurrence)
	if (body.recurrence !== undefined && body.recurrence !== null && incomingRecurrence && !incomingRecurrence.valid) {
		return res.status(400).json({ error: 'Invalid recurrence rule' })
	}

	// Resolve the current and target sources (and their integrations) by id. The current one is owned
	// transitively (the entry lookup above proved it); a DIFFERENT target must prove its own ownership.
	const targetSourceId = body.sourceId ?? existing.sourceId
	const currentSource = await em.findOneOrFail(Source, { id: existing.sourceId })
	const targetSource = targetSourceId === existing.sourceId ? currentSource : await req.user.source(em, targetSourceId)
	const [currentIntegration, targetIntegration] = await Promise.all([
		em.findOneOrFail(Integration, { id: currentSource.integrationId }),
		em.findOneOrFail(Integration, { id: targetSource.integrationId }),
	])

	// A scoped occurrence edit (this / following / all): `:id` is the series MASTER, `recurrenceId` the
	// occurrence's original start, and the body carries the edited fields. Handled by the occurrence service.
	if (body.scope && body.recurrenceId) {
		const edited = new Entry({
			sourceId: existing.sourceId,
			type: existing.type,
			heading: body.heading ?? existing.heading,
			description: body.description ?? existing.description,
			location: body.location ?? existing.location,
			color: body.color !== undefined ? body.color : existing.color,
			start: body.start ? new DateTime(body.start) : existing.start,
			end: body.end ? new DateTime(body.end) : existing.end,
			allDay: body.allDay ?? existing.allDay,
			timeZone: body.timeZone === undefined ? existing.timeZone : body.timeZone,
			status: body.status ?? existing.status,
			reminders: body.reminders === undefined ? existing.reminders : body.reminders,
		})
		if (edited.allDay) {
			const zone = viewerZone(req) ?? edited.timeZone
			edited.start = edited.start ? normalizeAllDay(edited.start, zone) as never : edited.start
			edited.end = edited.end ? normalizeAllDay(edited.end, zone) as never : edited.end
		}
		// The occurrence identifier came from projected (viewer-zone) data — normalize it likewise.
		const occurrenceId = existing.allDay
			? normalizeAllDay(new Date(body.recurrenceId), viewerZone(req) ?? existing.timeZone)
			: new Date(body.recurrenceId)
		const result = await editOccurrence(em, currentIntegration, existing, occurrenceId, edited, body.scope)
		await em.flush()
		syncEmitter.emit('updated', req.user.id)
		logger.debug(`Edited occurrence of series ${existing.id} (scope '${body.scope}')`)
		return res.json(projectedForViewer(result, viewerZone(req)))
	}

	const incoming = new Entry({
		sourceId: targetSource.id,
		type: existing.type,
		heading: body.heading ?? existing.heading,
		description: body.description ?? existing.description,
		location: body.location ?? existing.location,
		color: body.color !== undefined ? body.color : existing.color,
		start: body.start ? new DateTime(body.start) : existing.start,
		end: body.end ? new DateTime(body.end) : existing.end,
		allDay: body.allDay ?? existing.allDay,
		timeZone: body.timeZone === undefined ? existing.timeZone : body.timeZone,
		status: body.status ?? existing.status,
		recurrence: incomingRecurrence,
		// Like `recurrence`, tri-state on the wire: an array sets, `null` clears, absent keeps.
		reminders: body.reminders === undefined ? existing.reminders : body.reminders,
	})

	// The client sent its own zone's midnights — re-encode them as the canonical dates.
	if (incoming.allDay) {
		const zone = viewerZone(req) ?? incoming.timeZone
		incoming.start = incoming.start ? normalizeAllDay(incoming.start, zone) as never : incoming.start
		incoming.end = incoming.end ? normalizeAllDay(incoming.end, zone) as never : incoming.end
	}

	// Moving an entry between *sources* re-creates it at the target — providers update entries in
	// place and don't move them between their calendars/lists, so this holds within one integration
	// too. There is no cross-provider transaction, so the *order* is the safety: create first, delete
	// after — a failed create leaves everything untouched, and a failed delete is compensated by
	// removing the just-created copy. If even the compensation fails, the user is left with a
	// duplicate — recoverable, unlike the loss a delete-first order risks.
	if (currentSource.id !== targetSource.id) {
		incoming.id = crypto.randomUUID() // the backend owns ids — the migrated copy is a new entry
		incoming.migrateTo(targetSource) // the entry's shape (type/status) follows the target
		const created = await targetIntegration.createEntry(em, incoming)
		try {
			await currentIntegration.deleteEntry(em, existing)
		} catch (error) {
			await targetIntegration.deleteEntry(em, created).catch(() => void 0) // a duplicate beats a loss
			await em.flush().catch(() => void 0)
			throw error
		}
		await em.flush()
		syncEmitter.emit('updated', req.user.id)
		logger.debug(`Migrated entry ${existing.id} → source ${targetSource.id} (new id ${created.id})`)
		return res.json(projectedForViewer(created, viewerZone(req)))
	}

	await targetIntegration.updateEntry(em, existing, incoming)
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Updated entry ${existing.id} "${incoming.heading}"`)
	return res.json(projectedForViewer(existing, viewerZone(req)))
})

entriesRouter.delete('/:id', async (req, res) => {
	const em = orm.em.fork()
	const entry = await req.user.entry(em, req.params.id)
	const source = await em.findOneOrFail(Source, { id: entry.sourceId })
	const integration = await em.findOneOrFail(Integration, { id: source.integrationId })

	// A scoped occurrence delete (this / following): `:id` is the series MASTER, `recurrenceId` the
	// occurrence's original start (query params, since DELETE carries no body). 'all' falls through to
	// deleting the whole series below.
	const { scope, recurrenceId } = req.query as { scope?: RecurrenceScope, recurrenceId?: string }
	if (scope && scope !== 'all' && recurrenceId) {
		// The occurrence identifier came from projected (viewer-zone) data — normalize it likewise.
		const occurrenceId = entry.allDay ? normalizeAllDay(new Date(recurrenceId), viewerZone(req) ?? entry.timeZone) : new Date(recurrenceId)
		await deleteOccurrence(em, integration, entry, occurrenceId, scope)
		await em.flush()
		syncEmitter.emit('updated', req.user.id)
		logger.debug(`Deleted occurrence of series ${entry.id} (scope '${scope}')`)
		return res.status(204).end()
	}

	// Removes it from the external source and locally.
	await integration.deleteEntry(em, entry)
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Deleted entry ${entry.id} "${entry.heading}"`)
	return res.status(204).end()
})
