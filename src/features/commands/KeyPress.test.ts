import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { KeyPress } from './KeyPress.js'

const press = (key: string, code: string, shiftKey = false) => new KeyPress({ key, code, shiftKey })

describe('KeyPress', () => {
	it('is the key a Latin layout types, wherever the key sits', () => {
		assert.equal(press('c', 'KeyC').key, 'c')
		// AZERTY prints W where QWERTY has Z: the printed letter wins.
		assert.equal(press('w', 'KeyZ').key, 'w')
		assert.ok(press('C', 'KeyC', true).is('c'))
		// BÉPO types "é" where QWERTY has W: an accented Latin letter is its own key, not the week view's.
		assert.equal(press('é', 'KeyW').key, 'é')
		assert.equal(press('ü', 'KeyT').key, 'ü')
	})

	it('is the key in its place where the layout types another script', () => {
		assert.equal(press('ز', 'KeyC').key, 'c')
		assert.equal(press('с', 'KeyC').key, 'c')
		assert.equal(press('۱', 'Digit1').key, '1')
		assert.equal(press('/', 'Slash').key, '/')
		assert.equal(press('؟', 'Slash', true).key, '?')
		assert.ok(press('ح', 'KeyP').is('p'))
	})

	it('keeps a named key as it is', () => {
		assert.equal(press('ArrowLeft', 'ArrowLeft').key, 'ArrowLeft')
		assert.equal(press('Escape', 'Escape').key, 'Escape')
		assert.ok(!press('ArrowLeft', 'ArrowLeft').is('arrowright'))
	})

	it('keeps a character of another script whose place names no Latin key', () => {
		assert.equal(press('پ', 'Backslash').key, 'پ')
	})
})
