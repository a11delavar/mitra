import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EntryTimeZone } from '../entries/EntryTimeZone.js'
import { type DateTime } from '@3mo/date-time'
import { EntryType } from '../entries/EntryType.js'
import { Entry } from '../entries/Entry.js'
import { TaskStatus } from '../entries/TaskStatus.js'
import { DueReminder } from './Reminders.js'
import { Recurrence } from '../recurrence/Recurrence.js'
import { RecurrenceFrequency } from '../recurrence/RecurrenceFrequency.js'

describe('Reminders', () => {
	const D = (iso: string) => new Date(iso) as unknown as DateTime
	/** A one-off entry's occurrence. */
	const entry = (init: Partial<Entry>) => new Entry({ id: 'e', sourceId: 's', type: EntryType.Event, heading: 'Standup', ...init }).occurrences.single
	const task = (init: Partial<Entry>) => entry({ type: EntryType.Task, ...init })

	describe('DueReminder.within', () => {
		const watermark = new Date('2026-07-06T09:00:00Z')
		const now = new Date('2026-07-06T09:01:00Z')

		it('fires a reminder whose fire time falls inside (watermark, now]', () => {
			const due = DueReminder.within([entry({ start: D('2026-07-06T09:31:00Z'), reminders: [30] })], watermark, now)
			assert.equal(due.length, 1)
			assert.equal(due[0]!.minutes, 30)
		})

		it('excludes the watermark itself', () => {
			const due = DueReminder.within([entry({ start: D('2026-07-06T09:30:00Z'), reminders: [30] })], watermark, now)
			assert.equal(due.length, 0)
		})

		it('does not fire early or late', () => {
			const early = DueReminder.within([entry({ start: D('2026-07-06T09:35:00Z'), reminders: [30] })], watermark, now)
			const late = DueReminder.within([entry({ start: D('2026-07-06T09:25:00Z'), reminders: [30] })], watermark, now)
			assert.equal(early.length + late.length, 0)
		})

		it('fires each offset independently, only the due one', () => {
			const due = DueReminder.within([entry({ start: D('2026-07-06T09:31:00Z'), reminders: [0, 30, 60] })], watermark, now)
			assert.deepEqual(due.map(d => d.minutes), [30])
		})

		it('reports the exact instant to fire at, not the tick that noticed it', () => {
			const due = DueReminder.within([entry({ start: D('2026-07-06T09:31:00Z'), reminders: [30] })], watermark, new Date('2026-07-06T09:02:00Z'))
			assert.equal(due[0]!.fireAt, Date.parse('2026-07-06T09:01:00Z'))
			assert.equal(due[0]!.anchor, Date.parse('2026-07-06T09:31:00Z'))
		})

		it('skips entries with no anchor or no reminders', () => {
			const due = DueReminder.within([
				entry({ reminders: [30] }),
				entry({ start: D('2026-07-06T09:31:00Z') }),
				entry({ start: D('2026-07-06T09:31:00Z'), reminders: [] }),
			], watermark, now)
			assert.equal(due.length, 0)
		})

		it('an "at start" reminder (0) fires at the start itself', () => {
			const due = DueReminder.within([entry({ start: D('2026-07-06T09:01:00Z'), reminders: [0] })], watermark, now)
			assert.equal(due.length, 1)
			assert.equal(due[0]!.minutes, 0)
		})

		it('anchors a due-only task to its due date', () => {
			const due = DueReminder.within([task({ due: D('2026-07-06T09:31:00Z'), reminders: [30] })], watermark, now)
			assert.equal(due.length, 1)
			assert.equal(due[0]!.anchor, Date.parse('2026-07-06T09:31:00Z'))
		})

		it('prefers the start over the due date when a task has both', () => {
			const due = DueReminder.within([task({ start: D('2026-07-06T09:31:00Z'), due: D('2026-07-06T18:00:00Z'), reminders: [30] })], watermark, now)
			assert.equal(due[0]!.anchor, Date.parse('2026-07-06T09:31:00Z'))
		})

		it('never anchors an EVENT to its end, since only a task has a due date', () => {
			const due = DueReminder.within([entry({ end: D('2026-07-06T09:31:00Z'), reminders: [30] })], watermark, now)
			assert.equal(due.length, 0)
		})

		it('says nothing about a task the user already closed', () => {
			const start = D('2026-07-06T09:31:00Z')
			assert.equal(DueReminder.within([task({ start, reminders: [30], status: TaskStatus.Done })], watermark, now).length, 0)
			assert.equal(DueReminder.within([task({ start, reminders: [30], status: TaskStatus.Cancelled })], watermark, now).length, 0)
			assert.equal(DueReminder.within([task({ start, reminders: [30], status: TaskStatus.Doing })], watermark, now).length, 1)
		})

		it('builds the notification of the occurrence it is due for', () => {
			const at = D('2026-07-06T09:31:00Z')
			const rent = new Entry({ id: 'master', sourceId: 's', type: EntryType.Task, heading: 'Rent', due: D('2026-07-05T09:31:00Z'), reminders: [30], location: 'Room 4', recurrence: new Recurrence({ freq: RecurrenceFrequency.Daily }) })
			const [due] = DueReminder.within([rent.occurrences.at(at)], watermark, now)
			const { facts } = due!.notification()
			const key = `master__${at.getTime()}`
			assert.equal(facts.kind, 'task')
			assert.equal(facts.tag, `${key}|30`)
			assert.equal(facts.timestamp, Date.parse('2026-07-06T09:31:00Z'))
			assert.equal(facts.when?.due, true)
			assert.equal(facts.when?.end, Date.parse('2026-07-06T09:31:00Z'))
			assert.equal(facts.location, 'Room 4')
			assert.deepEqual(facts.entry, { id: key, master: 'master', recurrenceId: at.getTime() })
		})

		describe('floating entries', () => {
			const floating = () => entry({ start: D('2026-07-06T09:31:00Z'), reminders: [30], timeZone: EntryTimeZone.floating })

			it('resolves the wall clock in the observer zone', () => {
				const due = DueReminder.within([floating()], new Date('2026-07-06T07:00:00Z'), new Date('2026-07-06T07:01:00Z'), () => 'Europe/Berlin')
				assert.equal(due.length, 1)
				assert.equal(due[0]!.fireAt, Date.parse('2026-07-06T07:01:00Z'))
			})

			it('does not fire at the stored instant for that observer', () => {
				assert.equal(DueReminder.within([floating()], watermark, now, () => 'Europe/Berlin').length, 0)
			})

			it('falls back to the stored instant when no zone is known', () => {
				assert.equal(DueReminder.within([floating()], watermark, now).length, 1)
			})

			it('leaves an all-day span alone, since those are floating DAYS, not wall clocks', () => {
				const allDay = entry({ start: D('2026-07-06T09:31:00Z'), reminders: [30], timeZone: EntryTimeZone.floating, allDay: true })
				assert.equal(DueReminder.within([allDay], watermark, now, () => 'Europe/Berlin').length, 1)
			})
		})
	})
})
