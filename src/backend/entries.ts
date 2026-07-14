import { Router, type Request } from 'express'
import { orm } from './orm.js'
import { syncEmitter } from './syncEmitter.js'
import { Entry, EntryRelation, FLOATING_TIME_ZONE, Integration, Recurrence, Source, normalizeAllDay, projectAllDay, createLogger, type RecurrenceScope } from '../shared/index.js'
import { editOccurrence, deleteOccurrence, expandedOccurrences } from './occurrences.js'
import { attachRelations, parseIncomingRelations, assertRelationsValid, resolveRelationsView, INVALID_RELATIONS } from './relations.js'

const logger = createLogger('Entries')

// --- All-day bounds are calendar DATES, not instants (see calendarDate.ts) ---------------------------
// Stored canonically as UTC midnights (server-zone-free), they cross the API in the VIEWER's zone: the
// client sends `?tz=<IANA zone>`, writes `normalizeAllDay` its local midnights back to dates, reads
// `projectAllDay` the dates into its local midnights — so an all-day event covers the same calendar
// dates, midnight to midnight, in EVERY browser zone, and the deployment's container TZ is irrelevant.

/** The viewer's zone riding on the request; absent (a bare API client) falls back per call site. */
const viewerZone = (req: Request) => typeof req.query.tz === 'string' && req.query.tz ? req.query.tz : undefined

/** The zone all-day midnights normalize in: the viewer's, else the entry's own — but never the
 * FLOATING marker, which is not a real zone and would throw inside Intl/Temporal (see Entry.timeZone). */
const dayZone = (req: Request, timeZone: string | null | undefined) =>
	viewerZone(req) ?? (timeZone && timeZone !== FLOATING_TIME_ZONE ? timeZone : undefined)

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

	const entries = [...rows, ...occurrences]
	await attachRelations(em, entries)
	return res.json(entries.map(entry => projectedForViewer(entry, viewerZone(req))))
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

	await attachRelations(em, entries)
	return res.json(entries.map(entry => projectedForViewer(entry, viewerZone(req))))
})

// The editor's relations row, resolved for display: this entry's outgoing links with their target
// entries, plus the DERIVED incoming ones — who points at this uid ("has subtask", "blocks") — with
// their owners. Derived on read from the relation store, never stored twice (see shared/Relation.ts).
entriesRouter.get('/:id/relations', async (req, res) => {
	const em = orm.em.fork()
	const entry = await req.user.entry(em, req.params.id)
	return res.json(await resolveRelationsView(em, req.user, entry, related => projectedForViewer(related, viewerZone(req))))
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

	const relations = parseIncomingRelations(body.relations)
	if (relations === INVALID_RELATIONS) {
		return res.status(400).json({ error: 'Invalid relations' })
	}

	const targetSource = await req.user.source(em, targetSourceId)
	const targetIntegration = await em.findOneOrFail(Integration, { id: targetSource.integrationId })

	const incoming = new Entry({
		// The backend owns ids: clients post a draft with none, and we assign it here (the provider's
		// createEntry persists this very object, so this covers both Dev and CalDAV).
		id: crypto.randomUUID(),
		// … and uids: every entry gets one at birth so it is relatable (relationships target uids —
		// see shared/Relation.ts). CalDAV's createEntry adopts this very value as the .ics UID.
		uid: crypto.randomUUID(),
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
		relations: relations ?? null,
	})

	// Validate BEFORE the integration write — a 400 must leave the external store untouched.
	const relationsError = await assertRelationsValid(em, req.user, incoming, relations ?? null)
	if (relationsError) {
		return res.status(400).json({ error: relationsError })
	}

	// The client sent its own zone's midnights — re-encode them as the canonical dates.
	if (incoming.allDay) {
		const zone = dayZone(req, incoming.timeZone)
		incoming.start = incoming.start ? normalizeAllDay(incoming.start, zone) as never : incoming.start
		incoming.end = incoming.end ? normalizeAllDay(incoming.end, zone) as never : incoming.end
	}

	const created = await targetIntegration.createEntry(em, incoming)
	// Mirror into the relation store within the same flush — atomic with the entry itself.
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
	const relations = parseIncomingRelations(body.relations)
	if (relations === INVALID_RELATIONS) {
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
			const zone = dayZone(req, edited.timeZone)
			// Only body-carried dates are viewer-zone midnights; fallbacks are already canonical.
			edited.start = body.start && edited.start ? normalizeAllDay(edited.start, zone) as never : edited.start
			edited.end = body.end && edited.end ? normalizeAllDay(edited.end, zone) as never : edited.end
		}
		// The occurrence identifier came from projected (viewer-zone) data — normalize it likewise.
		const occurrenceId = existing.allDay
			? normalizeAllDay(new Date(body.recurrenceId), dayZone(req, existing.timeZone))
			: new Date(body.recurrenceId)
		// Scoped occurrence edits are deliberately relation-SILENT (v1): relationships are
		// series-level, and a detached/continuation entry starts with none of its own.
		const result = await editOccurrence(em, currentIntegration, existing, occurrenceId, edited, body.scope)
		await em.flush()
		await attachRelations(em, [result])
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
		// Stays tri-state INTO the provider (undefined = keep) — CalDAV diffs it, Dev ignores it.
		relations,
	})

	// The client sent its own zone's midnights — re-encode them as the canonical dates. ONLY what
	// the body actually carried: an absent field fell back to the STORED value above, which is
	// already canonical — re-normalizing it in the viewer's zone would shift the entry a day for
	// every viewer behind UTC (a partial body — a relations-only update, an occurrence-routed
	// master edit — carries no dates at all).
	if (incoming.allDay) {
		const zone = dayZone(req, incoming.timeZone)
		incoming.start = body.start && incoming.start ? normalizeAllDay(incoming.start, zone) as never : incoming.start
		incoming.end = body.end && incoming.end ? normalizeAllDay(incoming.end, zone) as never : incoming.end
	}

	// Moving an entry between *sources* re-creates it at the target — providers update entries in
	// place and don't move them between their calendars/lists, so this holds within one integration
	// too. There is no cross-provider transaction, so the *order* is the safety: create first, delete
	// after — a failed create leaves everything untouched, and a failed delete is compensated by
	// removing the just-created copy. If even the compensation fails, the user is left with a
	// duplicate — recoverable, unlike the loss a delete-first order risks.
	if (currentSource.id !== targetSource.id) {
		incoming.id = crypto.randomUUID() // the backend owns ids — the migrated copy is a new entry
		// The uid is the entry's durable IDENTITY and survives the move (real calendar moves work the
		// same way): its own outgoing links and every link pointing AT it stay resolvable. EXCEPT
		// within one collection — an event↔task flip between the SIBLING sources of one CalDAV
		// calendar (they share the URL): the old resource still exists while the copy is created
		// (create-first is the safety ordering), and a second resource with the same UID in one
		// collection is illegal (RFC 4791 §5.3.2.1) — carrying it would make the flip always fail.
		// A sibling flip therefore mints a fresh identity, as every migration did before uids carried.
		incoming.uid = currentSource.uri && currentSource.uri === targetSource.uri ? crypto.randomUUID() : existing.uid
		// Relations ride along: the edit's own value, else the stored ones — the migrated copy must
		// not silently shed its links (the old entry's rows cascade away with its deletion below).
		incoming.relations = relations !== undefined ? relations : existing.relations ?? null
		incoming.migrateTo(targetSource) // the entry's shape (type/status) follows the target
		const created = await targetIntegration.createEntry(em, incoming)
		try {
			await currentIntegration.deleteEntry(em, existing)
		} catch (error) {
			await targetIntegration.deleteEntry(em, created).catch(() => void 0) // a duplicate beats a loss
			await em.flush().catch(() => void 0)
			throw error
		}
		await EntryRelation.reconcile(em, created.id!, created.relations ?? null)
		await em.flush()
		syncEmitter.emit('updated', req.user.id)
		logger.debug(`Migrated entry ${existing.id} → source ${targetSource.id} (new id ${created.id})`)
		return res.json(projectedForViewer(created, viewerZone(req)))
	}

	await targetIntegration.updateEntry(em, existing, incoming)
	// Mirror the definite edit into the relation store, atomically with the entry's flush. The
	// external write above happened first on purpose: its failure throws before anything commits
	// locally; a failed flush AFTER it is healed by the next sync re-parsing the resource.
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

	// A scoped occurrence delete (this / following): `:id` is the series MASTER, `recurrenceId` the
	// occurrence's original start (query params, since DELETE carries no body). 'all' falls through to
	// deleting the whole series below.
	const { scope, recurrenceId } = req.query as { scope?: RecurrenceScope, recurrenceId?: string }
	if (scope && scope !== 'all' && recurrenceId) {
		// The occurrence identifier came from projected (viewer-zone) data — normalize it likewise.
		const occurrenceId = entry.allDay ? normalizeAllDay(new Date(recurrenceId), dayZone(req, entry.timeZone)) : new Date(recurrenceId)
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
