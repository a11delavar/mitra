import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type DateTime } from '@3mo/date-time'
import { Entry, EntryType } from '../shared/index.js'
import { dueReminders, reminderSpan } from './reminderDomain.js'

describe('Reminders', () => {
	const D = (iso: string) => new Date(iso) as unknown as DateTime
	const entry = (init: Partial<Entry>) => new Entry({ id: 'e', sourceId: 's', type: EntryType.Event, heading: 'Standup', ...init })

	describe('dueReminders', () => {
		const watermark = new Date('2026-07-06T09:00:00Z')
		const now = new Date('2026-07-06T09:01:00Z')

		it('fires a reminder whose fire time falls inside (watermark, now]', () => {
			// Start 09:31, 30 min before → fires at 09:01 — exactly `now`, inclusive.
			const due = dueReminders([entry({ start: D('2026-07-06T09:31:00Z'), reminders: [30] })], watermark, now)
			assert.equal(due.length, 1)
			assert.equal(due[0]!.minutes, 30)
		})

		it('excludes the watermark itself — the previous tick already fired it', () => {
			const due = dueReminders([entry({ start: D('2026-07-06T09:30:00Z'), reminders: [30] })], watermark, now)
			assert.equal(due.length, 0)
		})

		it('does not fire early or late', () => {
			const early = dueReminders([entry({ start: D('2026-07-06T09:35:00Z'), reminders: [30] })], watermark, now) // fires 09:05
			const late = dueReminders([entry({ start: D('2026-07-06T09:25:00Z'), reminders: [30] })], watermark, now) // fired 08:55
			assert.equal(early.length + late.length, 0)
		})

		it('fires each offset independently — only the due one', () => {
			const due = dueReminders([entry({ start: D('2026-07-06T09:31:00Z'), reminders: [0, 30, 60] })], watermark, now)
			assert.deepEqual(due.map(d => d.minutes), [30])
		})

		it('skips entries with no start or no reminders', () => {
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
	})

	describe('reminderSpan', () => {
		it('picks the largest evenly-dividing unit', () => {
			assert.equal(reminderSpan(30), '30 min')
			assert.equal(reminderSpan(60), '1 hour')
			assert.equal(reminderSpan(120), '2 hours')
			assert.equal(reminderSpan(90), '90 min') // not a whole number of hours
			assert.equal(reminderSpan(24 * 60), '1 day')
			assert.equal(reminderSpan(2 * 7 * 24 * 60), '2 weeks')
		})
	})
})
