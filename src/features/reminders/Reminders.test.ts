import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type DateTime } from '@3mo/date-time'
import { EntryType } from '../entries/EntryType.js'
import { Entry, FLOATING_TIME_ZONE } from '../entries/Entry.js'
import { dueReminders } from './Reminders.js'

describe('Reminders', () => {
	const D = (iso: string) => new Date(iso) as unknown as DateTime
	const entry = (init: Partial<Entry>) => new Entry({ id: 'e', sourceId: 's', type: EntryType.Event, heading: 'Standup', ...init })
	const task = (init: Partial<Entry>) => entry({ type: EntryType.Task, ...init })

	describe('dueReminders', () => {
		const watermark = new Date('2026-07-06T09:00:00Z')
		const now = new Date('2026-07-06T09:01:00Z')

		it('fires a reminder whose fire time falls inside (watermark, now]', () => {
			const due = dueReminders([entry({ start: D('2026-07-06T09:31:00Z'), reminders: [30] })], watermark, now)
			assert.equal(due.length, 1)
			assert.equal(due[0]!.minutes, 30)
		})

		it('excludes the watermark itself', () => {
			const due = dueReminders([entry({ start: D('2026-07-06T09:30:00Z'), reminders: [30] })], watermark, now)
			assert.equal(due.length, 0)
		})

		it('does not fire early or late', () => {
			const early = dueReminders([entry({ start: D('2026-07-06T09:35:00Z'), reminders: [30] })], watermark, now)
			const late = dueReminders([entry({ start: D('2026-07-06T09:25:00Z'), reminders: [30] })], watermark, now)
			assert.equal(early.length + late.length, 0)
		})

		it('fires each offset independently — only the due one', () => {
			const due = dueReminders([entry({ start: D('2026-07-06T09:31:00Z'), reminders: [0, 30, 60] })], watermark, now)
			assert.deepEqual(due.map(d => d.minutes), [30])
		})

		it('reports the exact instant to fire at, not the tick that noticed it', () => {
			const due = dueReminders([entry({ start: D('2026-07-06T09:31:00Z'), reminders: [30] })], watermark, new Date('2026-07-06T09:02:00Z'))
			assert.equal(due[0]!.fireAt, Date.parse('2026-07-06T09:01:00Z'))
			assert.equal(due[0]!.anchor, Date.parse('2026-07-06T09:31:00Z'))
		})

		it('skips entries with no anchor or no reminders', () => {
			const due = dueReminders([
				entry({ reminders: [30] }),
				entry({ start: D('2026-07-06T09:31:00Z') }),
				entry({ start: D('2026-07-06T09:31:00Z'), reminders: [] }),
			], watermark, now)
			assert.equal(due.length, 0)
		})

		it('an "at start" reminder (0) fires at the start itself', () => {
			const due = dueReminders([entry({ start: D('2026-07-06T09:01:00Z'), reminders: [0] })], watermark, now)
			assert.equal(due.length, 1)
			assert.equal(due[0]!.minutes, 0)
		})

		it('anchors a due-only task to its due date', () => {
			const due = dueReminders([task({ end: D('2026-07-06T09:31:00Z'), reminders: [30] })], watermark, now)
			assert.equal(due.length, 1)
			assert.equal(due[0]!.anchor, Date.parse('2026-07-06T09:31:00Z'))
		})

		it('prefers the start over the due date when a task has both', () => {
			const due = dueReminders([task({ start: D('2026-07-06T09:31:00Z'), end: D('2026-07-06T18:00:00Z'), reminders: [30] })], watermark, now)
			assert.equal(due[0]!.anchor, Date.parse('2026-07-06T09:31:00Z'))
		})

		it('never anchors an EVENT to its end — only a task has a due date', () => {
			const due = dueReminders([entry({ end: D('2026-07-06T09:31:00Z'), reminders: [30] })], watermark, now)
			assert.equal(due.length, 0)
		})

		describe('floating entries', () => {
			const floating = () => entry({ start: D('2026-07-06T09:31:00Z'), reminders: [30], timeZone: FLOATING_TIME_ZONE })

			it('resolves the wall clock in the observer zone', () => {
				const due = dueReminders([floating()], new Date('2026-07-06T07:00:00Z'), new Date('2026-07-06T07:01:00Z'), () => 'Europe/Berlin')
				assert.equal(due.length, 1)
				assert.equal(due[0]!.fireAt, Date.parse('2026-07-06T07:01:00Z'))
			})

			it('does not fire at the stored instant for that observer', () => {
				assert.equal(dueReminders([floating()], watermark, now, () => 'Europe/Berlin').length, 0)
			})

			it('falls back to the stored instant when no zone is known', () => {
				assert.equal(dueReminders([floating()], watermark, now).length, 1)
			})

			it('leaves an all-day span alone — those are floating DAYS, not wall clocks', () => {
				const allDay = entry({ start: D('2026-07-06T09:31:00Z'), reminders: [30], timeZone: FLOATING_TIME_ZONE, allDay: true })
				assert.equal(dueReminders([allDay], watermark, now, () => 'Europe/Berlin').length, 1)
			})
		})
	})
})
