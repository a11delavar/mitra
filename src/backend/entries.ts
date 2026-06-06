import { Router } from 'express'
import { orm } from './orm.js'
import { syncEmitter } from './syncEmitter.js'
import { Entry, Integration, Source } from '../shared/index.js'

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
	const entries = await em.find(Entry, {
		sourceId: { $in: visibleSourceIds },
		$or: [
			{ start: { $gte: startDate, $lte: endDate } },
			{ end: { $gte: startDate, $lte: endDate } },
			{ start: { $lte: startDate }, end: { $gte: endDate } },
		],
	})

	return res.json(entries)
})

entriesRouter.post('/', async (req, res) => {
	const em = orm.em.fork()

	const body = req.body as Partial<Entry>
	const targetSourceId = body.sourceId
	if (!targetSourceId) {
		return res.status(400).json({ error: 'Missing sourceId' })
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
		color: body.color ?? null,
		start: body.start ? new DateTime(body.start) : undefined,
		end: body.end ? new DateTime(body.end) : undefined,
		allDay: body.allDay ?? false,
		status: body.status,
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
	const body = req.body as Partial<Entry> & { sourceId?: string }

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

	const incoming = new Entry({
		sourceId: targetSource.id,
		type: existing.type,
		heading: body.heading ?? existing.heading,
		description: body.description ?? existing.description,
		color: body.color !== undefined ? body.color : existing.color,
		start: body.start ? new DateTime(body.start) : existing.start,
		end: body.end ? new DateTime(body.end) : existing.end,
		allDay: body.allDay ?? existing.allDay,
		status: body.status ?? existing.status,
	})

	// Moving an entry between integrations is a delete-then-create; otherwise an in-place update.
	if (currentIntegration.id !== targetIntegration.id) {
		await currentIntegration.deleteEntry(em, existing)
		const created = await targetIntegration.createEntry(em, incoming)
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

	// Removes it from the external source and locally.
	await integration.deleteEntry(em, entry)
	await em.flush()
	syncEmitter.emit('updated')
	return res.status(204).end()
})
