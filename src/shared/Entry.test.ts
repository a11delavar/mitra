import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, TaskStatus, FLOATING_TIME_ZONE } from './Entry.js'
import { EntryType } from './EntryType.js'
import { ParticipantRole } from './Participant.js'
import { Source } from './Source.js'
import { revive, wireOf } from './wire.testing.js'

describe('Entry', () => {
	const day = new DateTime().dayStart

	describe('multiDay', () => {
		it('is false within a single day', () => {
			assert.equal(new Entry({ start: day.add({ hours: 9 }), end: day.add({ hours: 17 }) }).multiDay, false)
		})

		it('is true across day boundaries', () => {
			assert.equal(new Entry({ start: day, end: day.add({ days: 2 }) }).multiDay, true)
		})

		it('is false for a single all-day day (end is the exclusive next midnight)', () => {
			assert.equal(new Entry({ start: day, end: day.add({ days: 1 }), allDay: true }).multiDay, false)
		})

		it('is true for a multi-day all-day span', () => {
			assert.equal(new Entry({ start: day, end: day.add({ days: 3 }), allDay: true }).multiDay, true)
		})

		it('is false when undated', () => {
			assert.equal(new Entry({}).multiDay, false)
		})
	})

	describe('allDay', () => {
		it('is a stored flag, not inferred from the times', () => {
			assert.equal(new Entry({ start: day, end: day.add({ days: 1 }), allDay: true }).allDay, true)
			// Midnight bounds alone no longer imply all-day — the flag is explicit.
			assert.equal(new Entry({ start: day, end: day.add({ days: 1 }) }).allDay, false)
		})

		it('defaults to false', () => {
			assert.equal(new Entry({ start: day.add({ hours: 9 }), end: day.add({ hours: 10 }) }).allDay, false)
			assert.equal(new Entry({}).allDay, false)
		})
	})

	const at = (d: number, hour: number, minute = 0) => day.add({ days: d }).with({ hour, minute })

	describe('participants', () => {
		const invited = () => new Entry({
			participants: [
				{ email: 'organizer@example.com', organizer: true },
				{ email: 'me@example.com', self: true },
			],
		})

		it('surfaces the organizer from the list', () => {
			assert.equal(invited().organizer?.email, 'organizer@example.com')
			assert.equal(new Entry({}).organizer, undefined)
		})

		it('is manageable without an organizer (one\'s own entry) or as the organizer — iTIP (RFC 5546)', () => {
			assert.equal(new Entry({}).canManageParticipants, true)
			assert.equal(new Entry({ participants: [{ email: 'a@example.com' }] }).canManageParticipants, true)
			assert.equal(new Entry({ participants: [{ email: 'me@example.com', organizer: true, self: true }] }).canManageParticipants, true)
			assert.equal(invited().canManageParticipants, false) // someone else's meeting
		})

		it('counts as editable content — editEquals compares the lists structurally', () => {
			const a = invited()
			const b = invited()
			assert.equal(a.editEquals(b), true) // same content, different array instances
			b.participants = [...b.participants!, { email: 'late@example.com' }]
			assert.equal(a.editEquals(b), false)
		})

		it('invite adds pending required invitees and enlists the account as the organizer', () => {
			const entry = new Entry({})
			assert.equal(entry.invite([' Invitee@Example.com ', 'invitee@example.com', 'junk'], 'me@example.com'), true)
			assert.deepEqual(entry.participants!.map(participant => [participant.email, !!participant.organizer, participant.status]), [
				['me@example.com', true, 'accepted'],
				['invitee@example.com', false, 'needs-action'],
			])
		})

		it('invite skips the already-invited and reports whether anything changed', () => {
			const entry = invited()
			assert.equal(entry.invite(['ME@example.com'], 'me@example.com'), false)
			assert.equal(entry.invite(['second@example.com']), true)
			assert.equal(entry.organizer?.email, 'organizer@example.com') // the foreign organizer stays
		})

		it('invite replaces the list — the previous array (a clone may share it) is untouched', () => {
			const entry = invited()
			const before = entry.participants
			entry.invite(['second@example.com'])
			assert.equal(before!.length, 2)
			assert.notEqual(entry.participants, before)
		})

		it('markAllParticipants changes every invitee but never the organizer', () => {
			const entry = invited()
			entry.markAllParticipants(ParticipantRole.Optional)
			assert.deepEqual(entry.participants!.map(participant => participant.role), [ParticipantRole.Required, ParticipantRole.Optional])
		})

		it('setParticipantRole changes one invitee and reports whether anything changed', () => {
			const entry = invited()
			assert.equal(entry.setParticipantRole('ME@example.com', ParticipantRole.Optional), true)
			assert.deepEqual(entry.participants!.map(participant => participant.role), [ParticipantRole.Required, ParticipantRole.Optional])
			assert.equal(entry.setParticipantRole('me@example.com', ParticipantRole.Optional), false) // already optional
			assert.equal(entry.setParticipantRole('organizer@example.com', ParticipantRole.Optional), false) // not an invitee
		})

		it('removeParticipant uninvites one, refuses the organizer, and clears the list with the last invitee', () => {
			const entry = new Entry({
				participants: [
					{ email: 'organizer@example.com', organizer: true },
					{ email: 'a@example.com' },
					{ email: 'b@example.com' },
				],
			})
			assert.equal(entry.removeParticipant('organizer@example.com'), false)
			assert.equal(entry.removeParticipant('A@example.com'), true)
			assert.deepEqual(entry.participants!.map(participant => participant.email), ['organizer@example.com', 'b@example.com'])
			assert.equal(entry.removeParticipant('b@example.com'), true)
			assert.equal(entry.participants, null) // a lone organizer has nothing to organize
			assert.equal(entry.removeParticipant('b@example.com'), false)
		})

		it('clearParticipants returns the entry to a plain private one', () => {
			const entry = invited()
			entry.clearParticipants()
			assert.equal(entry.participants, null)
			assert.equal(entry.hasParticipants, false)
			assert.equal(entry.canManageParticipants, true)
		})
	})

	describe('effectiveEnd / inclusiveEnd', () => {
		it('returns the stored end when it is after the start', () => {
			assert.equal(new Entry({ start: at(0, 9), end: at(0, 10) }).effectiveEnd.valueOf(), at(0, 10).valueOf())
		})

		it('falls back to a single all-day day when the end is missing', () => {
			assert.equal(new Entry({ start: day, allDay: true }).effectiveEnd.valueOf(), day.add({ days: 1 }).valueOf())
		})

		it('inclusiveEnd is the last covered day for an all-day span', () => {
			assert.equal(new Entry({ start: day, end: day.add({ days: 3 }), allDay: true }).inclusiveEnd.valueOf(), day.add({ days: 2 }).valueOf())
		})
	})

	describe('moveStart', () => {
		it('moves a timed entry, preserving its duration', () => {
			const e = new Entry({ start: at(0, 9), end: at(0, 10) })
			e.moveStart(at(3, 14))
			assert.equal(e.start!.valueOf(), at(3, 14).valueOf())
			assert.equal(e.end!.valueOf(), at(3, 15).valueOf())
		})

		it('moving back and forth never stretches a timed entry', () => {
			const e = new Entry({ start: at(0, 9), end: at(0, 10) })
			e.moveStart(at(6, 9))
			e.moveStart(at(0, 9))
			assert.equal(e.end!.valueOf() - e.start!.valueOf(), 60 * 60_000)
		})

		it('shifts an all-day span by whole days, keeping its length', () => {
			const e = new Entry({ start: day, end: day.add({ days: 7 }), allDay: true })
			e.moveStart(day.add({ days: 3 }))
			assert.equal(e.start!.valueOf(), day.add({ days: 3 }).valueOf())
			assert.equal(e.end!.valueOf(), day.add({ days: 10 }).valueOf())
		})
	})

	describe('setEnd', () => {
		it('sets a timed end, keeping the start', () => {
			const e = new Entry({ start: at(0, 9), end: at(0, 10) })
			e.setEnd(at(0, 11))
			assert.equal(e.end!.valueOf(), at(0, 11).valueOf())
		})

		it('snaps a timed end at/under the start to a one-snap minimum', () => {
			const e = new Entry({ start: at(0, 9), end: at(0, 10) })
			e.setEnd(at(0, 8))
			assert.equal(e.end!.valueOf(), at(0, 9, 15).valueOf())
		})

		it('takes an inclusive last day for all-day, clamping below the start to a single day', () => {
			const e = new Entry({ start: day, end: day.add({ days: 1 }), allDay: true })
			e.setEnd(day.add({ days: 2 })) // inclusive day 2 → exclusive day 3
			assert.equal(e.end!.valueOf(), day.add({ days: 3 }).valueOf())
			e.setEnd(day.subtract({ days: 1 })) // before start → single day
			assert.equal(e.end!.valueOf(), day.add({ days: 1 }).valueOf())
		})
	})

	describe('editEquals', () => {
		const base = () => new Entry({
			id: 'a', sourceId: 's', type: EntryType.Event, heading: 'Standup', description: '', color: null,
			start: at(0, 9), end: at(0, 10), allDay: false,
		})

		it('is true for a clone', () => {
			const e = base()
			assert.equal(e.editEquals(e.clone()), true)
		})

		it('is false after a content edit', () => {
			for (const edit of [
				(e: Entry) => e.heading = 'Renamed',
				(e: Entry) => e.description = 'Notes',
				(e: Entry) => e.location = 'Berlin, Germany',
				(e: Entry) => e.reminders = [30],
				(e: Entry) => e.timeZone = 'Asia/Tehran',
				(e: Entry) => e.color = '#ff0000',
				(e: Entry) => e.moveStart(at(1, 9)),
				(e: Entry) => e.setEnd(at(0, 11)),
				(e: Entry) => e.setAllDay(true),
				(e: Entry) => e.status = TaskStatus.Done,
			]) {
				const e = base()
				edit(e)
				assert.equal(e.editEquals(base()), false)
			}
		})

		it('ignores identity and sync bookkeeping (id, uri, data)', () => {
			const local = base()
			const server = new Entry({ ...base(), id: 'b', uri: '/dav/entry.ics', data: { etag: '"1"' } })
			assert.equal(local.editEquals(server), true)
		})

		it('compares DateTimes by value, not identity', () => {
			const a = new Entry({ ...base(), start: at(0, 9), end: at(0, 10) })
			const b = new Entry({ ...base(), start: day.add({ hours: 9 }), end: day.add({ hours: 10 }) })
			assert.equal(a.editEquals(b), true)
		})

		it('treats a set and an unset optional field as different', () => {
			assert.equal(base().editEquals(new Entry({ ...base(), status: TaskStatus.ToDo })), false)
			assert.equal(base().editEquals(new Entry({ ...base(), start: undefined, end: undefined })), false)
		})

		it('treats both-unset optional fields as equal', () => {
			const a = new Entry({ sourceId: 's', type: EntryType.Task, heading: 'Task' })
			const b = new Entry({ sourceId: 's', type: EntryType.Task, heading: 'Task' })
			assert.equal(a.editEquals(b), true)
		})

		it('compares reminders by value', () => {
			assert.equal(new Entry({ ...base(), reminders: [10, 30] }).editEquals(new Entry({ ...base(), reminders: [10, 30] })), true)
			assert.equal(new Entry({ ...base(), reminders: [10, 30] }).editEquals(new Entry({ ...base(), reminders: [10] })), false)
		})
	})

	describe('migrateTo', () => {
		const calendar = new Source({ id: 'cal', entryTypes: [EntryType.Event], name: 'Calendar' })
		const taskList = new Source({ id: 'tasks', entryTypes: [EntryType.Task], name: 'Tasks' })
		const both = new Source({ id: 'both', entryTypes: [EntryType.Event, EntryType.Task], name: 'Everything' })

		it('converts only where the target cannot hold the entry\'s type', () => {
			const e = new Entry({ id: 'a', sourceId: 'cal', type: EntryType.Event, heading: 'Meeting' })
			e.migrateTo(taskList)
			assert.equal(e.sourceId, 'tasks')
			assert.equal(e.type, EntryType.Task)
		})

		it('keeps the type on a source that supports both — a source holds types, it doesn\'t dictate one', () => {
			const task = new Entry({ id: 'a', sourceId: 'tasks', type: EntryType.Task, heading: 'Todo', status: TaskStatus.Done })
			task.migrateTo(both)
			assert.equal(task.sourceId, 'both')
			assert.equal(task.type, EntryType.Task)
			assert.equal(task.status, TaskStatus.Done) // still a task, so its status stands
		})

		it('keeps a status only where it makes sense — on a task', () => {
			const task = new Entry({ id: 'a', sourceId: 'tasks', type: EntryType.Task, heading: 'Todo', status: TaskStatus.Done })
			task.migrateTo(calendar)
			assert.equal(task.type, EntryType.Event)
			assert.equal(task.status, undefined)
			const event = new Entry({ id: 'b', sourceId: 'cal', type: EntryType.Event, heading: 'Meeting' })
			event.migrateTo(taskList)
			assert.equal(event.status, undefined) // becomes a task with no status yet — that's "to do"
		})

		it('leaves identity and link fields to the backend', () => {
			const e = new Entry({ id: 'a', uri: '/dav/a.ics', data: { etag: '"1"' }, sourceId: 'cal', type: EntryType.Event, heading: 'Meeting' })
			e.migrateTo(taskList)
			assert.equal(e.id, 'a')
			assert.equal(e.uri, '/dav/a.ics')
			assert.deepEqual(e.data, { etag: '"1"' })
		})
	})

	// What the editor's draft type switch drives (a source holding both types — see Source.entryTypes).
	describe('the type setter', () => {
		it('drops the status when becoming an event — only a task has one', () => {
			const task = new Entry({ sourceId: 's', type: EntryType.Task, heading: 'Draft', status: TaskStatus.Doing })
			task.type = EntryType.Event
			assert.equal(task.type, EntryType.Event)
			assert.equal(task.status, undefined)
		})

		it('becoming a task leaves the status unset — which is "to do"', () => {
			const event = new Entry({ sourceId: 's', type: EntryType.Event, heading: 'Draft' })
			event.type = EntryType.Task
			assert.equal(event.type, EntryType.Task)
			assert.equal(event.status, undefined)
		})

		it('keeps everything else — the span and content survive the flip both ways', () => {
			const draft = new Entry({ sourceId: 's', type: EntryType.Event, heading: 'Draft', start: at(0, 9), end: at(0, 10), reminders: [30] })
			draft.type = EntryType.Task
			draft.type = EntryType.Event
			assert.equal(draft.start!.valueOf(), at(0, 9).valueOf())
			assert.equal(draft.end!.valueOf(), at(0, 10).valueOf())
			assert.deepEqual(draft.reminders, [30])
		})
	})

	// The type lives behind an accessor, so a plain spread would send the backing `_type` — the member's
	// `@converter` is what maps it onto `type`, and the API's request builder (which structure-clones,
	// stripping every prototype) is the harshest path it takes.
	describe('crossing the API', () => {
		const entry = new Entry({ id: 'e1', sourceId: 's1', type: EntryType.Task, heading: 'Chore', status: TaskStatus.Doing })

		it('sends the type under its public name, as a plain value', () => {
			assert.equal(wireOf(entry).type, 'task')
			assert.equal('_type' in wireOf(entry), false)
		})

		it('comes back as the value-object SINGLETON, so `===` and `isTask` hold', () => {
			const revived = revive<Entry>(wireOf(entry))

			assert.ok(revived instanceof Entry)
			assert.equal(revived.type, EntryType.Task)
			assert.equal(revived.status, TaskStatus.Doing)
		})
	})

	describe('clone / assign', () => {
		it('clone is a detached value copy', () => {
			const e = new Entry({ id: 'a', sourceId: 's', type: EntryType.Event, heading: 'Standup', start: at(0, 9), end: at(0, 10) })
			const snapshot = e.clone()
			e.heading = 'Renamed'
			e.moveStart(at(1, 9))
			assert.equal(snapshot.heading, 'Standup')
			assert.equal(snapshot.start!.valueOf(), at(0, 9).valueOf())
			assert.notEqual(snapshot, e)
		})

		it('assign adopts values in place, preserving identity', () => {
			const e = new Entry({ id: 'a', sourceId: 's', type: EntryType.Event, heading: 'Old', start: at(0, 9), end: at(0, 10) })
			const incoming = new Entry({ id: 'a', sourceId: 's', type: EntryType.Event, heading: 'New', start: at(1, 9), end: at(1, 10) })
			const result = e.assign(incoming)
			assert.equal(result, e)
			assert.equal(e.heading, 'New')
			assert.equal(e.start!.valueOf(), at(1, 9).valueOf())
			assert.equal(e.editEquals(incoming), true)
		})

		it('adoptSpan takes over start, end, and all-day — nothing else', () => {
			const e = new Entry({ id: 'a', heading: 'Mine', start: at(0, 9), end: at(0, 10), allDay: false })
			const other = new Entry({ id: 'b', heading: 'Other', start: day, end: day.add({ hours: 24 }), allDay: true })
			e.adoptSpan(other)
			assert.equal(e.start!.valueOf(), day.valueOf())
			assert.equal(e.end!.valueOf(), day.add({ hours: 24 }).valueOf())
			assert.equal(e.allDay, true)
			assert.equal(e.id, 'a')
			assert.equal(e.heading, 'Mine')
		})

		it('assign clears fields the incoming entry lacks', () => {
			const e = new Entry({ id: 'a', sourceId: 's', type: EntryType.Task, heading: 'Task', status: TaskStatus.Done, color: '#ff0000' })
			e.assign(new Entry({ id: 'a', sourceId: 's', type: EntryType.Task, heading: 'Task', color: null }))
			assert.equal(e.status, undefined)
			assert.equal(e.color, null)
		})
	})

	describe('setTimeZone', () => {
		it('keeps the wall clock and moves the instant', () => {
			// 14:00 Berlin (CEST, UTC+2) → picked Tehran (UTC+3:30): stays 14:00 on the wall, so the
			// instant moves from 12:00Z to 10:30Z.
			const e = new Entry({
				start: new Date('2026-07-06T12:00:00Z') as unknown as DateTime,
				end: new Date('2026-07-06T13:00:00Z') as unknown as DateTime,
				timeZone: 'Europe/Berlin',
			})
			e.setTimeZone('Asia/Tehran')
			assert.equal(e.timeZone, 'Asia/Tehran')
			assert.equal(new Date(e.start!.valueOf()).toISOString(), '2026-07-06T10:30:00.000Z')
			assert.equal(new Date(e.end!.valueOf()).toISOString(), '2026-07-06T11:30:00.000Z')
			// The re-zoned values must be REAL DateTimes — the editor reads DateTime getters right after.
			assert.equal(e.multiDay, false)
			assert.ok(e.start instanceof DateTime)
		})

		it('leaves an all-day span alone — floating days have no wall clock to keep', () => {
			const e = new Entry({
				start: new Date('2026-07-06T00:00:00Z') as unknown as DateTime,
				end: new Date('2026-07-07T00:00:00Z') as unknown as DateTime,
				allDay: true,
				timeZone: 'Europe/Berlin',
			})
			e.setTimeZone('Asia/Tehran')
			assert.equal(e.timeZone, 'Asia/Tehran')
			assert.equal(new Date(e.start!.valueOf()).toISOString(), '2026-07-06T00:00:00.000Z')
		})

		it('pins a FLOATING entry\'s as-if-UTC wall clock to the picked zone', () => {
			const e = new Entry({
				start: new Date('2026-07-06T09:00:00Z') as unknown as DateTime, // floating 09:00, encoded as-if-UTC
				end: new Date('2026-07-06T09:30:00Z') as unknown as DateTime,
				timeZone: FLOATING_TIME_ZONE,
			})
			e.setTimeZone('Asia/Tehran')
			assert.equal(e.timeZone, 'Asia/Tehran')
			// The 09:00 wall clock survives, now anchored: 09:00 Tehran = 05:30Z.
			assert.equal(new Date(e.start!.valueOf()).toISOString(), '2026-07-06T05:30:00.000Z')
		})
	})

	describe('setAllDay', () => {
		it('snaps a timed entry to the day(s) it covers', () => {
			const e = new Entry({ start: at(0, 9), end: at(0, 10) })
			e.setAllDay(true)
			assert.equal(e.allDay, true)
			assert.equal(e.start!.valueOf(), day.valueOf())
			assert.equal(e.end!.valueOf(), day.add({ days: 1 }).valueOf())
		})

		it('restores a default 09:00–10:00 slot when turned off', () => {
			const e = new Entry({ start: day, end: day.add({ days: 1 }), allDay: true })
			e.setAllDay(false)
			assert.equal(e.allDay, false)
			assert.equal(e.start!.valueOf(), at(0, 9).valueOf())
			assert.equal(e.end!.valueOf(), at(0, 10).valueOf())
		})
	})
})
