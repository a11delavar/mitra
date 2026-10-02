import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from '@3mo/date-time'
import { Source } from '../../../features/sources/Source.js'
import { Entry, Transparency, Visibility } from '../../../features/entries/Entry.js'
import { EntryType, EntryTypes } from '../../../features/entries/EntryType.js'
import { Recurrence } from '../../../features/recurrence/Recurrence.js'
import { CalDAV } from '../CalDAV.js'
import { CalDAVAvailability } from './CalDAVAvailability.js'

const calendars = new Set(['work', 'personal'])

const availability = (init: Partial<Entry> = {}) => new Entry({
	id: 'entry-1', uid: 'uid-1', sourceId: 'work', type: EntryType.Availability,
	heading: 'Deep work', timeZone: 'Europe/Berlin', transparency: Transparency.Busy,
	start: new DateTime('2026-10-06T07:00:00.000Z'), end: new DateTime('2026-10-06T09:00:00.000Z'),
	recurrence: new Recurrence({ freq: 'WEEKLY', byday: ['TU', 'TH'] }),
	...init,
})

const counts = ({ create, update, remove }: ReturnType<typeof CalDAVAvailability.plan>) => [create.length, update.length, remove.length]

describe('busy availability in a CalDAV calendar', () => {
	describe('the event', () => {
		it('is a busy series in the entry\'s own calendar, with its times, rule, exclusions, visibility and place', () => {
			const entry = availability({ exdates: [Date.parse('2026-10-08T07:00:00.000Z')], visibility: Visibility.Private, location: 'Office' })
			const event = CalDAVAvailability.eventOf(entry)

			assert.equal(event.type, EntryType.Event)
			assert.equal(event.sourceId, 'work')
			assert.equal(event.uid, 'mitra-availability-uid-1')
			assert.equal(event.heading, 'Deep work')
			assert.equal(event.transparency, Transparency.Busy)
			assert.equal(event.visibility, Visibility.Private)
			assert.equal(event.location, 'Office')
			assert.equal(event.timeZone, 'Europe/Berlin')
			assert.equal(event.start?.valueOf(), entry.start?.valueOf())
			assert.equal(Recurrence.equal(event.recurrence, entry.recurrence), true)
			assert.deepEqual(event.exdates, entry.exdates)
		})

		it('is titled "Busy" when the entry has no name', () => {
			assert.equal(CalDAVAvailability.eventOf(availability({ heading: '' })).heading, 'Busy')
		})

		it('is recognized as written for availability, so Mitra shows the availability instead', () => {
			const account = new CalDAV()
			assert.equal(account.writtenForAvailability(CalDAVAvailability.eventOf(availability())), true)
			assert.equal(account.writtenForAvailability(new Entry({ uid: 'standup@example.com' })), false)
		})
	})

	describe('the calendars it goes to', () => {
		it('are enabled, writable and hold events', () => {
			const calendar = (init: Partial<Source>) => CalDAVAvailability.writable(new Source({ enabled: true, ...init }))
			assert.equal(calendar({}), true)
			assert.equal(calendar({ enabled: false }), false)
			assert.equal(calendar({ readOnly: true }), false)
			assert.equal(calendar({ entryTypes: EntryTypes.of(EntryType.Task) }), false)
		})
	})

	describe('the plan', () => {
		it('creates an event for busy availability', () => {
			const plan = CalDAVAvailability.plan([], [availability()], calendars)
			assert.deepEqual(plan.create.map(event => event.uid), ['mitra-availability-uid-1'])
			assert.deepEqual(counts(plan), [1, 0, 0])
		})

		it('writes nothing for free availability', () => {
			assert.deepEqual(counts(CalDAVAvailability.plan([], [availability({ transparency: null }), availability({ transparency: Transparency.Free })], calendars)), [0, 0, 0])
		})

		it('writes nothing for availability in a calendar it cannot write to', () => {
			assert.deepEqual(counts(CalDAVAvailability.plan([], [availability({ sourceId: 'subscription' })], calendars)), [0, 0, 0])
		})

		it('leaves a matching event alone', () => {
			const entry = availability()
			assert.deepEqual(counts(CalDAVAvailability.plan([CalDAVAvailability.eventOf(entry)], [entry], calendars)), [0, 0, 0])
		})

		it('rewrites the event when the availability moves to another place', () => {
			const entry = availability()
			const event = CalDAVAvailability.eventOf(entry)
			entry.location = 'Home office'
			assert.deepEqual(counts(CalDAVAvailability.plan([event], [entry], calendars)), [0, 1, 0])
		})

		it('rewrites an event edited elsewhere', () => {
			const entry = availability()
			const drifted = CalDAVAvailability.eventOf(entry)
			drifted.heading = 'Edited elsewhere'
			const plan = CalDAVAvailability.plan([drifted], [entry], calendars)
			assert.deepEqual(plan.update.map(([event, desired]) => [event, desired.heading]), [[drifted, 'Deep work']])
			assert.deepEqual(counts(plan), [0, 1, 0])
		})

		it('removes the event when the availability is gone or free again', () => {
			const event = CalDAVAvailability.eventOf(availability())
			assert.deepEqual(CalDAVAvailability.plan([event], [], calendars).remove, [event])
			assert.deepEqual(CalDAVAvailability.plan([event], [availability({ transparency: Transparency.Free })], calendars).remove, [event])
		})

		it('removes the event when its calendar is no longer written to', () => {
			const event = CalDAVAvailability.eventOf(availability())
			const plan = CalDAVAvailability.plan([event], [availability()], new Set(['personal']))
			assert.deepEqual(counts(plan), [0, 0, 1])
		})

		it('moves the event along when the availability moves to another calendar', () => {
			const old = CalDAVAvailability.eventOf(availability())
			const plan = CalDAVAvailability.plan([old], [availability({ sourceId: 'personal' })], calendars)
			assert.deepEqual(plan.remove, [old])
			assert.deepEqual(plan.create.map(event => event.sourceId), ['personal'])
		})
	})
})
