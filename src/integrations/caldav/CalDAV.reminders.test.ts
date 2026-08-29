import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ICAL from 'ical.js'
import { CalDAV } from './CalDAV.js'

describe('reminders (VALARM)', () => {
	const component = (kind: 'vevent' | 'vtodo', anchors: ReadonlyArray<string>, alarms: ReadonlyArray<ReadonlyArray<string>> = []) =>
		new ICAL.Component(ICAL.parse([
			'BEGIN:VCALENDAR', 'VERSION:2.0', `BEGIN:${kind.toUpperCase()}`, 'UID:x', ...anchors,
			...alarms.flatMap(lines => ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', ...lines, 'END:VALARM']),
			`END:${kind.toUpperCase()}`, 'END:VCALENDAR',
		].join('\r\n'))).getFirstSubcomponent(kind)!

	const triggersOf = (owner: ICAL.Component) => owner.getAllSubcomponents('valarm')
		.map(alarm => alarm.getFirstProperty('trigger'))
		.map(trigger => `${trigger!.getFirstValue()}${trigger!.getParameter('related') ? ';END' : ''}`)

	it('reads a start-relative trigger as minutes before', () => {
		assert.deepEqual(CalDAV.remindersFrom(component('vevent', ['DTSTART:20260101T090000Z'], [['TRIGGER:-PT30M']])), [30])
	})

	it('ignores absolute, after-start and EMAIL alarms', () => {
		const owner = component('vevent', ['DTSTART:20260101T090000Z'], [
			['TRIGGER;VALUE=DATE-TIME:20260101T080000Z'],
			['TRIGGER:PT10M'],
			['TRIGGER:-PT30M'],
		])
		owner.getAllSubcomponents('valarm')[2]!.updatePropertyWithValue('action', 'EMAIL')
		assert.equal(CalDAV.remindersFrom(owner), null)
	})

	it('reads a due-only task\'s END-anchored alarm — its only possible anchor', () => {
		assert.deepEqual(CalDAV.remindersFrom(component('vtodo', ['DUE:20260101T090000Z'], [['TRIGGER;RELATED=END:-PT30M']])), [30])
	})

	it('still ignores an END-anchored alarm when the component also has a start', () => {
		assert.equal(CalDAV.remindersFrom(component('vtodo', ['DTSTART:20260101T080000Z', 'DUE:20260101T090000Z'], [['TRIGGER;RELATED=END:-PT30M']])), null)
	})

	it('writes a due-only task\'s alarm against END, so it has something to trigger on', () => {
		const owner = component('vtodo', ['DUE:20260101T090000Z'])
		CalDAV.writeReminders(owner, [30])
		assert.deepEqual(triggersOf(owner), ['-PT30M;END'])
		assert.deepEqual(CalDAV.remindersFrom(owner), [30])
	})

	it('leaves START implicit when the component has a start', () => {
		const owner = component('vtodo', ['DTSTART:20260101T090000Z'])
		CalDAV.writeReminders(owner, [30])
		assert.deepEqual(triggersOf(owner), ['-PT30M'])
	})

	it('preserves an alarm anchored to the end it does not read from', () => {
		const owner = component('vtodo', ['DTSTART:20260101T080000Z', 'DUE:20260101T090000Z'], [['TRIGGER;RELATED=END:-PT15M']])
		CalDAV.writeReminders(owner, [30])
		assert.deepEqual(triggersOf(owner).sort(), ['-PT15M;END', '-PT30M'])
	})

	it('replaces its own alarms rather than accumulating them', () => {
		const owner = component('vevent', ['DTSTART:20260101T090000Z'], [['TRIGGER:-PT30M']])
		CalDAV.writeReminders(owner, [10])
		assert.deepEqual(triggersOf(owner), ['-PT10M'])
		CalDAV.writeReminders(owner, null)
		assert.deepEqual(triggersOf(owner), [])
	})
})
