import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { termsMatch } from './termsMatch.js'

describe('termsMatch', () => {
	it('matches every term, in any order', () => {
		assert.equal(termsMatch('week view', 'Week View switch'), true)
		assert.equal(termsMatch('view week', 'Week View switch'), true)
	})

	it('fails when one term is missing, however well the others match', () => {
		assert.equal(termsMatch('week grid', 'Week View switch'), false)
	})

	it('ignores case and surrounding whitespace', () => {
		assert.equal(termsMatch('  WEEK  ', 'Week View'), true)
	})

	it('matches within a word — a half-remembered label still finds its row', () => {
		assert.equal(termsMatch('eek', 'Week View'), true)
	})

	it('matches everything when nothing was typed', () => {
		assert.equal(termsMatch('', 'anything at all'), true)
		assert.equal(termsMatch('   ', 'anything at all'), true)
	})
})
