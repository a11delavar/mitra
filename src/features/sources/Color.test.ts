import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Color } from './Color.js'

describe('Color', () => {
	it('is one instance per color, whatever case it was written in', () => {
		assert.equal(Color.parse('#EB5A5A'), Color.Red)
		assert.equal(Color.parse(' Turquoise ')?.value, 'turquoise')
		assert.equal(Color.parse('#33669980')?.value, '#33669980')
	})

	it('reads nothing that could leave a style', () => {
		for (const value of ['', 'red; background: url(x)', 'rgb(0, 0, 0)', '#12345', 42, null]) {
			assert.equal(Color.parse(value), undefined)
		}
	})

	it('refuses on the wire what it cannot read, rather than dropping it', () => {
		assert.throws(() => Color.converter.construct!('url(x)', {}))
		assert.equal(Color.converter.construct!(null, {}), null)
		assert.equal(Color.converter.deconstruct!(Color.Blue, {}), '#51ace3')
	})

	it('derives the same preset from the same identifier', () => {
		assert.equal(Color.derivedFrom('https://dav/cal/'), Color.derivedFrom('https://dav/cal/'))
		assert.ok(Color.palette.includes(Color.derivedFrom('anything')))
	})
})

describe('Color.unusedAmong', () => {
	it('starts a first calendar on green', () => {
		assert.equal(Color.unusedAmong([]), Color.Green)
	})

	it('skips the presets the account already uses, and colours it never picked', () => {
		assert.equal(Color.unusedAmong([Color.Green, Color.parse('#123456'), undefined]), Color.Blue)
	})

	it('cycles once every preset is taken', () => {
		assert.ok(Color.palette.includes(Color.unusedAmong(Color.palette)))
	})
})
