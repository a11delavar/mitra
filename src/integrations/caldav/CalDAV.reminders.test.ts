import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EntryReminders } from '#features/reminders/EntryReminders.js'
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
		assert.deepEqual(CalDAV.remindersFrom(component('vevent', ['DTSTART:20260101T090000Z'], [['TRIGGER:-PT30M']])), EntryReminders.normalize([30]))
	})

	it('ignores absolute and after-start alarms', () => {
		const owner = component('vevent', ['DTSTART:20260101T090000Z'], [
			['TRIGGER;VALUE=DATE-TIME:20260101T080000Z'],
			['TRIGGER:PT10M'],
		])
		assert.equal(CalDAV.remindersFrom(owner), undefined)
	})

	it('reads and writes an EMAIL alarm as an email reminder', () => {
		const owner = component('vevent', ['DTSTART:20260101T090000Z'], [['TRIGGER:-PT30M']])
		owner.getFirstSubcomponent('valarm')!.updatePropertyWithValue('action', 'EMAIL')
		assert.deepEqual(CalDAV.remindersFrom(owner), EntryReminders.normalize([{ minutes: 30, email: true }]))
		CalDAV.writeReminders(owner, EntryReminders.normalize([10, { minutes: 30, email: true }]))
		assert.deepEqual(owner.getAllSubcomponents('valarm').map(alarm => `${alarm.getFirstPropertyValue('action')} ${alarm.getFirstPropertyValue('trigger')}`), ['DISPLAY -PT10M', 'EMAIL -PT30M'])
	})

	it('reads a due-only task\'s END-anchored alarm, its only possible anchor', () => {
		assert.deepEqual(CalDAV.remindersFrom(component('vtodo', ['DUE:20260101T090000Z'], [['TRIGGER;RELATED=END:-PT30M']])), EntryReminders.normalize([30]))
	})

	it('still ignores an END-anchored alarm when the component also has a start', () => {
		assert.equal(CalDAV.remindersFrom(component('vtodo', ['DTSTART:20260101T080000Z', 'DUE:20260101T090000Z'], [['TRIGGER;RELATED=END:-PT30M']])), undefined)
	})

	it('writes a due-only task\'s alarm against END, so it has something to trigger on', () => {
		const owner = component('vtodo', ['DUE:20260101T090000Z'])
		CalDAV.writeReminders(owner, EntryReminders.normalize([30]))
		assert.deepEqual(triggersOf(owner), ['-PT30M;END'])
		assert.deepEqual(CalDAV.remindersFrom(owner), EntryReminders.normalize([30]))
	})

	it('leaves START implicit when the component has a start', () => {
		const owner = component('vtodo', ['DTSTART:20260101T090000Z'])
		CalDAV.writeReminders(owner, EntryReminders.normalize([30]))
		assert.deepEqual(triggersOf(owner), ['-PT30M'])
	})

	it('preserves an alarm anchored to the end it does not read from', () => {
		const owner = component('vtodo', ['DTSTART:20260101T080000Z', 'DUE:20260101T090000Z'], [['TRIGGER;RELATED=END:-PT15M']])
		CalDAV.writeReminders(owner, EntryReminders.normalize([30]))
		assert.deepEqual(triggersOf(owner).sort(), ['-PT15M;END', '-PT30M'])
	})

	it('replaces its own alarms rather than accumulating them', () => {
		const owner = component('vevent', ['DTSTART:20260101T090000Z'], [['TRIGGER:-PT30M']])
		CalDAV.writeReminders(owner, EntryReminders.normalize([10]))
		assert.deepEqual(triggersOf(owner), ['-PT10M'])
		CalDAV.writeReminders(owner, null)
		assert.deepEqual(triggersOf(owner), [])
	})
})
