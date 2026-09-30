import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { brandOf } from './deviceFacts.js'

describe('brandOf', () => {
	const brands = (...names: Array<string>) => names.map(brand => ({ brand }))

	it('skips the engine and the decoy, whatever its spelling', () => {
		assert.equal(brandOf(brands('Not=A?Brand', 'Chromium', 'Google Chrome')), 'Google Chrome')
		assert.equal(brandOf(brands('Chromium', 'Not_A Brand', 'Microsoft Edge')), 'Microsoft Edge')
		assert.equal(brandOf(brands('Not/A)Brand', 'Chromium', 'Opera')), 'Opera')
	})

	it('names Edge rather than the Chrome it also claims to be', () => {
		assert.equal(brandOf(brands('Microsoft Edge', 'Google Chrome', 'Not;A=Brand')), 'Microsoft Edge')
	})

	it('has nothing to name when only the engine is listed', () => {
		assert.equal(brandOf(brands('Chromium', 'Not.A/Brand')), undefined)
	})
})
