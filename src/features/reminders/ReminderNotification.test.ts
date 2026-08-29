import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ReminderNotification, reminderSpan, type PushPayload } from './ReminderNotification.js'

describe('ReminderNotification', () => {
	const start = Date.parse('2026-07-06T09:30:00Z')
	const MINUTE = 60_000
	const notification = (minutes: number, rest?: Partial<PushPayload>) => new ReminderNotification({
		title: 'Standup', body: 'sent wording', tag: 'e|30', timestamp: start, reminder: { minutes }, ...rest,
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

	describe('ttlSeconds', () => {
		it('expires five minutes past the event start, so a queued push cannot outlive it', () => {
			assert.equal(notification(30).ttlSeconds(start - 30 * MINUTE), (30 + 5) * 60)
		})

		it('gives an at-start reminder only the grace period', () => {
			assert.equal(notification(0).ttlSeconds(start), 5 * 60)
		})

		it('never goes negative for an anchor already in the past', () => {
			assert.equal(notification(0).ttlSeconds(start + 3 * 60 * MINUTE), 5 * 60)
		})
	})

	describe('bodyAt', () => {
		it('repeats the authored offset when delivered on time', () => {
			assert.equal(notification(30).bodyAt(start - 30 * MINUTE), '⏰ Starts in 30 min')
		})

		it('tolerates delivery jitter rather than reading a minute short', () => {
			assert.equal(notification(30).bodyAt(start - 30 * MINUTE + 40_000), '⏰ Starts in 30 min')
		})

		it('tells the truth once delivery drifts past the tolerance', () => {
			assert.equal(notification(30).bodyAt(start - 12 * MINUTE), '⏰ Starts in 12 min')
		})

		it('says the event already started rather than repeating the offset', () => {
			assert.equal(notification(15).bodyAt(start + 20 * MINUTE), '⏰ Started 20 min ago')
		})

		it('rounds a long overdue span instead of naming it in minutes', () => {
			assert.equal(notification(15).bodyAt(start - 7 * 24 * 60 * MINUTE - 90_000), '⏰ Starts in 7 days')
		})

		it('collapses the minute around the start to "now"', () => {
			assert.equal(notification(30).bodyAt(start + 20_000), '⏰ Starts now')
		})

		it('appends the location', () => {
			const withLocation = notification(30, { reminder: { minutes: 30, location: 'Room 2' } })
			assert.equal(withLocation.bodyAt(start - 30 * MINUTE), '⏰ Starts in 30 min 📍 Room 2')
		})

		it('keeps the sent body when there is nothing to time against', () => {
			const test = new ReminderNotification({ title: 'Mitra', body: '🔔 Working', tag: 'mitra-test' })
			assert.equal(test.bodyAt(Date.now()), '🔔 Working')
		})
	})

	describe('compose', () => {
		it('pre-renders the body as it reads on time — the fallback for an older service worker', () => {
			const payload = ReminderNotification.compose({ title: 'Standup', tag: 'e|30', timestamp: start, reminder: { minutes: 30 } }, start - 30 * MINUTE)
			assert.equal(payload.body, '⏰ Starts in 30 min')
		})
	})
})
