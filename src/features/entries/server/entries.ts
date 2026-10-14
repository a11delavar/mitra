import { Router, type Request } from 'express'
import { orm } from '../../../infrastructure/database/orm.js'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { equals } from '@a11d/equals'
import { Source } from '../../sources/Source.js'
import { type RecurrenceScope } from '../../recurrence/Recurrence.js'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { Integration } from '../../../integrations/Integration.js'
import { EntryRelation } from '../../relations/EntryRelation.js'
import { Entry } from '../Entry.js'
import { EntryPatch } from '../EntryPatch.js'
import { ValidationError } from '../../../infrastructure/validation/ValidationError.js'
import { type Relation } from '../../relations/Relation.js'
import { TaskStatus } from '../TaskStatus.js'
import { editOccurrence, deleteOccurrence, expandedOccurrences, seriesStarts, nearestOccurrence, occurrenceAt } from '../../recurrence/server/occurrences.js'
import { entrySearch, entryWindow, everyEntry } from './entryWindow.js'
import { assertRelationsValid, attachRelations, relationClosure } from '../../relations/server/relations.js'
import { EntryRank } from '../EntryRank.js'

const logger = createLogger('Entries')

// The viewer's zone, which only "today" needs: the current occurrence of a recurring task without a start.
const viewerZone = (req: Request) => typeof req.query.tz === 'string' && req.query.tz ? req.query.tz : undefined

export const entriesRouter = Router()

// A tab from before all-day dates traveled as days sends its zone with every write, and those days as its own midnights.
entriesRouter.use((req, res, next) => req.method !== 'GET' && req.query.tz
	? res.status(409).json({ error: 'Mitra was updated. Reload the page to save your changes.' })
	: next())

entriesRouter.get('/', async (req, res) => {
	const { start, end } = req.query as { start?: string, end?: string }

	if (!start || !end) {
		return res.status(400).json({ error: 'Missing start or end date parameters' })
	}

	const [startDate, endDate] = [new Date(start), new Date(end)]

	const em = orm.em.fork()
	const visibleSources = await req.user.sources(em, { enabled: true, hidden: false })
	const visibleSourceIds = visibleSources.map(source => source.id)

	const rows = await em.find(Entry, entryWindow(visibleSourceIds, startDate, endDate))

	const occurrences = await expandedOccurrences(em, visibleSourceIds, startDate, endDate, viewerZone(req) ?? 'UTC')

	const entries = [...rows, ...occurrences]
	await attachRelations(em, req.user, entries)
	return res.json(entries.map(entry => entry))
})

entriesRouter.get('/all', async (req, res) => {
	const em = orm.em.fork()
	const visibleSourceIds = (await req.user.sources(em, { enabled: true, hidden: false })).map(source => source.id)
	const entries = [...await em.find(Entry, everyEntry(visibleSourceIds)), ...await seriesStarts(em, visibleSourceIds)]
	await attachRelations(em, req.user, entries)
	return res.json(entries.map(entry => entry))
})

entriesRouter.get('/search', async (req, res) => {
	const { q } = req.query as { q?: string }
	if (!q?.trim()) {
		return res.json([])
	}

	const em = orm.em.fork()
	const visibleSources = await req.user.sources(em, { enabled: true, hidden: false })

	const integrations = new Map((await em.find(Integration, { id: { $in: visibleSources.map(source => source.integrationId) } })).map(integration => [integration.id, integration]))
	const integrationOf = new Map(visibleSources.map(source => [source.id, integrations.get(source.integrationId)]))
	const found = await em.find(Entry, entrySearch(visibleSources.map(source => source.id), q), { orderBy: { start: 'desc' }, limit: 20 })
	// The events written for availability are background too, like availability itself.
	const matches = found.filter(entry => !integrationOf.get(entry.sourceId)?.writtenForAvailability(entry))
	const entries = await nearestOccurrence(em, matches, viewerZone(req) ?? 'UTC', new Date())

	await attachRelations(em, req.user, entries)
	return res.json(entries.map(entry => entry))
})

entriesRouter.get('/relations/closure', async (req, res) => {
	const em = orm.em.fork()
	const entries = await relationClosure(em, req.user)
	return res.json(entries.map(entry => entry))
})

/** Stores where the client placed tasks in the manual order, as their ranks keyed by entry id. */
entriesRouter.put('/ranks', async (req, res) => {
	const keys = Object.entries((req.body ?? {}) as Record<string, unknown>)
	if (!keys.length || keys.some(([, key]) => typeof key !== 'string')) {
		return res.status(400).json({ error: 'Ranks must map entry ids to rank keys' })
	}
	let ranks: Array<[string, EntryRank]>
	try {
		ranks = keys.map(([id, key]) => [id, EntryRank.parse(key as string)])
	} catch {
		return res.status(400).json({ error: 'Malformed rank' })
	}
	const em = orm.em.fork()
	for (const [id, rank] of ranks) {
		const entry = await req.user.entry(em, id)
		if (!entry.type.isTask || entry.recurringEntryId) {
			return res.status(400).json({ error: 'Only tasks have a manual order' })
		}
		entry.rank = rank
	}
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Ranked ${ranks.length} task(s)`)
	return res.status(204).end()
})

entriesRouter.post('/', async (req, res) => {
	const em = orm.em.fork()

	const patch = EntryPatch.from(req.body)
	if (!patch.sourceId) {
		throw new ValidationError('Missing sourceId', ['sourceId'])
	}
	const source = await req.user.source(em, patch.sourceId)
	const to = { source, integration: await em.findOneOrFail(Integration, { id: source.integrationId }) }

	const incoming = new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), type: source.defaultEntryType }).apply(patch)
	// The estimate is lost where the provider has none.
	if (!to.integration.ownership.holds('estimate')) {
		incoming.estimate = undefined
	}

	const errors = [...patch.validate({ to }), ...incoming.validate(to)]
	if (errors.length) {
		throw new AggregateError(errors)
	}

	const relationsError = await assertRelationsValid(em, req.user, incoming, incoming.relations ?? null)
	if (relationsError) {
		throw new ValidationError(relationsError, ['relations'])
	}

	const created = await to.integration.createEntry(em, incoming)
	await EntryRelation.reconcile(em, created.id!, created.relations ?? null)
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Created ${created.type} "${created.heading}" (${created.id}) in source ${source.id}`)
	return res.status(201).json(created)
})

entriesRouter.put('/:id', async (req, res) => {
	const em = orm.em.fork()
	const existing = await req.user.entry(em, req.params.id)
	// The stored relations, up front: the provider's diff and the response BOTH need a definite value.
	await EntryRelation.loadFor(em, [existing])

	// Validated BEFORE any integration write, since a 400 must leave the external store untouched.
	const patch = EntryPatch.from(req.body)
	const malformed = [...patch.validate()]
	if (malformed.length) {
		throw new AggregateError(malformed)
	}
	const relations = patch.relations as Array<Relation> | null | undefined
	if (relations !== undefined) {
		const relationsError = await assertRelationsValid(em, req.user, existing, relations)
		if (relationsError) {
			throw new ValidationError(relationsError, ['relations'])
		}
	}

	const incoming = new Entry().apply(EntryPatch.of(existing)).apply(patch)

	// Changing the list is the organizer's prerogative: iTIP (RFC 5546) limits everyone else to replying with their own
	// status, so their content edits pass only while they leave it as it is.
	if (!Object[equals](incoming.participants, existing.participants) && !existing.canManageParticipants) {
		return res.status(403).json({ error: 'Only the organizer can modify participants' })
	}

	// The current source is owned transitively (the entry lookup above proved it); a DIFFERENT target must prove its own ownership.
	const currentSource = await em.findOneOrFail(Source, { id: existing.sourceId })
	const targetSource = incoming.sourceId === existing.sourceId ? currentSource : await req.user.source(em, incoming.sourceId)
	const [currentIntegration, targetIntegration] = await Promise.all([
		em.findOneOrFail(Integration, { id: currentSource.integrationId }),
		em.findOneOrFail(Integration, { id: targetSource.integrationId }),
	])

	const from = { source: currentSource, integration: currentIntegration }
	const to = targetSource === currentSource ? from : { source: targetSource, integration: targetIntegration }
	const { scope, recurrenceId } = req.query as { scope?: RecurrenceScope, recurrenceId?: string }
	// Type conversion re-creates the entry below: tasks and events cannot share a CalDAV resource (RFC 4791 §4.1).
	const errors = [...patch.validate({ entry: existing, from, to, scope }), ...incoming.validate(to)]
	if (errors.length) {
		throw new AggregateError(errors)
	}

	if (scope && recurrenceId) {
		const occurrenceId = new Date(recurrenceId)
		// Absent dates are the occurrence's own, never the master's: the master's start would move the series to its first occurrence.
		const edited = occurrenceAt(existing, occurrenceId).apply(patch)
		if (!targetIntegration.ownership.holds('estimate')) {
			edited.estimate = undefined
		}
		const movingTo = to === from ? undefined : to
		const result = await editOccurrence(em, currentIntegration, existing, occurrenceId, edited, scope, movingTo)
		if (movingTo && scope === 'all' && result.id !== existing.id) {
			await EntryRelation.reconcile(em, result.id!, existing.relations ?? null)
			result.relations = existing.relations ?? null
		}
		await em.flush()
		await attachRelations(em, req.user, [result])
		syncEmitter.emit('updated', req.user.id)
		logger.debug(`Edited occurrence of series ${existing.id} (scope '${scope}')`)
		return res.json(result)
	}

	if (!targetIntegration.ownership.holds('estimate')) {
		incoming.estimate = undefined
	}

	// Move between sources or type conversion re-creates the entry (create-first, delete-after ordering).
	if (currentSource.id !== targetSource.id || incoming.type !== existing.type) {
		incoming.id = crypto.randomUUID()
		incoming.uid = currentSource.uri && currentSource.uri === targetSource.uri ? crypto.randomUUID() : existing.uid
		incoming.rank = incoming.type.isTask ? existing.rank : undefined
		incoming.migrateTo(targetSource)
		const created = await targetIntegration.createEntry(em, incoming)
		try {
			await currentIntegration.deleteEntry(em, existing)
		} catch (error) {
			await targetIntegration.deleteEntry(em, created).catch(() => void 0)
			await em.flush().catch(() => void 0)
			throw error
		}
		await EntryRelation.reconcile(em, created.id!, created.relations ?? null)
		await em.flush()
		syncEmitter.emit('updated', req.user.id)
		logger.debug(`Re-created entry ${existing.id} as ${created.type} in source ${targetSource.id} (new id ${created.id})`)
		return res.json(created)
	}

	await targetIntegration.updateEntry(em, existing, incoming)
	if (relations !== undefined) {
		await EntryRelation.reconcile(em, existing.id!, relations)
		existing.relations = relations
	}
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Updated entry ${existing.id} "${incoming.heading}"`)
	return res.json(existing)
})

/** Marks a task done without a full entry body, for a notification's Done button. */
entriesRouter.post('/:id/complete', async (req, res) => {
	const em = orm.em.fork()
	const existing = await req.user.entry(em, req.params.id)
	const source = await em.findOneOrFail(Source, { id: existing.sourceId })
	const integration = await em.findOneOrFail(Integration, { id: source.integrationId })
	const capabilities = integration.capabilitiesFor(source)

	if (!existing.type?.isTask) {
		return res.status(400).json({ error: 'Only a task can be completed' })
	}
	if (!capabilities.entries.edit) {
		return res.status(400).json({ error: 'This calendar cannot be edited from mitra' })
	}

	const { recurrenceId } = req.body as { recurrenceId?: number }

	// An occurrence detaches like a 'this' edit.
	if (typeof recurrenceId === 'number' && existing.recurrence?.freq) {
		const start = new Date(recurrenceId)
		const occurrence = occurrenceAt(existing, start)
		occurrence.setStatus(TaskStatus.Done, integration.ownership)
		const detached = await editOccurrence(em, integration, existing, start, occurrence, 'this')
		await em.flush()
		syncEmitter.emit('updated', req.user.id)
		logger.debug(`Completed occurrence ${start.toISOString()} of series ${existing.id} "${existing.heading}"`)
		return res.json(detached)
	}

	const incoming = existing.clone()
	incoming.setStatus(TaskStatus.Done, integration.ownership)
	// A second tap must not write to the provider again.
	if (incoming.status === existing.status && incoming.percentComplete === existing.percentComplete) {
		return res.json(existing)
	}

	await integration.updateEntry(em, existing, incoming)
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Completed task ${existing.id} "${existing.heading}"`)
	return res.json(existing)
})

entriesRouter.delete('/:id', async (req, res) => {
	const em = orm.em.fork()
	const entry = await req.user.entry(em, req.params.id)
	const source = await em.findOneOrFail(Source, { id: entry.sourceId })
	const integration = await em.findOneOrFail(Integration, { id: source.integrationId })

	if (!integration.capabilitiesFor(source).entries.delete) {
		return res.status(400).json({ error: 'Entries in this calendar cannot be deleted from mitra' })
	}

	const { scope, recurrenceId } = req.query as { scope?: RecurrenceScope, recurrenceId?: string }
	if (scope && scope !== 'all' && recurrenceId) {
		const occurrenceId = new Date(recurrenceId)
		await deleteOccurrence(em, integration, entry, occurrenceId, scope)
		await em.flush()
		syncEmitter.emit('updated', req.user.id)
		logger.debug(`Deleted occurrence of series ${entry.id} (scope '${scope}')`)
		return res.status(204).end()
	}

	await integration.deleteEntry(em, entry)
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Deleted entry ${entry.id} "${entry.heading}"`)
	return res.status(204).end()
})
