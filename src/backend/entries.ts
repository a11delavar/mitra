import { Router } from 'express'
import { orm } from './orm.js'
import { syncEmitter } from './syncEmitter.js'
import { Entry, Integration, Recurrence, Source, type RecurrenceScope } from '../shared/index.js'
import { editOccurrence, deleteOccurrence, expandedOccurrences } from './occurrences.js'

export const entriesRouter = Router()

entriesRouter.get('/', async (req, res) => {
	const { start, end } = req.query as { start?: string, end?: string }

	if (!start || !end) {
		return res.status(400).json({ error: 'Missing start or end date parameters' })
	}

	// Entries are global to the integration for now; in a multi-user setup we would filter by user.id.
	const [startDate, endDate] = [new Date(start), new Date(end)]

	const em = orm.em.fork()
	const visibleSources = await em.find(Source, { enabled: true, hidden: false })
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

	return res.json([...rows, ...occurrences])
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

	const targetSource = await em.findOneOrFail(Source, { id: targetSourceId })
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
		status: body.status,
		recurrence: incomingRecurrence,
	})

	const created = await targetIntegration.createEntry(em, incoming)
	await em.flush()
	syncEmitter.emit('updated')
	return res.status(201).json(created)
})

entriesRouter.put('/:id', async (req, res) => {
	const em = orm.em.fork()
	const existing = await em.findOneOrFail(Entry, { id: req.params.id })

	// The client sends the full edited entry; the backend diffs as needed.
	const body = req.body as Partial<Entry> & { sourceId?: string, scope?: RecurrenceScope, recurrenceId?: string }

	// `null` removes the repeat (collapse the series); an object sets it; absent (undefined) keeps it.
	// Only a rule the request actually carries is validated — the stored one isn't this request's doing.
	const incomingRecurrence = body.recurrence === undefined ? existing.recurrence : Recurrence.from(body.recurrence)
	if (body.recurrence !== undefined && body.recurrence !== null && incomingRecurrence && !incomingRecurrence.valid) {
		return res.status(400).json({ error: 'Invalid recurrence rule' })
	}

	// Resolve the current and target sources (and their integrations) by id.
	const targetSourceId = body.sourceId ?? existing.sourceId
	const [currentSource, targetSource] = await Promise.all([
		em.findOneOrFail(Source, { id: existing.sourceId }),
		em.findOneOrFail(Source, { id: targetSourceId }),
	])
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
			status: body.status ?? existing.status,
		})
		const result = await editOccurrence(em, currentIntegration, existing, new Date(body.recurrenceId), edited, body.scope)
		await em.flush()
		syncEmitter.emit('updated')
		return res.json(result)
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
		status: body.status ?? existing.status,
		recurrence: incomingRecurrence,
	})

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
		syncEmitter.emit('updated')
		return res.json(created)
	}

	await targetIntegration.updateEntry(em, existing, incoming)
	await em.flush()
	syncEmitter.emit('updated')
	return res.json(existing)
})

entriesRouter.delete('/:id', async (req, res) => {
	const em = orm.em.fork()
	const entry = await em.findOneOrFail(Entry, { id: req.params.id })
	const source = await em.findOneOrFail(Source, { id: entry.sourceId })
	const integration = await em.findOneOrFail(Integration, { id: source.integrationId })

	// A scoped occurrence delete (this / following): `:id` is the series MASTER, `recurrenceId` the
	// occurrence's original start (query params, since DELETE carries no body). 'all' falls through to
	// deleting the whole series below.
	const { scope, recurrenceId } = req.query as { scope?: RecurrenceScope, recurrenceId?: string }
	if (scope && scope !== 'all' && recurrenceId) {
		await deleteOccurrence(em, integration, entry, new Date(recurrenceId), scope)
		await em.flush()
		syncEmitter.emit('updated')
		return res.status(204).end()
	}

	// Removes it from the external source and locally.
	await integration.deleteEntry(em, entry)
	await em.flush()
	syncEmitter.emit('updated')
	return res.status(204).end()
})
