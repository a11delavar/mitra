import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ICAL from 'ical.js'
import { buildVTimezone } from './vtimezone.js'

describe('buildVTimezone', () => {
	const observances = (vtimezone: ICAL.Component) =>
		[...vtimezone.getAllSubcomponents('standard'), ...vtimezone.getAllSubcomponents('daylight')]

	const rule = (vtimezone: ICAL.Component, kind: 'standard' | 'daylight') =>
		vtimezone.getFirstSubcomponent(kind)?.getFirstPropertyValue('rrule')?.toString()

	it('compresses a regular DST zone into two yearly RRULE observances', () => {
		const berlin = buildVTimezone('Europe/Berlin', 2026)
		assert.equal(berlin.getFirstPropertyValue('tzid')?.toString(), 'Europe/Berlin')
		assert.equal(observances(berlin).length, 2)
		// EU rule: daylight from the last Sunday of March, standard from the last Sunday of October.
		assert.match(rule(berlin, 'daylight')!, /FREQ=YEARLY.*BYMONTH=3/)
		assert.match(rule(berlin, 'daylight')!, /BYDAY=-1SU/)
		assert.match(rule(berlin, 'standard')!, /FREQ=YEARLY.*BYMONTH=10/)
		const daylight = berlin.getFirstSubcomponent('daylight')!
		assert.equal(daylight.getFirstPropertyValue('tzoffsetfrom')?.toString(), '+01:00')
		assert.equal(daylight.getFirstPropertyValue('tzoffsetto')?.toString(), '+02:00')
	})

	it('nth-weekday zones compress too (US: 2nd Sunday of March / 1st Sunday of November)', () => {
		const newYork = buildVTimezone('America/New_York', 2026)
		assert.match(rule(newYork, 'daylight')!, /BYMONTH=3/)
		assert.match(rule(newYork, 'daylight')!, /BYDAY=2SU/)
		assert.match(rule(newYork, 'standard')!, /BYMONTH=11/)
		assert.match(rule(newYork, 'standard')!, /BYDAY=1SU/)
	})

	it('emits a single standing observance for a zone without transitions', () => {
		// Iran abolished DST in 2022 — a fixed +03:30 within any modern window.
		const tehran = buildVTimezone('Asia/Tehran', 2026)
		const all = observances(tehran)
		assert.equal(all.length, 1)
		assert.equal(all[0]!.name, 'standard')
		assert.equal(all[0]!.getFirstPropertyValue('tzoffsetfrom')?.toString(), '+03:30')
		assert.equal(all[0]!.getFirstPropertyValue('tzoffsetto')?.toString(), '+03:30')
		assert.equal(rule(tehran, 'standard'), undefined)
	})

	// The property the whole feature rests on: an .ics we write with `DTSTART;TZID=…` + this VTIMEZONE
	// must yield the same instants back when parsed — by our own sync and by any other client.
	it('round-trips zoned local times to the correct instants, on both sides of a DST flip', () => {
		const calendar = new ICAL.Component('vcalendar')
		calendar.addSubcomponent(buildVTimezone('Europe/Berlin', 2026))
		const event = new ICAL.Component('vevent')
		calendar.addSubcomponent(event)

		const zone = new ICAL.Timezone({ component: calendar.getFirstSubcomponent('vtimezone')!, tzid: 'Europe/Berlin' })
		const write = (property: string, data: { month: number, day: number }) => {
			const time = ICAL.Time.fromData({ year: 2026, ...data, hour: 9, minute: 0, second: 0 }, zone)
			event.updatePropertyWithValue(property, time).setParameter('tzid', 'Europe/Berlin')
		}

		write('dtstart', { month: 7, day: 7 }) // CEST: 09:00 Berlin = 07:00Z
		write('dtend', { month: 12, day: 7 }) // CET: 09:00 Berlin = 08:00Z

		// Serialize and re-parse from scratch — the zone must resolve via the embedded VTIMEZONE alone.
		const reparsed = new ICAL.Component(ICAL.parse(calendar.toString()))
		const parsedEvent = new ICAL.Event(reparsed.getFirstSubcomponent('vevent')!)
		assert.equal(parsedEvent.startDate.toJSDate().toISOString(), '2026-07-07T07:00:00.000Z')
		assert.equal(parsedEvent.endDate.toJSDate().toISOString(), '2026-12-07T08:00:00.000Z')
		assert.match(calendar.toString(), /DTSTART;TZID=Europe\/Berlin:20260707T090000/)
	})
})
