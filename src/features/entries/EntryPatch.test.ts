import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry } from './Entry.js'
import { EntryPatch } from './EntryPatch.js'
import { EntryType } from './EntryType.js'
import { TaskStatus } from './TaskStatus.js'
import { Transparency } from './Transparency.js'
import { Visibility } from './Visibility.js'
import { EntryTimeZone } from './EntryTimeZone.js'
import { Recurrence } from '../recurrence/Recurrence.js'
import { RecurrenceFrequency } from '../recurrence/RecurrenceFrequency.js'
import { ParticipantRole } from '../participants/Participant.js'
import { RelationType } from '../relations/RelationType.js'
import { Relation } from '../relations/Relation.js'
import { revive, wireOf } from '../../infrastructure/model/wire.testing.js'

describe('EntryPatch', () => {
	const start = new DateTime('2026-10-05T09:00:00Z')
	const task = (init?: Partial<Entry>) => new Entry({ id: 't', sourceId: 's', type: EntryType.Task, heading: 'Report', start, end: start.add({ hours: 1 }), ...init })
	/** A patch as the server receives it from the browser. */
	const sent = (patch: EntryPatch) => revive<EntryPatch>(wireOf(patch))

	describe('of', () => {
		it('takes the entry\'s fields, its empty ones as cleared', () => {
			const patch = EntryPatch.of(task({ status: TaskStatus.Doing }))
			assert.equal(patch.heading, 'Report')
			assert.equal(patch.status, TaskStatus.Doing)
			assert.equal(patch.due, null)
			assert.equal(patch.color, null)
		})

		it('takes only the fields it is given, and allDay with a date', () => {
			assert.deepEqual(Object.keys(EntryPatch.of(task(), ['heading', 'due'])), ['allDay', 'heading', 'due'])
		})

		it('leaves out relations the entry does not know, and clears none it knows to have', () => {
			assert.equal('relations' in EntryPatch.of(task()), false)
			assert.equal(EntryPatch.of(task({ relations: null })).relations, null)
		})
	})

	describe('across the wire', () => {
		it('arrives with its values, the clearing nulls and nothing it left out', () => {
			const zone = EntryTimeZone.parse('Asia/Tehran')
			const patch = sent(EntryPatch.of(task({ status: TaskStatus.Done, transparency: Transparency.Free, visibility: Visibility.Private, timeZone: zone }), ['start', 'due', 'status', 'transparency', 'visibility', 'timeZone']))
			assert.ok(patch instanceof EntryPatch)
			assert.ok(patch.start instanceof DateTime)
			assert.equal(patch.start!.valueOf(), start.valueOf())
			assert.equal(patch.due, null)
			assert.deepEqual([patch.status, patch.transparency, patch.visibility, patch.timeZone], [TaskStatus.Done, Transparency.Free, Visibility.Private, zone])
			assert.equal(patch.heading, undefined)
		})

		it('carries a rule, participants and relations as the server reads them', () => {
			const patch = sent(EntryPatch.of(task({
				recurrence: new Recurrence({ freq: RecurrenceFrequency.Weekly }),
				participants: [{ email: 'Organizer@Example.com', organizer: true, role: ParticipantRole.Required }],
				relations: [new Relation({ type: RelationType.Parent, targetUid: 'parent' })],
			}), ['recurrence', 'participants', 'relations']))
			assert.equal(patch.recurrence?.freq, RecurrenceFrequency.Weekly)
			assert.deepEqual(patch.participants?.map(participant => participant.email), ['organizer@example.com'])
			assert.deepEqual((patch.relations as Array<Relation>).map(relation => relation.targetUid), ['parent'])
			assert.deepEqual([...patch.validate()], [])
		})
	})

	describe('from', () => {
		it('reads a plain body, only the fields an edit reaches', () => {
			const patch = EntryPatch.from({ status: 'doing', transparency: null, scope: 'this', id: 'other' })
			assert.equal(patch.status, TaskStatus.Doing)
			assert.equal(patch.transparency, null)
			assert.equal('scope' in patch || 'id' in patch, false)
		})

		it('clamps progress to a percentage and the estimate to whole minutes, and reads anything else as none', () => {
			assert.deepEqual([EntryPatch.from({ percentComplete: 140 }).percentComplete, EntryPatch.from({ percentComplete: 'half' }).percentComplete], [100, null])
			assert.deepEqual([EntryPatch.from({ estimate: 29.6 }).estimate, EntryPatch.from({ estimate: -5 }).estimate], [30, null])
		})

		it('names each malformed field', () => {
			const errors = [...EntryPatch.from({ relations: 'parent', recurrence: { freq: 'sometimes' } }).validate()]
			assert.deepEqual(errors.map(error => [error.message, error.fields]), [['Invalid relations', ['relations']], ['Invalid recurrence rule', ['recurrence']]])
			assert.deepEqual([...EntryPatch.from({ recurrence: null }).validate()], [])
		})
	})

	describe('Entry.apply', () => {
		it('keeps what the patch leaves out, clears what it nulls and sets the rest', () => {
			const entry = task({ color: '#f00', location: 'Office', due: start.add({ days: 2 }) })
			entry.apply(Object.assign(new EntryPatch(), { heading: 'Review', color: null, location: null, due: null }))
			assert.deepEqual([entry.heading, entry.color, entry.location, entry.due, entry.start], ['Review', undefined, '', undefined, start])
		})

		it('drops what the type cannot hold', () => {
			const entry = task({ status: TaskStatus.Done, percentComplete: 100, due: start.add({ days: 2 }) })
			entry.apply(Object.assign(new EntryPatch(), { type: EntryType.Event, transparency: Transparency.Free }))
			assert.deepEqual([entry.status, entry.percentComplete, entry.due, entry.transparency], [undefined, undefined, undefined, Transparency.Free])
			entry.apply(Object.assign(new EntryPatch(), { type: EntryType.Task }))
			assert.equal(entry.transparency, undefined)
		})

		it('drops an estimate a start stands for', () => {
			const entry = new Entry({ type: EntryType.Task, estimate: 45 })
			entry.apply(Object.assign(new EntryPatch(), { start, end: start.add({ minutes: 45 }), estimate: 45 }))
			assert.equal(entry.estimate, undefined)
		})

		it('keeps cleared relations as none, which is not unknown', () => {
			assert.equal(task({ relations: [] }).apply(Object.assign(new EntryPatch(), { relations: null })).relations, null)
		})

		it('rebuilds an entry from its own patch', () => {
			const entry = task({ status: TaskStatus.Doing, visibility: Visibility.Private, reminders: [10], color: '#0af' })
			assert.ok(new Entry().apply(EntryPatch.of(entry)).editEquals(entry))
		})
	})
})
