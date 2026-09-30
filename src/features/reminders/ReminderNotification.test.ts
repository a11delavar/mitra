import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ReminderNotification, reminderSpan, type ReminderFacts, type Reader } from './ReminderNotification.js'

const BERLIN = 'Europe/Berlin'

/** 2026-09-08 10:00 in Berlin. */
const start = Date.UTC(2026, 8, 8, 8, 0)
const hour = 60 * 60_000

const notification = (facts: Partial<ReminderFacts>) => new ReminderNotification({
	heading: 'Weekly Client',
	tag: 'entry|30',
	kind: 'event',
	timestamp: start,
	when: { start, end: start + hour },
	...facts,
})

/** Intl's thin and narrow spaces, as plain ones. */
const plain = (text: string) => text.replace(/[\u2009\u202f\u00a0]/g, ' ')

const berlin: Reader = { language: 'en', timeZone: BERLIN }

/** The body as a reader in Berlin sees it, half an hour before the start unless told otherwise. */
const body = (facts: Partial<ReminderFacts>, now = start - 30 * 60_000, reader = berlin) => plain(notification(facts).for(reader, now).body)

describe('ReminderNotification', () => {
	describe('reminderSpan', () => {
		it('picks the largest evenly-dividing unit', () => {
			assert.equal(reminderSpan(30), '30 min')
			assert.equal(reminderSpan(60), '1 hour')
			assert.equal(reminderSpan(90), '90 min')
			assert.equal(reminderSpan(2880), '2 days')
			assert.equal(reminderSpan(10080), '1 week')
		})
	})

	describe('ttlSeconds', () => {
		it('expires five minutes past the event start, so a queued push cannot outlive it', () => {
			assert.equal(notification({}).ttlSeconds(start - 30 * 60_000), 30 * 60 + 300)
		})

		it('gives an at-start reminder only the grace period', () => {
			assert.equal(notification({}).ttlSeconds(start), 300)
		})

		it('never goes negative for an anchor already in the past', () => {
			assert.equal(notification({}).ttlSeconds(start + hour), 300)
		})
	})

	describe('body', () => {
		it('states the time range, not the time remaining', () => {
			assert.equal(body({}), '10:00 – 11:00 AM')
		})

		it('reads the clock in the reader\'s zone and language', () => {
			assert.equal(plain(notification({}).for({ language: 'de', timeZone: 'Asia/Tehran' }, start).body), '11:30–12:30 Uhr')
		})

		it('names another day, and leaves today unnamed', () => {
			assert.equal(body({}, start - 26 * hour), 'Tomorrow · 10:00 – 11:00 AM')
			assert.equal(body({}, start - 5 * 24 * hour), 'Tue, Sep 8 · 10:00 – 11:00 AM')
		})

		it('drops the range for an entry with no end', () => {
			assert.equal(body({ when: { start } }), '10:00 AM')
		})

		it('says all day, reading the day in UTC where it was encoded', () => {
			// Read in New York, a UTC midnight is the evening before.
			const midnight = Date.UTC(2026, 8, 8)
			const facts = { when: { start: midnight, end: midnight + 24 * hour, allDay: true }, timestamp: midnight }
			assert.equal(body(facts, midnight - hour), 'All day')
			assert.equal(body(facts, midnight - 5 * hour, { language: 'en', timeZone: 'America/New_York' }), 'Tomorrow · All day')
		})

		it('reads a floating entry as the wall clock it was written as', () => {
			assert.equal(body({ when: { start, end: start + hour, floating: true } }, start, { language: 'en', timeZone: 'America/New_York' }), '8:00 – 9:00 AM')
		})

		it('calls a due-only task due, and names its day unless that day is today', () => {
			const due = { kind: 'task' as const, when: { end: start, due: true } }
			assert.equal(body(due), 'Due 10:00 AM')
			assert.equal(body(due, start - 26 * hour), 'Due Tomorrow 10:00 AM')
		})

		it('gives an all-day task no clock to be due at', () => {
			const midnight = Date.UTC(2026, 8, 8)
			assert.equal(body({ kind: 'task', when: { end: midnight, due: true, allDay: true } }, midnight - hour), 'Due Today')
		})

		it('appends the location', () => {
			assert.equal(body({ location: 'Room 4' }), '10:00 – 11:00 AM · Room 4')
		})

		it('is empty with nothing to time against', () => {
			assert.equal(body({ when: undefined }), '')
		})

		it('speaks the reader\'s language', () => {
			assert.equal(body({ kind: 'task', when: { end: start, due: true } }, start - 26 * hour, { language: 'de', timeZone: BERLIN }), 'Fällig Morgen 10:00')
		})

		it('falls back to English for a language the app does not speak', () => {
			assert.equal(body({}, start - 26 * hour, { language: 'ja', timeZone: BERLIN }).startsWith('Tomorrow'), true)
		})
	})

	describe('actions', () => {
		const actions = (facts: Partial<ReminderFacts>, language = 'en') => notification(facts).for({ language, timeZone: BERLIN }, start).actions

		it('offers a task the one verb that finishes it', () => {
			assert.deepEqual(actions({ kind: 'task' }).map(action => action.action), ['done', 'snooze'])
		})

		it('gives an event only snooze', () => {
			assert.deepEqual(actions({}).map(action => action.action), ['snooze'])
		})

		it('gives a message with no kind no buttons at all', () => {
			assert.deepEqual(actions({ kind: undefined }), [])
		})

		it('labels them in the reader\'s language', () => {
			assert.deepEqual(actions({ kind: 'task' }, 'de').map(action => action.title), ['Fertig', '10 Min. später'])
		})
	})

	describe('url', () => {
		const url = (facts: Partial<ReminderFacts>, timeZone = BERLIN) => notification(facts).for({ language: 'en', timeZone }, start).url

		it('lands on the entry, on the day it happens', () => {
			assert.equal(url({ entry: { id: 'abc' } }), '/?date=2026-09-08&selected=abc')
		})

		it('addresses an occurrence by the id the calendar renders it under', () => {
			assert.equal(url({ entry: { id: 'abc__123', master: 'abc', recurrenceId: 123 } }), '/?date=2026-09-08&selected=abc__123')
		})

		it('takes the day from the reader, so a late-evening reminder does not open yesterday', () => {
			assert.equal(url({ entry: { id: 'abc' } }, 'Pacific/Auckland'), '/?date=2026-09-08&selected=abc')
		})

		it('falls back to the calendar itself with no entry to open', () => {
			assert.equal(url({}), '/')
		})
	})

	describe('title', () => {
		it('is the heading, or a stand-in in the reader\'s language', () => {
			assert.equal(notification({}).for(berlin, start).title, 'Weekly Client')
			assert.equal(notification({ heading: '' }).for({ language: 'fr', timeZone: BERLIN }, start).title, 'Sans titre')
		})
	})

	describe('rehearsal', () => {
		const now = start - hour

		it('rehearses a task with the task buttons, due half an hour out', () => {
			const rehearsal = ReminderNotification.rehearsal('task', now)
			const payload = rehearsal.for(berlin, now)
			assert.deepEqual(payload.actions.map(action => action.action), ['done', 'snooze'])
			assert.equal(payload.timestamp, now + 30 * 60_000)
			assert.equal(rehearsal.facts.entry, undefined)
		})

		it('names itself in each reader\'s language', () => {
			assert.equal(ReminderNotification.rehearsal('event', now).for(berlin, now).title, 'Test event')
			assert.equal(ReminderNotification.rehearsal('task', now).for({ language: 'de', timeZone: BERLIN }, now).title, 'Testaufgabe')
		})
	})

	describe('parse', () => {
		it('keeps the known facts a device sends back', () => {
			const parsed = ReminderNotification.parse({ heading: 'Standup', tag: 'e|30', kind: 'task', timestamp: start, when: { start, end: start + hour }, entry: { id: 'e' } })
			assert.equal(parsed?.facts.heading, 'Standup')
			assert.equal(parsed?.facts.kind, 'task')
			assert.deepEqual(parsed?.facts.entry, { id: 'e', master: undefined, recurrenceId: undefined })
		})

		it('drops what it does not know', () => {
			const facts = ReminderNotification.parse({ tag: 'e|30', kind: 'meeting', timestamp: 'soon', when: { start: 'now', due: 'yes' }, entry: { id: 7 }, extra: true })!.facts as unknown as Record<string, unknown>
			assert.equal(facts.kind, undefined)
			assert.equal(facts.timestamp, undefined)
			assert.deepEqual(facts.when, { start: undefined, end: undefined, allDay: undefined, floating: undefined, due: undefined })
			assert.equal(facts.entry, undefined)
			assert.equal('extra' in facts, false)
		})

		it('refuses facts with no tag to replace', () => {
			assert.equal(ReminderNotification.parse({ heading: 'Standup' }), undefined)
			assert.equal(ReminderNotification.parse(null), undefined)
		})
	})
})
