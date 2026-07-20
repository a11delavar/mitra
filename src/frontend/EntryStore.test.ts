import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, TaskStatus } from '../shared/Entry.js'
import { Recurrence, type RecurrenceScope } from '../shared/Recurrence.js'
import { EntryStore } from './EntryStore.js'
import { ApiError } from './Api.js'

describe('EntryStore', () => {
	const day = new DateTime().dayStart
	const at = (hour: number) => day.add({ hours: hour })

	const entry = (init?: Partial<Entry>) => new Entry({
		id: 'a', sourceId: 's', type: EntryType.Event, heading: 'Standup', start: at(9), end: at(10), ...init,
	})

	/** A controllable fake transport: resolves/rejects on demand, records calls. */
	const fake = () => {
		const calls = { create: 0, update: 0, delete: new Array<string>(), occurrenceEdits: new Array<RecurrenceScope>(), occurrenceDeletes: new Array<RecurrenceScope>() }
		const settlers = new Array<{ resolve: (saved: Entry) => void, reject: (error: unknown) => void }>()
		const request = (entry: Entry) => new Promise<Entry>((resolve, reject) => {
			// Capture what was sent; by default the server echoes it back (possibly normalized by the settler).
			const sent = entry.clone()
			settlers.push({ resolve: saved => resolve(saved ?? sent), reject })
		})
		return {
			calls,
			persistence: {
				create: (entry: Entry) => (calls.create++, request(entry)),
				update: (entry: Entry) => (calls.update++, request(entry)),
				delete: (id: string) => (calls.delete.push(id), Promise.resolve()),
				editOccurrence: (entry: Entry, scope: RecurrenceScope) => (calls.occurrenceEdits.push(scope), request(entry)),
				deleteOccurrence: (_entry: Entry, scope: RecurrenceScope) => (calls.occurrenceDeletes.push(scope), Promise.resolve()),
			},
			/** Settle the oldest pending request — waiting for one to appear first, since a commit may
			 * await other things (e.g. the scope resolver) before it issues the request. */
			async respond(saved?: Entry) {
				while (!settlers.length) {
					await new Promise<void>(resolve => setTimeout(resolve))
				}
				settlers.shift()!.resolve(saved as Entry)
				return settled()
			},
			fail(error: unknown) {
				settlers.shift()!.reject(error)
				return settled()
			},
			get pending() { return settlers.length },
		}
		function settled() {
			// Let the commit loop's continuations run before the test asserts.
			return new Promise<void>(resolve => setTimeout(resolve))
		}
	}

	const originalPersistence = EntryStore.persistence
	const originalResolveScope = EntryStore.resolveScope

	beforeEach(() => {
		EntryStore.reset()
		EntryStore.persistence = originalPersistence
		EntryStore.resolveScope = originalResolveScope
	})

	describe('entries (merged view)', () => {
		it('serves adopted server entries and appends the create draft', () => {
			const server = entry()
			EntryStore.applyServerEntries([server])
			const draft = entry({ id: undefined, heading: '' })
			EntryStore.upsertDraft(draft)
			assert.deepEqual([...EntryStore.entries], [server, draft])
		})

		it('rebuilds the array identity per notification, and not otherwise', () => {
			EntryStore.applyServerEntries([entry()])
			const before = EntryStore.entries
			assert.equal(EntryStore.entries, before)
			EntryStore.notify()
			assert.notEqual(EntryStore.entries, before)
			assert.deepEqual([...EntryStore.entries], [...before])
		})
	})

	describe('applyServerEntries (reconcile)', () => {
		it('keeps one stable instance per id across fetches, adopting values in place', () => {
			const first = entry()
			EntryStore.applyServerEntries([first])
			const refetched = entry({ heading: 'Renamed', start: at(14), end: at(15) })
			EntryStore.applyServerEntries([refetched])
			const [working] = EntryStore.entries
			assert.equal(working, first) // identity survives — open editors keep a live entry
			assert.equal(working!.heading, 'Renamed')
			assert.equal(working!.start!.valueOf(), at(14).valueOf())
		})

		it('leaves a dirty working copy untouched while refreshing its canonical', () => {
			const working = entry()
			EntryStore.applyServerEntries([working])
			working.heading = 'Local edit'
			EntryStore.applyServerEntries([entry({ heading: 'External edit' })])
			assert.equal(working.heading, 'Local edit') // pending wins until its own save confirms
			assert.equal(EntryStore.isDirty(working), true) // still dirty — now against the newer canonical
		})

		it('drops a clean entry the fetch no longer contains, keeps a dirty one', () => {
			const clean = entry({ id: 'clean' })
			const dirty = entry({ id: 'dirty' })
			EntryStore.applyServerEntries([clean, dirty])
			dirty.heading = 'Unsaved'
			EntryStore.applyServerEntries([])
			assert.deepEqual([...EntryStore.entries], [dirty])
		})

		it('derives dirtiness instead of tracking it', () => {
			const working = entry()
			EntryStore.applyServerEntries([working])
			assert.equal(EntryStore.isDirty(working), false)
			working.moveStart(at(14))
			assert.equal(EntryStore.isDirty(working), true)
			working.moveStart(at(9)) // undoing the edit makes it clean again — no flag to unset
			assert.equal(EntryStore.isDirty(working), false)
		})
	})

	describe('commit (persist)', () => {
		it('creates a draft, graduating it in place', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const draft = entry({ id: undefined })
			EntryStore.upsertDraft(draft)
			const commit = EntryStore.commit(draft)
			await transport.respond(entry({ id: 'assigned' }))
			await commit
			assert.equal(draft.id, 'assigned') // same instance, now persisted
			assert.deepEqual([...EntryStore.entries], [draft]) // out of the draft slot, into the identity map
			assert.equal(EntryStore.isDirty(draft), false)
		})

		it('keeps a committing draft visible when the create-gesture cleanup fires (click-away)', async () => {
			// Clicking away commits (input change), then the grid's pointerup dismisses "the draft" — that
			// dismissal must not destroy a titled entry whose POST is mid-flight, or it vanishes until the
			// sync echo brings it back.
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const draft = entry({ id: undefined })
			EntryStore.upsertDraft(draft)
			const commit = EntryStore.commit(draft)
			EntryStore.discardDraft() // the plain-click-on-empty-grid path
			assert.deepEqual([...EntryStore.entries], [draft]) // still rendered — no gap
			await transport.respond(entry({ id: 'assigned' }))
			await commit
			assert.deepEqual([...EntryStore.entries], [draft]) // graduated, still the same instance
			assert.equal(draft.id, 'assigned')
			assert.equal(EntryStore.isDirty(draft), false)
		})

		it('discards an untitled placeholder draft, and only that', () => {
			const untitled = entry({ id: undefined, heading: '  ' })
			EntryStore.upsertDraft(untitled)
			EntryStore.discardDraft()
			assert.deepEqual([...EntryStore.entries], [])
			const titled = entry({ id: undefined })
			EntryStore.upsertDraft(titled)
			EntryStore.discardDraft()
			assert.deepEqual([...EntryStore.entries], [titled])
		})

		it('graduates a draft displaced from the slot by a newer gesture', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const first = entry({ id: undefined, heading: 'First' })
			EntryStore.upsertDraft(first)
			const commit = EntryStore.commit(first)
			const second = entry({ id: undefined, heading: 'Second' })
			EntryStore.upsertDraft(second) // displaces `first` while its POST is in flight
			await transport.respond(entry({ id: 'assigned', heading: 'First' }))
			await commit
			assert.deepEqual([...EntryStore.entries], [first, second]) // first landed in the identity map
			assert.equal(first.id, 'assigned')
		})

		it('does not commit an untitled draft', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const draft = entry({ id: undefined, heading: '  ' })
			EntryStore.upsertDraft(draft)
			await EntryStore.commit(draft)
			assert.equal(transport.calls.create, 0)
		})

		it('coalesces: commits while a save is in flight share its chain', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const working = entry()
			EntryStore.applyServerEntries([working])
			working.heading = 'Edit'
			const first = EntryStore.commit(working)
			const second = EntryStore.commit(working)
			assert.equal(first, second)
			await transport.respond()
			await first
			assert.equal(transport.calls.update, 1)
		})

		it('saves again when an edit lands mid-flight, keeping the newer local values', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const working = entry()
			EntryStore.applyServerEntries([working])
			working.heading = 'First edit'
			const commit = EntryStore.commit(working)
			working.heading = 'Second edit' // while the first PUT is in flight
			await transport.respond() // first round: server confirms 'First edit'
			assert.equal(working.heading, 'Second edit') // not clobbered by the response
			assert.equal(transport.pending, 1) // the loop re-derived dirtiness and saved again
			await transport.respond()
			await commit
			assert.equal(transport.calls.update, 2)
			assert.equal(EntryStore.isDirty(working), false)
		})

		it('adopts server-normalized values when untouched during the flight', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const working = entry()
			EntryStore.applyServerEntries([working])
			working.moveStart(at(14))
			const commit = EntryStore.commit(working)
			// The server rounds and enriches (uri, etag) — the client must converge on that, not pin forever.
			await transport.respond(entry({ start: at(14), end: at(15), uri: '/dav/a.ics', data: { etag: '"2"' } }))
			await commit
			assert.equal(working.uri, '/dav/a.ics')
			assert.equal(EntryStore.isDirty(working), false)
		})

		it('keeps the edit and stays dirty when the save fails', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const working = entry()
			EntryStore.applyServerEntries([working])
			working.heading = 'Edit'
			const rejection = assert.rejects(EntryStore.commit(working))
			await transport.fail(new Error('offline'))
			await rejection
			assert.equal(working.heading, 'Edit')
			assert.equal(EntryStore.isDirty(working), true) // the next change retries
		})

		it('rekeys the identity map when a migration re-creates the entry under a new id', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const working = entry()
			EntryStore.applyServerEntries([working])
			working.sourceId = 'another-source' // a migration — the backend re-creates and returns a new id
			const commit = EntryStore.commit(working)
			await transport.respond(entry({ id: 'migrated', sourceId: 'another-source' }))
			await commit
			assert.equal(working.id, 'migrated') // same instance, new identity
			assert.deepEqual([...EntryStore.entries], [working])
			assert.equal(EntryStore.isDirty(working), false)
			EntryStore.applyServerEntries([entry({ id: 'migrated', sourceId: 'another-source' })])
			assert.deepEqual([...EntryStore.entries], [working]) // adopted under the new id; the old one is fully forgotten
		})

		it('drops the local copy when the server says the entry is gone (PUT 404)', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const working = entry()
			EntryStore.applyServerEntries([working])
			working.heading = 'Edit'
			const rejection = assert.rejects(EntryStore.commit(working))
			await transport.fail(Object.assign(Object.create(ApiError.prototype), { response: { status: 404 } }))
			await rejection
			assert.deepEqual([...EntryStore.entries], [])
		})
	})

	describe('revert', () => {
		it('restores the canonical values in place', () => {
			const working = entry()
			EntryStore.applyServerEntries([working])
			working.heading = 'Edit'
			working.moveStart(at(14))
			EntryStore.revert(working)
			assert.equal(working.heading, 'Standup')
			assert.equal(working.start!.valueOf(), at(9).valueOf())
			assert.equal(EntryStore.isDirty(working), false)
		})

		it('drops a draft — it only ever existed locally', () => {
			const draft = entry({ id: undefined })
			EntryStore.upsertDraft(draft)
			EntryStore.revert(draft)
			assert.deepEqual([...EntryStore.entries], [])
		})
	})

	describe('delete', () => {
		it('removes the entry from the view immediately and deletes on the server', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const working = entry()
			EntryStore.applyServerEntries([working])
			const deletion = EntryStore.delete(working)
			assert.deepEqual([...EntryStore.entries], []) // optimistic — no waiting for the request
			await deletion
			assert.deepEqual(transport.calls.delete, ['a'])
		})

		it('waits for an in-flight create, then deletes by the id it produced', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const draft = entry({ id: undefined })
			EntryStore.upsertDraft(draft)
			EntryStore.commit(draft).catch(() => void 0)
			const deletion = EntryStore.delete(draft) // deleted while the POST is in flight
			assert.deepEqual([...EntryStore.entries], [])
			await transport.respond(entry({ id: 'assigned' }))
			await deletion
			assert.deepEqual(transport.calls.delete, ['assigned']) // no orphan left on the server
			assert.deepEqual([...EntryStore.entries], []) // graduation mid-delete didn't resurrect it
		})

		it('deletes nothing on the server for a never-saved draft', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const draft = entry({ id: undefined })
			EntryStore.upsertDraft(draft)
			await EntryStore.delete(draft)
			assert.deepEqual(transport.calls.delete, [])
		})
	})

	describe('move preview', () => {
		it('renders the ghost alongside the untouched source and derives the gesture states', () => {
			const source = entry()
			EntryStore.applyServerEntries([source])
			EntryStore.setDragging(source)
			assert.equal(EntryStore.isDragging(source), true) // no ghost yet ⇒ a live resize: float
			const ghost = new Entry({ ...source.clone(), id: undefined })
			ghost.moveStart(at(14))
			EntryStore.setPreview(ghost)
			assert.deepEqual([...EntryStore.entries], [source, ghost]) // both render: dim + dashed
			assert.equal(ghost.persisted, false) // dashed through the same rule as a draft
			assert.equal(EntryStore.isDragSource(source), true)
			assert.equal(EntryStore.isDragging(source), false)
			assert.equal(EntryStore.isPreview(ghost), true)
			assert.equal(EntryStore.isDirty(source), false) // a move never touches the entry mid-gesture
			EntryStore.setPreview(undefined)
			EntryStore.setDragging(undefined)
			assert.deepEqual([...EntryStore.entries], [source])
		})

		it('shows nothing pending while the ghost is back over the entry\'s own slot', () => {
			const source = entry()
			EntryStore.applyServerEntries([source])
			EntryStore.setDragging(source)
			const ghost = new Entry({ ...source.clone(), id: undefined }) // same span — releasing changes nothing
			EntryStore.setPreview(ghost)
			assert.deepEqual([...EntryStore.entries], [source]) // no ghost rendered...
			assert.equal(EntryStore.isDragSource(source), false) // ...no dimmed source...
			assert.equal(EntryStore.isDragging(source), false) // ...and no live-resize float either
			assert.equal(EntryStore.isPreview(ghost), false)
			ghost.moveStart(at(14)) // next frame drags away again
			EntryStore.setPreview(ghost)
			assert.deepEqual([...EntryStore.entries], [source, ghost])
			assert.equal(EntryStore.isDragSource(source), true)
		})
	})

	describe('recurring series', () => {
		const occurrence = (init?: Partial<Entry>) => entry({
			id: 'master__1000', recurrenceMasterId: 'master', recurrenceId: at(9), heading: 'Standup', ...init,
		})

		it('commits with the resolved scope; \'all\' confirms the sent state without adopting the master', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			EntryStore.resolveScope = () => Promise.resolve('all')
			const working = occurrence()
			EntryStore.applyServerEntries([working])
			working.heading = 'Renamed series'
			const commit = EntryStore.commit(working)
			// The edit routes to the MASTER; the response is the master — different id, different span.
			await transport.respond(entry({ id: 'master', heading: 'Renamed series', start: at(1), end: at(2) }))
			await commit
			assert.deepEqual(transport.calls.occurrenceEdits, ['all'])
			assert.equal(working.id, 'master__1000') // identity untouched — no rekey onto the master
			assert.equal(working.start!.valueOf(), at(9).valueOf()) // span untouched — nothing adopted
			assert.equal(EntryStore.isDirty(working), false) // its own sent state became its canonical
		})

		it('\'this\' detaches: the instance adopts the standalone\'s identity and leaves the series', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			EntryStore.resolveScope = () => Promise.resolve('this')
			const working = occurrence()
			EntryStore.applyServerEntries([working])
			working.moveStart(at(14))
			const commit = EntryStore.commit(working)
			await transport.respond(entry({ id: 'detached', recurrenceMasterId: undefined, start: at(14), end: at(15) }))
			await commit
			assert.deepEqual(transport.calls.occurrenceEdits, ['this'])
			assert.equal(working.id, 'detached') // same instance, new real identity
			assert.equal(working.recurrenceMasterId, undefined) // no longer part of the series
			assert.equal(working.recurrence, undefined)
			assert.deepEqual([...EntryStore.entries], [working])
			assert.equal(EntryStore.isDirty(working), false)
		})

		it('cancelling the scope dialog reverts the edit and saves nothing', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			EntryStore.resolveScope = () => Promise.resolve(undefined)
			const working = occurrence()
			EntryStore.applyServerEntries([working])
			working.heading = 'Should not stick'
			await EntryStore.commit(working)
			assert.equal(working.heading, 'Standup') // snapped back to the series' state
			assert.deepEqual(transport.calls.occurrenceEdits, [])
			assert.equal(EntryStore.isDirty(working), false)
		})

		it('a rule-only edit bypasses the scope dialog and routes straight to the master', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			EntryStore.resolveScope = () => Promise.reject(new Error('must not be asked'))
			const working = occurrence({ recurrence: new Recurrence({ freq: 'DAILY' }) })
			EntryStore.applyServerEntries([working])
			working.recurrence = null // remove the rule — series-wide by definition
			const commit = EntryStore.commit(working)
			await transport.respond(entry({ id: 'master' }))
			await commit
			assert.equal(transport.calls.update, 1) // the plain update path (updateEvent routes to the master)
			assert.deepEqual(transport.calls.occurrenceEdits, [])
			assert.equal(EntryStore.isDirty(working), false)
		})

		it('a status-only change bypasses the scope dialog and commits as \'this\'', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			EntryStore.resolveScope = () => Promise.reject(new Error('must not be asked'))
			const working = occurrence({ type: EntryType.Task, status: TaskStatus.ToDo })
			EntryStore.applyServerEntries([working])
			working.status = TaskStatus.Done
			const commit = EntryStore.commit(working)
			await transport.respond(entry({ id: 'detached', type: EntryType.Task, status: TaskStatus.Done }))
			await commit
			assert.deepEqual(transport.calls.occurrenceEdits, ['this'])
			assert.equal(working.recurrenceMasterId, undefined) // detached — the completion is this occurrence's own
			assert.equal(working.status, TaskStatus.Done)
			assert.equal(EntryStore.isDirty(working), false)
		})

		it('a status change mixed with other edits still asks for a scope', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			EntryStore.resolveScope = () => Promise.resolve('all')
			const working = occurrence({ type: EntryType.Task, status: TaskStatus.ToDo })
			EntryStore.applyServerEntries([working])
			working.status = TaskStatus.Done
			working.heading = 'Renamed series'
			const commit = EntryStore.commit(working)
			await transport.respond(entry({ id: 'master', type: EntryType.Task, status: TaskStatus.Done, heading: 'Renamed series' }))
			await commit
			assert.deepEqual(transport.calls.occurrenceEdits, ['all']) // the whole edit takes the asked scope
		})

		it('scoped deletes drop the right local instances: \'this\'', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			EntryStore.resolveScope = () => Promise.resolve('this')
			const first = occurrence()
			const second = occurrence({ id: 'master__2000', recurrenceId: at(11), start: at(11), end: at(12) })
			EntryStore.applyServerEntries([first, second])
			await EntryStore.delete(first)
			assert.deepEqual([...EntryStore.entries], [second]) // only the deleted instance dropped
			assert.deepEqual(transport.calls.occurrenceDeletes, ['this'])
			assert.deepEqual(transport.calls.delete, [])
		})

		it('scoped deletes drop the right local instances: \'following\'', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			EntryStore.resolveScope = () => Promise.resolve('following')
			const earlier = occurrence({ id: 'master__500', recurrenceId: at(7), start: at(7), end: at(8) })
			const target = occurrence()
			const later = occurrence({ id: 'master__2000', recurrenceId: at(11), start: at(11), end: at(12) })
			EntryStore.applyServerEntries([earlier, target, later])
			await EntryStore.delete(target)
			assert.deepEqual([...EntryStore.entries], [earlier]) // this one and everything after it dropped
			assert.deepEqual(transport.calls.occurrenceDeletes, ['following'])
		})

		it('scoped deletes drop the right local instances: \'all\'', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			EntryStore.resolveScope = () => Promise.resolve('all')
			const first = occurrence()
			const second = occurrence({ id: 'master__2000', recurrenceId: at(11), start: at(11), end: at(12) })
			const unrelated = entry({ id: 'other' })
			EntryStore.applyServerEntries([first, second, unrelated])
			await EntryStore.delete(first)
			assert.deepEqual([...EntryStore.entries], [unrelated]) // every occurrence gone at once
			assert.deepEqual(transport.calls.delete, ['master']) // and the server call targets the master
		})

		it('cancelling a scoped delete leaves everything untouched', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			EntryStore.resolveScope = () => Promise.resolve(undefined)
			const working = occurrence()
			EntryStore.applyServerEntries([working])
			await EntryStore.delete(working)
			assert.deepEqual([...EntryStore.entries], [working])
			assert.deepEqual(transport.calls.occurrenceDeletes, [])
			assert.deepEqual(transport.calls.delete, [])
		})

		it('a failed scoped delete reinstates the dropped instances and rethrows', async () => {
			const transport = fake()
			EntryStore.persistence = { ...transport.persistence, deleteOccurrence: () => Promise.reject(new Error('CalDAV update failed: 400 Bad Request')) }
			EntryStore.resolveScope = () => Promise.resolve('this')
			const target = occurrence()
			const sibling = occurrence({ id: 'master__2000', recurrenceId: at(11), start: at(11), end: at(12) })
			EntryStore.applyServerEntries([target, sibling])
			await assert.rejects(EntryStore.delete(target), /400/)
			// Back in the view immediately — a failure must not masquerade as a delete until the next reload.
			assert.deepEqual(new Set(EntryStore.entries), new Set([target, sibling]))
			assert.equal(EntryStore.isDirty(target), false) // reinstated with its canonical intact
		})

		it('a failed whole-series delete reinstates every dropped instance', async () => {
			const transport = fake()
			EntryStore.persistence = { ...transport.persistence, delete: () => Promise.reject(new Error('boom')) }
			EntryStore.resolveScope = () => Promise.resolve('all')
			const first = occurrence()
			const second = occurrence({ id: 'master__2000', recurrenceId: at(11), start: at(11), end: at(12) })
			EntryStore.applyServerEntries([first, second])
			await assert.rejects(EntryStore.delete(first), /boom/)
			assert.deepEqual(new Set(EntryStore.entries), new Set([first, second]))
		})

		it('a scoped delete rejected with 404 stays dropped — the series is gone server-side already', async () => {
			const transport = fake()
			EntryStore.persistence = { ...transport.persistence, deleteOccurrence: () => Promise.reject(Object.assign(Object.create(ApiError.prototype), { response: { status: 404 } })) }
			EntryStore.resolveScope = () => Promise.resolve('this')
			const target = occurrence()
			EntryStore.applyServerEntries([target])
			await assert.rejects(EntryStore.delete(target))
			assert.deepEqual([...EntryStore.entries], [])
		})

		it('a failed plain delete reinstates the entry', async () => {
			const transport = fake()
			EntryStore.persistence = { ...transport.persistence, delete: () => Promise.reject(new Error('boom')) }
			const working = entry()
			EntryStore.applyServerEntries([working])
			await assert.rejects(EntryStore.delete(working), /boom/)
			assert.deepEqual([...EntryStore.entries], [working])
		})
	})

	describe('status round-trip', () => {
		it('a task status edit follows the same derive-commit cycle', async () => {
			const transport = fake()
			EntryStore.persistence = transport.persistence
			const working = entry({ type: EntryType.Task, status: TaskStatus.ToDo })
			EntryStore.applyServerEntries([working])
			working.status = TaskStatus.Done
			assert.equal(EntryStore.isDirty(working), true)
			const commit = EntryStore.commit(working)
			await transport.respond()
			await commit
			assert.equal(EntryStore.isDirty(working), false)
		})
	})
})
