import { Router, type Request } from 'express'
import { orm } from '../../../infrastructure/database/orm.js'
import { syncEmitter } from '../../../infrastructure/realtime/syncEmitter.js'
import { equals } from '@a11d/equals'
import { Source } from '../../sources/Source.js'
import { Recurrence, type RecurrenceScope } from '../../recurrence/Recurrence.js'
import { Participants } from '../../participants/Participant.js'
import { createLogger } from '../../../infrastructure/logging/Logger.js'
import { Integration } from '../../../integrations/Integration.js'
import { EntryType } from '../EntryType.js'
import { EntryRelations } from '../../relations/EntryRelations.js'
import { EntryRelation } from '../../relations/EntryRelation.js'
import { Entry, FLOATING_TIME_ZONE, Transparency } from '../Entry.js'
import { normalizeAllDay, projectAllDay } from '../../time/calendarDate.js'
import { editOccurrence, deleteOccurrence, expandedOccurrences } from '../../recurrence/server/occurrences.js'
import { assertRelationsValid, attachRelations, relationClosure } from '../../relations/server/relations.js'

const logger = createLogger('Entries')

// Canonical all-day dates are stored as UTC midnights and projected into the viewer's zone on transit.
const viewerZone = (req: Request) => typeof req.query.tz === 'string' && req.query.tz ? req.query.tz : undefined

const incomingDate = (value: unknown, stored: Entry['start']): Entry['start'] =>
	value === undefined ? stored : value === null ? undefined : new DateTime(value as string)

/** Clamps percentage values to 0-100 per RFC 5545 §3.8.1.8. */
const incomingPercent = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null

const dayZone = (req: Request, timeZone: string | null | undefined) =>
	viewerZone(req) ?? (timeZone && timeZone !== FLOATING_TIME_ZONE ? timeZone : undefined)

/** Projects canonical all-day dates into viewer timezone before serialization. */
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

	const rows = await em.find(Entry, {
		sourceId: { $in: visibleSourceIds },
		recurrence: { freq: null },
		$or: [
			{ start: { $gte: startDate, $lte: endDate } },
			{ end: { $gte: startDate, $lte: endDate } },
			{ start: { $lte: startDate }, end: { $gte: endDate } },
			{ start: null },
		],
	})

	const occurrences = await expandedOccurrences(em, visibleSourceIds, startDate, endDate)

	const entries = [...rows, ...occurrences]
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

	const term = `%${q.trim()}%`
	const entries = await em.find(Entry, {
		sourceId: { $in: visibleSources.map(source => source.id) },
		$or: [
			{ heading: { $like: term } },
			{ description: { $like: term } },
			{ location: { $like: term } },
		],
	}, { orderBy: { start: 'desc' }, limit: 20 })

	await attachRelations(em, req.user, entries)
	return res.json(entries.map(entry => projectedForViewer(entry, viewerZone(req))))
})

entriesRouter.get('/relations/closure', async (req, res) => {
	const em = orm.em.fork()
	const entries = await relationClosure(em, req.user)
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

	const relations = EntryRelations.parse(body.relations)
	if (relations === EntryRelations.invalid) {
		return res.status(400).json({ error: 'Invalid relations' })
	}

	const targetSource = await req.user.source(em, targetSourceId)
	const targetIntegration = await em.findOneOrFail(Integration, { id: targetSource.integrationId })

	if (!targetIntegration.capabilitiesFor(targetSource).createEntries) {
		return res.status(400).json({ error: 'This calendar cannot be written to from mitra' })
	}

	if (body.participants?.length && !targetIntegration.capabilities.participants) {
		return res.status(400).json({ error: 'This calendar does not support participants' })
	}

	if (body.transparency === Transparency.Free && !targetIntegration.capabilities.transparency) {
		return res.status(400).json({ error: 'This calendar cannot mark an entry as free' })
	}
	if (body.visibility && !targetIntegration.capabilities.visibility) {
		return res.status(400).json({ error: 'This calendar does not support visibility' })
	}
	if (incomingPercent(body.percentComplete) !== null && !targetIntegration.capabilities.percentComplete) {
		return res.status(400).json({ error: 'This calendar does not support task progress' })
	}

	const type = body.type ? EntryType.tryParse(body.type) : targetSource.defaultEntryType
	if (!type) {
		return res.status(400).json({ error: `Unknown entry type: ${String(body.type)}` })
	}
	if (!targetSource.supportsEntryType(type)) {
		return res.status(400).json({ error: `This calendar cannot hold ${type.isTask ? 'tasks' : 'events'}` })
	}

	const incoming = new Entry({
		id: crypto.randomUUID(),
		uid: crypto.randomUUID(),
		sourceId: targetSource.id,
		type,
		heading: body.heading ?? '',
		description: body.description ?? '',
		location: body.location ?? '',
		color: body.color ?? null,
		start: body.start ? new DateTime(body.start) : undefined,
		end: body.end ? new DateTime(body.end) : undefined,
		allDay: body.allDay ?? false,
		timeZone: body.timeZone ?? null,
		status: body.status,
		percentComplete: type.isTask ? incomingPercent(body.percentComplete) : null,
		transparency: type.isTask ? null : body.transparency ?? null,
		visibility: body.visibility ?? null,
		recurrence: incomingRecurrence,
		reminders: body.reminders ?? undefined,
		participants: Participants.normalize(body.participants),
		relations: relations ?? null,
	})

	const relationsError = await assertRelationsValid(em, req.user, incoming, relations ?? null)
	if (relationsError) {
		return res.status(400).json({ error: relationsError })
	}

	if (incoming.allDay) {
		const zone = dayZone(req, incoming.timeZone)
		incoming.start = incoming.start ? normalizeAllDay(incoming.start, zone) as never : incoming.start
		incoming.end = incoming.end ? normalizeAllDay(incoming.end, zone) as never : incoming.end
	}

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

	// The client sends the full edited entry; the backend diffs as needed.
	const body = req.body as Partial<Entry> & { sourceId?: string, scope?: RecurrenceScope, recurrenceId?: string }

	// Tri-state like `recurrence`: an array sets, `null` clears, absent keeps. Validated BEFORE any
	// integration write — a 400 must leave the external store untouched.
	const relations = EntryRelations.parse(body.relations)
	if (relations === EntryRelations.invalid) {
		return res.status(400).json({ error: 'Invalid relations' })
	}
	if (relations !== undefined) {
		const relationsError = await assertRelationsValid(em, req.user, existing, relations)
		if (relationsError) {
			return res.status(400).json({ error: relationsError })
		}
	}

	// `null` removes the repeat (collapse the series); an object sets it; absent (undefined) keeps it.
	// Only a rule the request actually carries is validated — the stored one isn't this request's doing.
	const incomingRecurrence = body.recurrence === undefined ? existing.recurrence : Recurrence.from(body.recurrence)
	if (body.recurrence !== undefined && body.recurrence !== null && incomingRecurrence && !incomingRecurrence.valid) {
		return res.status(400).json({ error: 'Invalid recurrence rule' })
	}

	// Same tri-state as `recurrence`/`reminders`: an array sets, `null` clears, absent keeps. Actually
	// CHANGING the list is the organizer's prerogative — iTIP (RFC 5546) limits everyone else to
	// replying with their own status — so a non-organizer's edit that touches it is rejected, while
	// their content edits (which echo the stored list back unchanged) pass through.
	const incomingParticipants = body.participants === undefined ? existing.participants ?? null : Participants.normalize(body.participants)
	if (!Object[equals](incomingParticipants, existing.participants ?? null) && !existing.canManageParticipants) {
		return res.status(403).json({ error: 'Only the organizer can modify participants' })
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

	const currentCapabilities = currentIntegration.capabilitiesFor(currentSource)
	if (!currentCapabilities.editEntries) {
		return res.status(400).json({ error: 'This calendar cannot be edited from mitra' })
	}
	if (body.heading !== undefined && body.heading !== existing.heading && !currentCapabilities.renameEntries) {
		return res.status(400).json({ error: 'Entries in this calendar take their title from the provider and cannot be renamed' })
	}
	if (targetSource.id !== currentSource.id && !targetIntegration.capabilitiesFor(targetSource).createEntries) {
		return res.status(400).json({ error: 'This calendar cannot be written to from mitra' })
	}

	if (incomingParticipants?.length && !targetIntegration.capabilities.participants) {
		return res.status(400).json({ error: 'This calendar does not support participants — remove them before moving the entry' })
	}

	const incomingVisibility = body.visibility === undefined ? existing.visibility : body.visibility
	if (body.transparency === Transparency.Free && !targetIntegration.capabilities.transparency) {
		return res.status(400).json({ error: 'This calendar cannot mark an entry as free — set it back to busy before moving the entry' })
	}
	if (incomingVisibility && !targetIntegration.capabilities.visibility) {
		return res.status(400).json({ error: 'This calendar does not support visibility — reset it to the default before moving the entry' })
	}
	const incomingPercentComplete = body.percentComplete === undefined ? existing.percentComplete : incomingPercent(body.percentComplete)
	if (incomingPercentComplete !== null && !targetIntegration.capabilities.percentComplete) {
		return res.status(400).json({ error: 'This calendar does not support task progress — clear it first' })
	}

	// Type conversion: tasks and events cannot mix in single CalDAV resource (RFC 4791 §4.1), so converted entries re-create below.
	const incomingType = body.type === undefined ? existing.type : EntryType.tryParse(body.type)
	if (!incomingType) {
		return res.status(400).json({ error: `Unknown entry type '${String(body.type)}'` })
	}
	if (incomingType !== existing.type) {
		if (existing.partOfSeries) {
			return res.status(400).json({ error: 'A recurring entry cannot change its type' })
		}
		if (!targetSource.supportsEntryType(incomingType)) {
			return res.status(400).json({ error: 'The picked calendar cannot hold this entry type' })
		}
	}

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
			percentComplete: body.percentComplete === undefined ? existing.percentComplete : incomingPercent(body.percentComplete),
			transparency: existing.type.isTask ? null : body.transparency ?? existing.transparency,
			visibility: incomingVisibility,
			reminders: body.reminders === undefined ? existing.reminders : body.reminders,
			participants: incomingParticipants,
		})
		if (edited.allDay) {
			const zone = dayZone(req, edited.timeZone)
			edited.start = body.start && edited.start ? normalizeAllDay(edited.start, zone) as never : edited.start
			edited.end = body.end && edited.end ? normalizeAllDay(edited.end, zone) as never : edited.end
		}
		const occurrenceId = existing.allDay
			? normalizeAllDay(new Date(body.recurrenceId), dayZone(req, existing.timeZone))
			: new Date(body.recurrenceId)
		const movingTo = targetSource.id === currentSource.id ? undefined : { source: targetSource, integration: targetIntegration }
		if (movingTo && !targetSource.supportsEntryType(existing.type)) {
			return res.status(400).json({ error: 'The picked calendar cannot hold this entry type' })
		}
		if (movingTo && body.scope !== 'this' && !targetIntegration.capabilities.recurrence) {
			return res.status(400).json({ error: 'This calendar cannot hold a repeating entry' })
		}
		const result = await editOccurrence(em, currentIntegration, existing, occurrenceId, edited, body.scope, movingTo)
		if (movingTo && body.scope === 'all' && result.id !== existing.id) {
			await EntryRelation.reconcile(em, result.id!, existing.relations ?? null)
			result.relations = existing.relations ?? null
		}
		await em.flush()
		await attachRelations(em, req.user, [result])
		syncEmitter.emit('updated', req.user.id)
		logger.debug(`Edited occurrence of series ${existing.id} (scope '${body.scope}')`)
		return res.json(projectedForViewer(result, viewerZone(req)))
	}

	const incoming = new Entry({
		sourceId: targetSource.id,
		type: incomingType,
		heading: body.heading ?? existing.heading,
		description: body.description ?? existing.description,
		location: body.location ?? existing.location,
		color: body.color !== undefined ? body.color : existing.color,
		start: incomingDate(body.start, existing.start),
		end: incomingDate(body.end, existing.end),
		allDay: body.allDay ?? existing.allDay,
		timeZone: body.timeZone === undefined ? existing.timeZone : body.timeZone,
		status: incomingType.isTask ? body.status ?? existing.status : undefined,
		percentComplete: incomingType.isTask ? incomingPercentComplete : null,
		transparency: incomingType.isTask ? null : body.transparency ?? existing.transparency,
		visibility: incomingVisibility,
		recurrence: incomingRecurrence,
		reminders: body.reminders === undefined ? existing.reminders : body.reminders,
		participants: incomingParticipants,
		relations,
	})

	if (incoming.allDay) {
		const zone = dayZone(req, incoming.timeZone)
		incoming.start = body.start && incoming.start ? normalizeAllDay(incoming.start, zone) as never : incoming.start
		incoming.end = body.end && incoming.end ? normalizeAllDay(incoming.end, zone) as never : incoming.end
	}

	// DTSTART is required for VEVENT (RFC 5545 §3.6.1).
	if (body.start === null && existing.start && !incomingType.isTask) {
		return res.status(400).json({ error: 'An event must have a date' })
	}

	// Move between sources or type conversion re-creates the entry (create-first, delete-after ordering).
	if (currentSource.id !== targetSource.id || incoming.type !== existing.type) {
		incoming.id = crypto.randomUUID()
		incoming.uid = currentSource.uri && currentSource.uri === targetSource.uri ? crypto.randomUUID() : existing.uid
		incoming.relations = relations !== undefined ? relations : existing.relations ?? null
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
