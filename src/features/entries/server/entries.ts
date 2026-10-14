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
import { type Relation } from '../../relations/Relation.js'
import { type EntryTimeZone } from '../EntryTimeZone.js'
import { normalizeAllDay, projectAllDay } from '../../time/calendarDate.js'
import { editOccurrence, deleteOccurrence, expandedOccurrences, seriesStarts, nearestOccurrence, occurrenceAt } from '../../recurrence/server/occurrences.js'
import { TaskStatus } from '../TaskStatus.js'
import { Transparency } from '../Transparency.js'
import { entrySearch, entryWindow, everyEntry } from './entryWindow.js'
import { assertRelationsValid, attachRelations, relationClosure } from '../../relations/server/relations.js'
import { EntryRank } from '../EntryRank.js'

const logger = createLogger('Entries')

// Canonical all-day dates are stored as UTC midnights and projected into the viewer's zone on transit.
const viewerZone = (req: Request) => typeof req.query.tz === 'string' && req.query.tz ? req.query.tz : undefined

const dayZone = (req: Request, timeZone: EntryTimeZone | undefined) =>
	viewerZone(req) ?? (timeZone && !timeZone.floating ? timeZone.clock : undefined)

/** The all-day dates `patch` carried, from midnights in the sender's zone to the canonical UTC ones. */
function normalizeDays(entry: Entry, patch: EntryPatch, zone: string | undefined) {
	for (const field of ['start', 'end', 'due'] as const) {
		const date = entry[field]
		if (entry.allDay && patch[field] && date) {
			entry[field] = normalizeAllDay(date, zone) as never
		}
	}
}

/** Projects canonical all-day dates into viewer timezone before serialization. */
function projectedForViewer<T extends Entry>(entry: T, zone: string | undefined): T {
	if (entry.allDay && zone) {
		const project = (instant: Date) => projectAllDay(instant, zone) as never
		entry.start = entry.start ? project(entry.start) : entry.start
		entry.end = entry.end ? project(entry.end) : entry.end
		entry.due = entry.due ? project(entry.due) : entry.due
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

	const rows = await em.find(Entry, entryWindow(visibleSourceIds, startDate, endDate))

	const occurrences = await expandedOccurrences(em, visibleSourceIds, startDate, endDate, viewerZone(req) ?? 'UTC')

	const entries = [...rows, ...occurrences]
	await attachRelations(em, req.user, entries)
	return res.json(entries.map(entry => projectedForViewer(entry, viewerZone(req))))
})

entriesRouter.get('/all', async (req, res) => {
	const em = orm.em.fork()
	const visibleSourceIds = (await req.user.sources(em, { enabled: true, hidden: false })).map(source => source.id)
	const entries = [...await em.find(Entry, everyEntry(visibleSourceIds)), ...await seriesStarts(em, visibleSourceIds)]
	await attachRelations(em, req.user, entries)
	return res.json(entries.map(entry => projectedForViewer(entry, viewerZone(req))))
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
	return res.json(entries.map(entry => projectedForViewer(entry, viewerZone(req))))
})

entriesRouter.get('/relations/closure', async (req, res) => {
	const em = orm.em.fork()
	const entries = await relationClosure(em, req.user)
	return res.json(entries.map(entry => projectedForViewer(entry, viewerZone(req))))
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
		return res.status(400).json({ error: 'Missing sourceId' })
	}
	if (patch.malformation) {
		return res.status(400).json({ error: patch.malformation })
	}

	const targetSource = await req.user.source(em, patch.sourceId)
	const targetIntegration = await em.findOneOrFail(Integration, { id: targetSource.integrationId })

	if (!targetIntegration.capabilitiesFor(targetSource).createEntries) {
		return res.status(400).json({ error: 'This calendar cannot be written to from mitra' })
	}

	const incoming = new Entry({ id: crypto.randomUUID(), uid: crypto.randomUUID(), type: targetSource.defaultEntryType }).apply(patch)
	// The estimate is lost where the provider has none.
	if (!targetIntegration.capabilities.estimate) {
		incoming.estimate = undefined
	}

	if (incoming.participants?.length && !targetIntegration.capabilities.participants) {
		return res.status(400).json({ error: 'This calendar does not support participants' })
	}
	if (incoming.transparency === Transparency.Free && !targetIntegration.capabilities.transparency) {
		return res.status(400).json({ error: 'This calendar cannot mark an entry as free' })
	}
	if (incoming.visibility && !targetIntegration.capabilities.visibility) {
		return res.status(400).json({ error: 'This calendar does not support visibility' })
	}
	if (incoming.percentComplete !== undefined && !targetIntegration.capabilities.percentComplete) {
		return res.status(400).json({ error: 'This calendar does not support task progress' })
	}
	if (incoming.due && !targetIntegration.capabilities.due) {
		return res.status(400).json({ error: 'This calendar does not support due dates' })
	}
	if (!targetIntegration.canHold(targetSource, incoming.type)) {
		return res.status(400).json({ error: `This calendar cannot hold ${incoming.type.isTask ? 'tasks' : incoming.type.isAvailability ? 'availability' : 'events'}` })
	}

	const relationsError = await assertRelationsValid(em, req.user, incoming, incoming.relations ?? null)
	if (relationsError) {
		return res.status(400).json({ error: relationsError })
	}

	normalizeDays(incoming, patch, dayZone(req, incoming.timeZone))

	const created = await targetIntegration.createEntry(em, incoming)
	await EntryRelation.reconcile(em, created.id!, created.relations ?? null)
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Created ${created.type} "${created.heading}" (${created.id}) in source ${targetSource.id}`)
	return res.status(201).json(projectedForViewer(created, viewerZone(req)))
})

entriesRouter.put('/:id', async (req, res) => {
	const em = orm.em.fork()
	const existing = await req.user.entry(em, req.params.id)
	// The stored relations, up front: the provider's diff and the response BOTH need a definite value.
	await EntryRelation.loadFor(em, [existing])

	// Validated BEFORE any integration write, since a 400 must leave the external store untouched.
	const patch = EntryPatch.from(req.body)
	if (patch.malformation) {
		return res.status(400).json({ error: patch.malformation })
	}
	const relations = patch.relations as Array<Relation> | null | undefined
	if (relations !== undefined) {
		const relationsError = await assertRelationsValid(em, req.user, existing, relations)
		if (relationsError) {
			return res.status(400).json({ error: relationsError })
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

	const currentCapabilities = currentIntegration.capabilitiesFor(currentSource)
	if (!currentCapabilities.editEntries) {
		return res.status(400).json({ error: 'This calendar cannot be edited from mitra' })
	}
	if (incoming.heading !== existing.heading && !currentCapabilities.renameEntries) {
		return res.status(400).json({ error: 'Entries in this calendar take their title from the provider and cannot be renamed' })
	}
	if (targetSource.id !== currentSource.id && !targetIntegration.capabilitiesFor(targetSource).createEntries) {
		return res.status(400).json({ error: 'This calendar cannot be written to from mitra' })
	}

	if (incoming.participants?.length && !targetIntegration.capabilities.participants) {
		return res.status(400).json({ error: 'This calendar does not support participants. Remove them before moving the entry' })
	}
	if (incoming.transparency === Transparency.Free && !targetIntegration.capabilities.transparency) {
		return res.status(400).json({ error: 'This calendar cannot mark an entry as free. Set it back to busy before moving the entry' })
	}
	if (incoming.visibility && !targetIntegration.capabilities.visibility) {
		return res.status(400).json({ error: 'This calendar does not support visibility. Reset it to the default before moving the entry' })
	}
	if (incoming.percentComplete !== undefined && !targetIntegration.capabilities.percentComplete) {
		return res.status(400).json({ error: 'This calendar does not support task progress. Clear it first' })
	}
	if (incoming.due && !targetIntegration.capabilities.due) {
		return res.status(400).json({ error: 'This calendar does not support due dates. Clear it first' })
	}

	// Type conversion: tasks and events cannot mix in single CalDAV resource (RFC 4791 §4.1), so converted entries re-create below.
	if (incoming.type !== existing.type && existing.partOfSeries) {
		return res.status(400).json({ error: 'A recurring entry cannot change its type' })
	}
	if ((incoming.type !== existing.type || (incoming.type.isAvailability && targetSource.id !== currentSource.id)) && !targetIntegration.canHold(targetSource, incoming.type)) {
		return res.status(400).json({ error: 'The picked calendar cannot hold this entry type' })
	}

	// A tab from before the scope moved into the address still sends it in the body.
	const { scope, recurrenceId } = (req.query.scope ? req.query : req.body) as { scope?: RecurrenceScope, recurrenceId?: string }
	if (scope && recurrenceId) {
		const occurrenceId = existing.allDay
			? normalizeAllDay(new Date(recurrenceId), dayZone(req, existing.timeZone))
			: new Date(recurrenceId)
		// Absent dates are the occurrence's own, never the master's: the master's start would move the series to its first occurrence.
		const edited = occurrenceAt(existing, occurrenceId).apply(patch)
		if (!targetIntegration.capabilities.estimate) {
			edited.estimate = undefined
		}
		normalizeDays(edited, patch, dayZone(req, edited.timeZone))
		const movingTo = targetSource.id === currentSource.id ? undefined : { source: targetSource, integration: targetIntegration }
		if (movingTo && !targetIntegration.canHold(targetSource, existing.type)) {
			return res.status(400).json({ error: 'The picked calendar cannot hold this entry type' })
		}
		if (movingTo && scope !== 'this' && !targetIntegration.capabilities.recurrence) {
			return res.status(400).json({ error: 'This calendar cannot hold a repeating entry' })
		}
		const result = await editOccurrence(em, currentIntegration, existing, occurrenceId, edited, scope, movingTo)
		if (movingTo && scope === 'all' && result.id !== existing.id) {
			await EntryRelation.reconcile(em, result.id!, existing.relations ?? null)
			result.relations = existing.relations ?? null
		}
		await em.flush()
		await attachRelations(em, req.user, [result])
		syncEmitter.emit('updated', req.user.id)
		logger.debug(`Edited occurrence of series ${existing.id} (scope '${scope}')`)
		return res.json(projectedForViewer(result, viewerZone(req)))
	}

	if (!targetIntegration.capabilities.estimate) {
		incoming.estimate = undefined
	}
	normalizeDays(incoming, patch, dayZone(req, incoming.timeZone))

	// DTSTART is required for VEVENT (RFC 5545 §3.6.1).
	if (patch.start === null && existing.start && !incoming.type.isTask) {
		return res.status(400).json({ error: 'An event must have a date' })
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
		return res.json(projectedForViewer(created, viewerZone(req)))
	}

	await targetIntegration.updateEntry(em, existing, incoming)
	if (relations !== undefined) {
		await EntryRelation.reconcile(em, existing.id!, relations)
		existing.relations = relations
	}
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Updated entry ${existing.id} "${incoming.heading}"`)
	return res.json(projectedForViewer(existing, viewerZone(req)))
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
	if (!capabilities.editEntries) {
		return res.status(400).json({ error: 'This calendar cannot be edited from mitra' })
	}

	const { recurrenceId } = req.body as { recurrenceId?: number }

	// An occurrence detaches like a 'this' edit. Its recurrenceId comes canonical from the scheduler, so no viewer-zone normalization.
	if (typeof recurrenceId === 'number' && existing.recurrence?.freq) {
		const start = new Date(recurrenceId)
		const occurrence = occurrenceAt(existing, start)
		occurrence.setStatus(TaskStatus.Done, capabilities)
		const detached = await editOccurrence(em, integration, existing, start, occurrence, 'this')
		await em.flush()
		syncEmitter.emit('updated', req.user.id)
		logger.debug(`Completed occurrence ${start.toISOString()} of series ${existing.id} "${existing.heading}"`)
		return res.json(projectedForViewer(detached, viewerZone(req)))
	}

	const incoming = existing.clone()
	incoming.setStatus(TaskStatus.Done, capabilities)
	// A second tap must not write to the provider again.
	if (incoming.status === existing.status && incoming.percentComplete === existing.percentComplete) {
		return res.json(projectedForViewer(existing, viewerZone(req)))
	}

	await integration.updateEntry(em, existing, incoming)
	await em.flush()
	syncEmitter.emit('updated', req.user.id)
	logger.debug(`Completed task ${existing.id} "${existing.heading}"`)
	return res.json(projectedForViewer(existing, viewerZone(req)))
})

entriesRouter.delete('/:id', async (req, res) => {
	const em = orm.em.fork()
	const entry = await req.user.entry(em, req.params.id)
	const source = await em.findOneOrFail(Source, { id: entry.sourceId })
	const integration = await em.findOneOrFail(Integration, { id: source.integrationId })

	if (!integration.capabilitiesFor(source).deleteEntries) {
		return res.status(400).json({ error: 'Entries in this calendar cannot be deleted from mitra' })
	}

	const { scope, recurrenceId } = req.query as { scope?: RecurrenceScope, recurrenceId?: string }
	if (scope && scope !== 'all' && recurrenceId) {
		const occurrenceId = entry.allDay ? normalizeAllDay(new Date(recurrenceId), dayZone(req, entry.timeZone)) : new Date(recurrenceId)
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
