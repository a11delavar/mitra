import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Entry, EntryType, TaskStatus } from './Entry.js'

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
