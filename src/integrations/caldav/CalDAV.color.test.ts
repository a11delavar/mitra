import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ICAL from 'ical.js'
import { Color } from '#features/sources'
import { CalDAV } from './CalDAV.js'

const event = (...lines: Array<string>) => new ICAL.Component(ICAL.parse([
	'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
	'BEGIN:VEVENT', 'UID:u1', 'DTSTAMP:20260101T000000Z', 'DTSTART:20260602T090000Z', 'SUMMARY:Standup',
	...lines, 'END:VEVENT', 'END:VCALENDAR',
].join('\r\n'))).getFirstSubcomponent('vevent')!

const written = (color: Color | undefined, component = event()) => {
	CalDAV.writeColor(component, color)
	return { color: component.getFirstPropertyValue('color')?.toString(), exact: component.getFirstPropertyValue('x-mitra-color')?.toString(), component }
}

describe('CalDAV COLOR', () => {
	it('writes a preset as its CSS name alone and reads it back', () => {
		for (const preset of Color.palette) {
			const { color, exact, component } = written(preset)
			assert.equal(color, preset.cssName)
			assert.equal(exact, undefined)
			assert.equal(CalDAV.colorOf(component), preset)
		}
	})

	it('writes a custom hex as its nearest name beside the hex, and reads the hex back in another install', () => {
		const custom = Color.parse('#123456')!
		const { color, exact, component } = written(custom)
		assert.equal(color, custom.cssName)
		assert.equal(exact, '#123456')
		assert.equal(CalDAV.colorOf(component), custom)
	})

	it('keeps the entry\'s own hex where the line beside it was dropped', () => {
		const custom = Color.parse('#123456')!
		assert.equal(CalDAV.colorOf(event(`COLOR:${custom.cssName}`), custom), custom)
	})

	it('takes the name another app wrote over the hex beside it, and over the entry\'s', () => {
		const custom = Color.parse('#123456')!
		assert.equal(CalDAV.colorOf(event('COLOR:orange', 'X-MITRA-COLOR:#123456'), custom), Color.Orange)
		assert.equal(CalDAV.colorOf(event('COLOR:turquoise'), custom)?.value, 'turquoise')
	})

	it('reads a hex in COLOR as it is, and no COLOR as the calendar\'s', () => {
		assert.equal(CalDAV.colorOf(event('COLOR:#ABCDEF'))?.value, '#abcdef')
		assert.equal(CalDAV.colorOf(event('X-MITRA-COLOR:#123456'), Color.parse('#123456')), undefined)
	})

	it('drops the hex beside a color that no longer needs it, and both when cleared', () => {
		const { component } = written(Color.parse('#123456'))
		assert.equal(written(Color.Blue, component).exact, undefined)
		const cleared = written(undefined, component)
		assert.equal(cleared.color, undefined)
		assert.equal(cleared.exact, undefined)
	})
})
