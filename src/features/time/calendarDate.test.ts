import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calendarDateOf, midnightOf, normalizeAllDay, projectAllDay } from './calendarDate.js'

// All-day bounds are calendar DATES: stored as canonical UTC midnights, projected into the viewer's
// zone on read — `calendarDateOf` and `midnightOf` must be exact inverses in every zone, or an
// all-day event drifts off its dates for some viewer.
describe('all-day date encoding', () => {
	const jun2 = Temporal.PlainDate.from('2026-06-02')

	it('midnightOf(date, UTC) is the canonical all-day encoding', () => {
		assert.equal(midnightOf(jun2, 'UTC').toISOString(), '2026-06-02T00:00:00.000Z')
	})

	it('midnightOf projects a date to its local midnight in the viewer\'s zone', () => {
		assert.equal(midnightOf(jun2, 'Europe/Berlin').toISOString(), '2026-06-01T22:00:00.000Z') // CEST, +2
		assert.equal(midnightOf(jun2, 'Asia/Tehran').toISOString(), '2026-06-01T20:30:00.000Z') // half-hour zone
		assert.equal(midnightOf(jun2, 'America/New_York').toISOString(), '2026-06-02T04:00:00.000Z') // west of UTC
		assert.equal(midnightOf(jun2, 'Pacific/Kiritimati').toISOString(), '2026-06-01T10:00:00.000Z') // +14, beyond ±12
		assert.equal(midnightOf(Temporal.PlainDate.from('2026-01-15'), 'Europe/Berlin').toISOString(), '2026-01-14T23:00:00.000Z') // CET, +1
	})

	it('round-trips: the projected midnight reads as the same date in that zone, everywhere', () => {
		for (const zone of ['Europe/Berlin', 'Asia/Tehran', 'America/New_York', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'UTC']) {
			const midnight = midnightOf(jun2, zone)
			assert.ok(calendarDateOf(midnight, zone).equals(jun2), zone)
			assert.equal(midnightOf(calendarDateOf(midnight, zone), 'UTC').toISOString(), '2026-06-02T00:00:00.000Z', zone)
		}
	})

	it('calendarDateOf speaks Temporal: a real PlainDate, in any zone and without one', () => {
		assert.ok(calendarDateOf(new Date('2026-07-11T22:30:00Z'), 'Europe/Berlin') instanceof Temporal.PlainDate)
		assert.equal(calendarDateOf(new Date('2026-07-11T22:30:00Z'), 'Europe/Berlin').toString(), '2026-07-12')
		assert.ok(calendarDateOf(new Date()) instanceof Temporal.PlainDate)
	})

	it('normalizeAllDay ↔ projectAllDay are inverses across the API boundary', () => {
		// A Berlin viewer's local midnight of Jun 2 (22:00Z Jun 1) normalizes to the canonical UTC date…
		const berlinMidnight = new Date('2026-06-01T22:00:00Z')
		assert.equal(normalizeAllDay(berlinMidnight, 'Europe/Berlin').toISOString(), '2026-06-02T00:00:00.000Z')
		// …and projecting that canonical date back for the same viewer returns the same local midnight.
		assert.equal(projectAllDay(normalizeAllDay(berlinMidnight, 'Europe/Berlin'), 'Europe/Berlin').toISOString(), berlinMidnight.toISOString())
		// A viewer west of UTC: canonical Jun 2 projects to Jun 2 04:00Z, and normalizes straight back.
		const canonical = new Date('2026-06-02T00:00:00Z')
		assert.equal(projectAllDay(canonical, 'America/New_York').toISOString(), '2026-06-02T04:00:00.000Z')
		assert.equal(normalizeAllDay(projectAllDay(canonical, 'America/New_York'), 'America/New_York').toISOString(), canonical.toISOString())
	})

	it('a DST-skipped midnight lands on the day\'s first existing wall-clock time', () => {
		// Santiago springs forward at midnight: Sep 6 2026 begins at 01:00 local (04:00Z).
		const midnight = midnightOf(Temporal.PlainDate.from('2026-09-06'), 'America/Santiago')
		assert.equal(calendarDateOf(midnight, 'America/Santiago').toString(), '2026-09-06')
	})
})
